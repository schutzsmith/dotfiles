"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
function activate(context) {
    // Log file does not yet exist on disk. It is up to the server to create the
    // file.
    const logFile = path.join(context.logPath, 'nglangsvc.log');
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: {
            module: context.asAbsolutePath(path.join('server', 'server.js')),
            transport: vscode_languageclient_1.TransportKind.ipc,
            args: [
                '--logFile', logFile,
            ],
            options: {
                env: {
                    // Force TypeScript to use the non-polling version of the file watchers.
                    TSC_NONPOLLING_WATCHER: true,
                },
            },
        },
        debug: {
            module: context.asAbsolutePath(path.join('server', 'out', 'server.js')),
            transport: vscode_languageclient_1.TransportKind.ipc,
            args: [
                '--logFile', logFile,
                '--logVerbosity', 'verbose',
            ],
            options: {
                env: {
                    // Force TypeScript to use the non-polling version of the file watchers.
                    TSC_NONPOLLING_WATCHER: true,
                    NG_DEBUG: true,
                },
                execArgv: [
                    // do not lazily evaluate the code so all breakpoints are respected
                    '--nolazy',
                    // If debugging port is changed, update .vscode/launch.json as well
                    '--inspect=6009',
                ]
            },
        },
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for Angular templates and TypeScript documents
        documentSelector: [
            // scheme: 'file' means listen to changes to files on disk only
            // other option is 'untitled', for buffer in the editor (like a new doc)
            { scheme: 'file', language: 'html' },
            { scheme: 'file', language: 'typescript' },
        ],
        synchronize: {
            fileEvents: [
                // Notify the server about file changes to tsconfig.json contained in the workspace
                vscode_1.workspace.createFileSystemWatcher('**/tsconfig.json'),
            ]
        },
        // Don't let our output console pop open
        revealOutputChannelOn: vscode_languageclient_1.RevealOutputChannelOn.Never
    };
    // Create the language client and start the client.
    const client = new vscode_languageclient_1.LanguageClient('Angular Language Service', serverOptions, clientOptions);
    const disposable = client.start();
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map