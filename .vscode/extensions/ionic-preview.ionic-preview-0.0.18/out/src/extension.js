'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const net = require("net");
const fs = require("fs");
function activate(context) {
    let portaIonic;
    let hostIonic;
    let backgroundColor;
    let checkPort;
    // Verifica se porta está em uso
    var portNotInUse = function (port, host, callback) {
        let config = vscode.workspace.getConfiguration('ionic-preview');
        checkPort = config.get('check-port');
        if (checkPort) {
            var server = net.createServer(function (socket) {
                socket.write('Echo server\r\n');
                socket.pipe(socket);
            });
            server.listen(port, host);
            server.on('error', function (e) {
                callback(true);
            });
            server.on('listening', function (e) {
                server.close();
                if (host == '127.0.0.1') {
                    if (portNotInUse0000(port)) {
                        callback(true);
                    }
                    else {
                        callback(false);
                    }
                }
                else {
                    callback(false);
                }
            });
        }
        else {
            callback(true);
        }
    };
    let portNotInUse0000 = function (porta) {
        var server = net.createServer(function (socket) {
            socket.write('Echo server\r\n');
            socket.pipe(socket);
        });
        server.listen(porta, '0.0.0.0');
        server.on('error', function (e) {
            return (true);
        });
        server.on('listening', function (e) {
            server.close();
            return (false);
        });
    };
    //Criar arquivo
    var createFile = function (arquivo, conteudo) {
        fs.writeFile(arquivo, conteudo, function (err) {
            if (err) {
                return console.error(err);
            }
        });
    };
    var lerConf = function () {
        let config = vscode.workspace.getConfiguration('ionic-preview');
        portaIonic = config.get('port');
        hostIonic = config.get('host');
        backgroundColor = config.get('background-color');
    };
    let previewAndroid = vscode.commands.registerCommand('extension.ionic-preview-android', () => __awaiter(this, void 0, void 0, function* () {
        lerConf();
        portNotInUse(portaIonic, hostIonic, function (returnValue) {
            if (returnValue) {
                let htmlAndroid = '<!DOCTYPE html><html lang="en"><head><title></title><meta charset="UTF-8"></head><body style="background-color: ' + backgroundColor + '"><aside id="platform-preview-2" class="platform-preview-2"><div id="demo-device-android" class="android"><iframe src="http://localhost:' + portaIonic + '/?ionicplatform=android" width="360" height="640" frameborder="0" scrolling="no" style="pointer-events: auto;"> </iframe></div></aside> </body><link rel="stylesheet" type="text/css" href="styles.css"><style>html, body { width: 100% !important; height: 100% !important; margin-top: 0px; margin: 0}.platform-preview-2 { min-width: 360px !important; margin: 0 auto !important; text-align: center; }</style></html>';
                createFile(path.join(__filename, '..', '..', '..', 'out', 'src', 'android.html'), htmlAndroid);
                let uriandroid = vscode.Uri.file(path.join(__filename, '..', '..', '..', 'out', 'src', 'android.html'));
                let success = vscode.commands.executeCommand('vscode.previewHtml', uriandroid, vscode.ViewColumn.Two, 'Ionic Preview - Android').then((success) => { }, (reason) => {
                    vscode.window.showErrorMessage(reason);
                });
            }
            else {
                vscode.window.showErrorMessage('We did not identify the Ionic serve running on host ' + hostIonic + ' on port ' + portaIonic);
            }
        });
    }));
    let previewIOS = vscode.commands.registerCommand('extension.ionic-preview-ios', () => __awaiter(this, void 0, void 0, function* () {
        lerConf();
        portNotInUse(portaIonic, hostIonic, function (returnValue) {
            if (returnValue) {
                let htmlAndroid = '<!DOCTYPE html><html lang="en"><head><title></title><meta charset="UTF-8"></head><body style="background-color: ' + backgroundColor + '"><aside id="platform-preview-2" class="platform-preview-2"><div id="demo-device-ios" class="ios"><iframe src="http://localhost:' + portaIonic + '/?ionicplatform=ios" width="360" height="640" frameborder="0" scrolling="no" style="pointer-events: auto;"> </iframe></div></aside> </body><link rel="stylesheet" type="text/css" href="styles.css"><style>html, body { width: 100% !important; height: 100% !important; margin-top: 0px; margin: 0}.platform-preview-2 { min-width: 360px !important; margin: 0 auto !important; text-align: center; }</style></html>';
                createFile(path.join(__filename, '..', '..', '..', 'out', 'src', 'ios.html'), htmlAndroid);
                let uriios = vscode.Uri.file(path.join(__filename, '..', '..', '..', 'out', 'src', 'ios.html'));
                let success = vscode.commands.executeCommand('vscode.previewHtml', uriios, vscode.ViewColumn.Two, 'Ionic Preview - IOS').then((success) => { }, (reason) => {
                    vscode.window.showErrorMessage(reason);
                });
            }
            else {
                vscode.window.showErrorMessage('We did not identify the Ionic serve running on host ' + hostIonic + ' on port ' + portaIonic);
            }
        });
    }));
    let previewWindows = vscode.commands.registerCommand('extension.ionic-preview-windows', () => __awaiter(this, void 0, void 0, function* () {
        lerConf();
        portNotInUse(portaIonic, hostIonic, function (returnValue) {
            if (returnValue) {
                let htmlAndroid = '<!DOCTYPE html><html lang="en"><head><title></title><meta charset="UTF-8"></head><body style="background-color: ' + backgroundColor + '"><aside id="platform-preview-2" class="platform-preview-2"><div id="demo-device-windows" class="windows"><iframe src="http://localhost:' + portaIonic + '/?ionicplatform=windows" width="360" height="640" frameborder="0" scrolling="no" style="pointer-events: auto;"> </iframe></div></aside> </body><link rel="stylesheet" type="text/css" href="styles.css"><style>html, body { width: 100% !important; height: 100% !important; margin-top: 0px; margin: 0}.platform-preview-2 { min-width: 360px !important; margin: 0 auto !important; text-align: center; }</style></html>';
                createFile(path.join(__filename, '..', '..', '..', 'out', 'src', 'windows.html'), htmlAndroid);
                let uriwindows = vscode.Uri.file(path.join(__filename, '..', '..', '..', 'out', 'src', 'windows.html'));
                let success = vscode.commands.executeCommand('vscode.previewHtml', uriwindows, vscode.ViewColumn.Two, 'Ionic Preview - windows').then((success) => { }, (reason) => {
                    vscode.window.showErrorMessage(reason);
                });
            }
            else {
                vscode.window.showErrorMessage('We did not identify the Ionic serve running on host ' + hostIonic + ' on port ' + portaIonic);
            }
        });
    }));
    let previewUndefined = vscode.commands.registerCommand('extension.ionic-preview-undefined', () => __awaiter(this, void 0, void 0, function* () {
        lerConf();
        portNotInUse(portaIonic, hostIonic, function (returnValue) {
            if (returnValue) {
                let htmlAndroid = '<!DOCTYPE html><html lang="en"><head><title></title><meta charset="UTF-8"></head><body style="background-color: ' + backgroundColor + '"><iframe id="t1" src="http://localhost:' + portaIonic + '" width="360" height="640" frameborder="0" scrolling="no" style="pointer-events: auto;"> </iframe></body></html>';
                createFile(path.join(__filename, '..', '..', '..', 'out', 'src', 'undefined.html'), htmlAndroid);
                let uriundefined = vscode.Uri.file(path.join(__filename, '..', '..', '..', 'out', 'src', 'undefined.html'));
                let success = vscode.commands.executeCommand('vscode.previewHtml', uriundefined, vscode.ViewColumn.Two, 'Ionic Preview - Without Frame').then((success) => { }, (reason) => {
                    vscode.window.showErrorMessage(reason);
                });
            }
            else {
                vscode.window.showErrorMessage('We did not identify the Ionic serve running on host ' + hostIonic + ' on port ' + portaIonic);
            }
        });
    }));
    context.subscriptions.push(previewAndroid);
    context.subscriptions.push(previewIOS);
    context.subscriptions.push(previewWindows);
    context.subscriptions.push(previewUndefined);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map