"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const vscode_1 = require("vscode");
class IonicCompletionProvider {
    constructor(completionsSource) {
        this.completionsSource = completionsSource;
    }
    provideCompletionItems() {
        if (this.snippetCompletions) {
            return this.snippetCompletions;
        }
        this.snippetCompletions = [];
        try {
            let rawSnippets = JSON.parse(fs.readFileSync(this.completionsSource, "utf8"));
            this.snippetCompletions = Object.keys(rawSnippets)
                .map(name => makeCompletionItem(rawSnippets[name]));
        }
        catch (err) {
            // Log error here and do not try to read snippets anymore
            console.warn(`Failed to read snippets from ${this.completionsSource}`);
        }
        return this.snippetCompletions;
    }
}
IonicCompletionProvider.HTML_DOCUMENT_SELECTOR = "html";
IonicCompletionProvider.JS_DOCUMENT_SELECTOR = "javascript";
exports.IonicCompletionProvider = IonicCompletionProvider;
function makeCompletionItem(rawSnippet) {
    const item = new vscode_1.CompletionItem(rawSnippet.prefix);
    item.documentation = rawSnippet.description;
    item.kind = vscode_1.CompletionItemKind.Snippet;
    item.insertText = new vscode_1.SnippetString(rawSnippet.body.join("\n"));
    return item;
}

//# sourceMappingURL=completionProviders.js.map
