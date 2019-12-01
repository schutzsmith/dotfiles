"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const provider_1 = require("./provider");
function activate(context) {
    const provider = new provider_1.default();
    const createPreviewCommand = function (platform) {
        return () => vscode.commands.executeCommand("vscode.previewHtml", provider.createUrl(platform), vscode.ViewColumn.Two, "Ionic Preview - Without Frame").then(success => { }, reason => {
            vscode.window.showErrorMessage(reason);
        });
    };
    let previewCommand = vscode.commands.registerCommand("extension.showIonicPreview", (platform) => {
        return vscode.commands.executeCommand("vscode.previewHtml", provider.createUrl(), vscode.ViewColumn.Two, "Ionic Preview - Without Frame").then(success => { }, reason => {
            vscode.window.showErrorMessage(reason);
        });
    });
    let previewAndroidCommand = vscode.commands.registerCommand("extension.ionic-preview-android", createPreviewCommand("android"));
    let previewIosCommand = vscode.commands.registerCommand("extension.ionic-preview-ios", createPreviewCommand("ios"));
    let previewWindowsCommand = vscode.commands.registerCommand("extension.ionic-preview-windows", createPreviewCommand("windows"));
    let previewUndefinedCommand = vscode.commands.registerCommand("extension.ionic-preview-undefined", createPreviewCommand());
    let registration = vscode.workspace.registerTextDocumentContentProvider("ionic-preview", provider);
    context.subscriptions.push(previewCommand, previewAndroidCommand, previewIosCommand, previewWindowsCommand, previewUndefinedCommand, registration);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map