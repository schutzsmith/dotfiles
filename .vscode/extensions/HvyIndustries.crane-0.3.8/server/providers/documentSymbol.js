/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const Files_1 = require("../util/Files");
const fs = require('fs');
class DocumentSymbolProvider {
    constructor(tree, query = null) {
        if (query == "") {
            query = null;
        }
        if (query != null) {
            query = query.toLowerCase();
        }
        this.query = query;
        this.tree = tree;
    }
    findSymbols() {
        // Loop round current filenode
        return this.buildSymbolInformation();
    }
    buildSymbolInformation() {
        var toReturn = [];
        for (let i = 0, l = this.tree.functions.length; i < l; i++) {
            var functionItem = this.tree.functions[i];
            this.addSymbol(toReturn, functionItem, vscode_languageserver_1.SymbolKind.Function, null);
        }
        for (let i = 0, l = this.tree.namespaces.length; i < l; i++) {
            var item = this.tree.namespaces[i];
            this.addSymbol(toReturn, item, vscode_languageserver_1.SymbolKind.Namespace, null);
        }
        for (let i = 0, l = this.tree.classes.length; i < l; i++) {
            var classItem = this.tree.classes[i];
            this.addSymbol(toReturn, classItem, vscode_languageserver_1.SymbolKind.Class, classItem.namespace);
            this.buildClassTraitInterfaceBody(classItem, toReturn);
        }
        for (let i = 0, l = this.tree.traits.length; i < l; i++) {
            var traitItem = this.tree.traits[i];
            this.addSymbol(toReturn, traitItem, vscode_languageserver_1.SymbolKind.Class, traitItem.namespace);
            this.buildClassTraitInterfaceBody(traitItem, toReturn);
        }
        for (let i = 0, l = this.tree.interfaces.length; i < l; i++) {
            var interfaceItem = this.tree.interfaces[i];
            this.addSymbol(toReturn, interfaceItem, vscode_languageserver_1.SymbolKind.Interface, interfaceItem.namespace);
            this.buildClassTraitInterfaceBody(interfaceItem, toReturn);
        }
        return toReturn;
    }
    buildClassTraitInterfaceBody(item, toReturn) {
        if (item.constants) {
            for (let i = 0, l = item.constants.length; i < l; i++) {
                var constant = item.constants[i];
                this.addSymbol(toReturn, constant, vscode_languageserver_1.SymbolKind.Constant, item.name);
            }
        }
        if (item.properties) {
            for (let i = 0, l = item.properties.length; i < l; i++) {
                var property = item.properties[i];
                this.addSymbol(toReturn, property, vscode_languageserver_1.SymbolKind.Property, item.name, "$" + property.name);
            }
        }
        if (item.methods) {
            for (let i = 0, l = item.methods.length; i < l; i++) {
                var method = item.methods[i];
                this.addSymbol(toReturn, method, vscode_languageserver_1.SymbolKind.Method, item.name);
            }
        }
        if (item.construct) {
            this.addSymbol(toReturn, item.construct, vscode_languageserver_1.SymbolKind.Constructor, item.name);
        }
    }
    queryMatch(name) {
        if (this.query == null) {
            return true;
        }
        name = name.toLowerCase();
        if (name == this.query || name.indexOf(this.query) > -1) {
            return true;
        }
        // Support fuzzy searching
        // If the name contains all of the chars in the query, also return true
        let nameChars = name.split("");
        let queryChars = this.query.split("");
        // Note the "!" to reverse the result of some()
        // some() will return true if a query char is not found in the name
        let matchFound = !queryChars.some(char => {
            return nameChars.indexOf(char) == -1;
        });
        return matchFound;
    }
    addSymbol(toReturn, item, kind, parent, name = null) {
        if (!name) {
            name = item.name;
        }
        if (!this.queryMatch(name)) {
            return;
        }
        toReturn.push({
            name: name,
            containerName: parent,
            kind: kind,
            location: this.buildLocation(item.startPos, item.endPos)
        });
    }
    buildLocation(startPos, endPos) {
        // Handle rare cases where there is no end position
        if (endPos == null) {
            endPos = startPos;
        }
        return {
            uri: Files_1.Files.getUriFromPath(this.tree.path),
            range: {
                start: {
                    line: startPos.line,
                    character: startPos.col
                },
                end: {
                    line: endPos.line,
                    character: endPos.col
                }
            }
        };
    }
}
exports.DocumentSymbolProvider = DocumentSymbolProvider;
//# sourceMappingURL=documentSymbol.js.map