"use strict";
var child_process_1 = require("child_process");
var vscode = require('vscode');
var CommandsGenerator = (function () {
    function CommandsGenerator() {
        this.commands = [{
                ionic_serve: "ionic serve",
                ionic_run_android: "ionic run android",
                ionic_emulate_android: "ionic emulate android",
                ionic_run_ios: "ionic run ios",
                ionic_emulate_ios: "ionic emulate ios",
                ionic_generate: "ionic generate"
            }];
    }
    CommandsGenerator.prototype.runCommand = function (message, command) {
        if (command === "ionic generate") {
            vscode.window.showQuickPick([
                "provider",
                "page",
                "component",
                "directive",
                "pipe",
                "tabs"
            ], {
                placeHolder: "What would you like to generate?"
            }).then(function (generate) {
                vscode.window.showInputBox({
                    prompt: "What would you like to name your " + generate + "?",
                    value: "My" + generate
                }).then(function (name) {
                    vscode.window.showInformationMessage(message);
                    child_process_1.exec("ionic generate " + generate + " " + name, { cwd: vscode.workspace.rootPath }, function (error, stdout, stderr) {
                        if (error) {
                            vscode.window.showErrorMessage(error.toString());
                            console.log(error);
                        }
                    });
                });
            });
        }
        else {
            vscode.window.showInformationMessage(message);
            child_process_1.exec(command, { cwd: vscode.workspace.rootPath }, function (error, stdout, stderr) {
                if (error) {
                    vscode.window.showErrorMessage(error.toString());
                    console.log(error);
                }
            });
        }
        ;
    };
    return CommandsGenerator;
}());
exports.CommandsGenerator = CommandsGenerator;
//# sourceMappingURL=commands.js.map