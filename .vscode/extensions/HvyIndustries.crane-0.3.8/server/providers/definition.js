/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const namespaces_1 = require("../util/namespaces");
const Files_1 = require("../util/Files");
const fs = require('fs');
class DefinitionProvider {
    constructor(positionInfo, path, tree, workspaceTree) {
        this.positionInfo = positionInfo;
        this.path = path;
        this.tree = tree;
        this.workspaceTree = workspaceTree;
    }
    findDefinition() {
        let word = this.getWordAtPosition();
        if (word == "" || word == null) {
            return null;
        }
        var results = [];
        if (word.indexOf("\\") > -1 && word.charAt(0) != "\\") {
            word = "\\" + word;
        }
        var fnName = null;
        if (word.indexOf('::') > -1) {
            fnName = word.split("::", 2);
            word = fnName[0];
            fnName = fnName[1];
        }
        // Get FQN of class under caret
        let fqn = namespaces_1.Namespaces.getFQNFromClassname(word, this.tree);
        let classInfo = namespaces_1.Namespaces.getNamespaceInfoFromFQNClassname(fqn);
        // Search all classes (+ namespace) for provided FQN
        let nodes = this.findTopLevelSymbols(classInfo, fnName);
        // Convert nodes into locations
        results = this.convertNodesIntoLocations(nodes);
        return results;
    }
    getWordAtPosition() {
        // TODO -- find a way to read the text from vscode, instead of from the file
        // this will allow unsaved edits to work here
        var text = fs.readFileSync(this.path, { encoding: 'utf8' });
        var lines = text.split(/\r\n|\r|\n/gm);
        let lineNum = this.positionInfo.position.line;
        let charNum = this.positionInfo.position.character;
        var line = lines[lineNum];
        // Handle situation where file has not been saved
        if (line == null) {
            return null;
        }
        var lineStart = line.substring(0, charNum);
        var lineEnd = line.substr(charNum, line.length);
        let startResult = this.stepBackward(lineStart);
        let endResult = this.stepForward(lineEnd);
        return startResult + endResult;
    }
    stepForward(line) {
        let string = "";
        for (var i = 0; i < line.length; i++) {
            var char = line[i];
            if (/\w/.test(char) || char == "\\") {
                string += char;
            }
            else {
                i = line.length;
            }
        }
        return string;
    }
    stepBackward(line) {
        let string = "";
        for (var i = (line.length - 1); i > -1; i--) {
            var char = line[i];
            if (/\w/.test(char) || char == "\\" || char == "$" || char == ">" || char == ":") {
                string = char + string;
            }
            else {
                i = -1;
            }
        }
        return string;
    }
    findTopLevelSymbols(classInfo, elementName) {
        var namespace = classInfo.namespace;
        var rawClassname = classInfo.classname;
        var toReturn = [], symbol, innerSymbol, filenode;
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            filenode = this.workspaceTree[i];
            symbol = this.scanNodeElements(filenode, ["classes", "interfaces", "traits"], rawClassname, namespace);
            if (symbol) {
                if (elementName) {
                    innerSymbol = this.scanNodeElements(symbol, ["properties", "methods", "constants"], elementName);
                    if (innerSymbol) {
                        symbol = innerSymbol;
                    }
                }
                symbol.path = filenode.path;
                toReturn.push(symbol);
            }
        }
        return toReturn;
    }
    scanNodeElements(node, what, element, ns) {
        if (element) {
            for (var w = 0; w < what.length; w++) {
                var items = node[what[w]];
                if (!Array.isArray(items)) {
                    continue;
                }
                for (var i = 0; i < items.length; i++) {
                    if (items[i].name === element) {
                        if (ns && items[i].namespace !== ns) {
                            continue;
                        }
                        return {
                            node: items[i],
                            path: null
                        };
                    }
                }
            }
        }
        return null;
    }
    convertNodesIntoLocations(nodes) {
        var toReturn = [];
        for (var i = 0, l = nodes.length; i < l; i++) {
            var item = nodes[i];
            let location = {
                uri: Files_1.Files.getUriFromPath(item.path),
                range: {
                    start: {
                        line: item.node.startPos.line,
                        character: item.node.startPos.col
                    },
                    end: {
                        line: item.node.startPos.line,
                        character: item.node.startPos.col
                    }
                }
            };
            toReturn.push(location);
        }
        return toReturn;
    }
}
exports.DefinitionProvider = DefinitionProvider;
//# sourceMappingURL=definition.js.map