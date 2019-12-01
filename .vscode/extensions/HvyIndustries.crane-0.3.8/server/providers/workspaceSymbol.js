/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const documentSymbol_1 = require("./documentSymbol");
const fs = require('fs');
class WorkspaceSymbolProvider {
    constructor(workspaceTree, query) {
        this.workspaceTree = workspaceTree;
        this.query = query;
    }
    findSymbols() {
        var symbols = [];
        // Execute document symbol provider against every file in the tree
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            var fileNode = this.workspaceTree[i];
            let documentSymbolProvider = new documentSymbol_1.DocumentSymbolProvider(fileNode, this.query);
            let fileSymbols = documentSymbolProvider.findSymbols();
            symbols = symbols.concat(fileSymbols);
        }
        return symbols;
    }
}
exports.WorkspaceSymbolProvider = WorkspaceSymbolProvider;
//# sourceMappingURL=workspaceSymbol.js.map