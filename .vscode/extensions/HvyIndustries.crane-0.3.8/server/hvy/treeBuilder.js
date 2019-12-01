/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const treeBuilderV2_1 = require("./treeBuilderV2");
const nodes_1 = require("./nodes");
var phpParser = require("php-parser");
let connection;
function isset(value) {
    return typeof value != 'undefined';
}
class TreeBuilder {
    // v2.0 - updated to use php-parser 2.0.0-pre8
    // v1.5 - added extra types for variables
    // v1.4 - added lineCache
    // v1.3 - support for namespaces + use recursion
    // v1.2 - added option to suppress errors
    // v1.1
    // TODO -- Handle PHP written inside an HTML file (strip everything except php code)
    SetConnection(conn) {
        connection = conn;
    }
    // Parse PHP code to generate an object tree for intellisense suggestions
    Parse(text, filePath) {
        return new Promise((resolve, reject) => {
            var parserInst = new phpParser({
                parser: {
                    extractDoc: true,
                    suppressErrors: true
                },
                ast: {
                    withPositions: true
                }
            });
            var ast = parserInst.parseCode(text);
            parserInst = null;
            this.BuildObjectTree(ast, filePath).then((tree) => {
                var symbolCache = this.BuildSymbolCache(tree, filePath).then(symbolCache => {
                    var returnObj = {
                        tree: tree,
                        symbolCache: symbolCache
                    };
                    resolve(returnObj);
                }).catch(data => {
                    reject(data);
                });
            }).catch(data => {
                reject(data);
            });
        });
    }
    Ping() {
        return "pong";
    }
    // Convert the generated AST into a usable object tree
    BuildObjectTree(ast, filePath) {
        return new Promise((resolve, reject) => {
            let tree = new nodes_1.FileNode();
            let treeBuilderV2 = new treeBuilderV2_1.TreeBuilderV2();
            tree.path = filePath;
            tree = treeBuilderV2.processBranch(ast.children, tree, null);
            treeBuilderV2.buildNamespaceParts(tree);
            resolve(tree);
        });
    }
    // Crunch through the generated tree to build a cache of symbols in this file
    BuildSymbolCache(tree, filePath) {
        return new Promise((resolve, reject) => {
            let cache = [];
            // TODO
            resolve(cache);
        });
    }
}
exports.TreeBuilder = TreeBuilder;
//# sourceMappingURL=treeBuilder.js.map