/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const async_1 = require("../utils/async");
class QualityOfLife {
    constructor() {
        this.delayers = Object.create(null);
        let subscriptions = [];
        vscode.workspace.onDidChangeTextDocument((e) => this.onChangeTextHandler(e.document), null, subscriptions);
        vscode.workspace.onDidCloseTextDocument((textDocument) => { delete this.delayers[textDocument.uri.toString()]; }, null, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(editor => { this.onChangeEditorHandler(editor); }, null, subscriptions);
        this.disposable = vscode.Disposable.from(...subscriptions);
        this.todoCommentDecoration = vscode.window.createTextEditorDecorationType({
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            color: "rgba(91, 199, 235, 1)",
            overviewRulerColor: 'rgba(144, 195, 212, 0.7)',
            isWholeLine: false,
            backgroundColor: 'rgba(91, 199, 235, 0.1)'
        });
        this.styleTodoComments();
    }
    onChangeEditorHandler(editor) {
        // Only process PHP files
        if (editor.document.languageId != "php")
            return;
        this.styleTodoComments();
    }
    onChangeTextHandler(textDocument) {
        // Only process PHP files
        if (textDocument.languageId != "php")
            return;
        let key = textDocument.uri.toString();
        let delayer = this.delayers[key];
        if (!delayer) {
            delayer = new async_1.ThrottledDelayer(200);
            this.delayers[key] = delayer;
        }
        delayer.trigger(() => this.styleTodoComments());
    }
    styleTodoComments() {
        return new Promise((resolve, reject) => {
            var editor = vscode.window.activeTextEditor;
            if (editor == null)
                return;
            // Reset any existing todo style decorations
            editor.setDecorations(this.todoCommentDecoration, []);
            var matchedLines = [];
            // Parse document searching for regex match
            for (var i = 0; i < Math.min(3000, editor.document.lineCount); i++) {
                var line = editor.document.lineAt(i);
                var regex = /(\/\/|#)(\stodo|todo)/ig;
                var result = regex.exec(line.text);
                if (result != null) {
                    var lineOption = { range: new vscode.Range(i, result.index, i, line.range.end.character) };
                    matchedLines.push(lineOption);
                }
            }
            editor.setDecorations(this.todoCommentDecoration, matchedLines);
            resolve();
        });
    }
    dispose() {
        this.disposable.dispose();
    }
}
exports.default = QualityOfLife;
//# sourceMappingURL=qualityOfLife.js.map