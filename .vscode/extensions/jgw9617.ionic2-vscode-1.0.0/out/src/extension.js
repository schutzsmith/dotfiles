'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var commands_1 = require("../src/commands");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    var commands = new commands_1.CommandsGenerator().commands[0];
    var commandGen = new commands_1.CommandsGenerator();
    var ionic_serve = vscode.commands.registerCommand("extension.ionicServe", function () {
        commandGen.runCommand("Currently Running: ionic serve", commands.ionic_serve);
    });
    var ionic_run_android = vscode.commands.registerCommand("extension.ionicRunAndroid", function () {
        commandGen.runCommand("Currently Running: ionic run android", commands.ionic_run_android);
    });
    var ionic_emulate_android = vscode.commands.registerCommand("extension.ionicEmulateAndroid", function () {
        commandGen.runCommand("Currently Running: ionic emulate android", commands.ionic_emulate_android);
    });
    var ionic_run_ios = vscode.commands.registerCommand("extension.ionicRunIos", function () {
        commandGen.runCommand("Currently Running: ionic run ios", commands.ionic_run_ios);
    });
    var ionic_emulate_ios = vscode.commands.registerCommand("extension.ionicEmulateIos", function () {
        commandGen.runCommand("Currently Running: ionic emulate ios", commands.ionic_emulate_ios);
    });
    var ionic_generate = vscode.commands.registerCommand("extension.ionicGenerate", function () {
        commandGen.runCommand("Currently Running: ionic generate", commands.ionic_generate);
    });
    context.subscriptions.push(ionic_serve);
    context.subscriptions.push(ionic_run_android);
    context.subscriptions.push(ionic_emulate_android);
    context.subscriptions.push(ionic_run_ios);
    context.subscriptions.push(ionic_emulate_ios);
    context.subscriptions.push(ionic_generate);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    console.log("Ionic extension was deactivated");
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map