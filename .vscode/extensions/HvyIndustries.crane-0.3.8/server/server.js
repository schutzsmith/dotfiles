/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const treeBuilder_1 = require("./hvy/treeBuilder");
const nodes_1 = require("./hvy/nodes");
const Debug_1 = require("./util/Debug");
const suggestionBuilder_1 = require("./suggestionBuilder");
const definition_1 = require("./providers/definition");
const Storage_1 = require("./util/Storage");
const Files_1 = require("./util/Files");
const documentSymbol_1 = require("./providers/documentSymbol");
const workspaceSymbol_1 = require("./providers/workspaceSymbol");
const util = require('util');
// Glob for file searching
const glob = require("glob");
// FileQueue for queuing files so we don't open too many
const FileQueue = require('filequeue');
const fq = new FileQueue(200);
let connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
let documents = new vscode_languageserver_1.TextDocuments();
documents.listen(connection);
Debug_1.Debug.SetConnection(connection);
let treeBuilder = new treeBuilder_1.TreeBuilder();
treeBuilder.SetConnection(connection);
let workspaceTree = [];
let cache = new Storage_1.default();
// Prevent garbage collection of essential objects
let timer = setInterval(() => {
    treeBuilder.Ping();
    return workspaceTree.length;
}, 15000);
let workspaceRoot;
var craneProjectDir;
let enableCache = true;
connection.onInitialize((params) => {
    workspaceRoot = params.rootPath;
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':', '$', '>', "\\"]
            },
            definitionProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true
        }
    };
});
// hold the maxNumberOfProblems setting
let maxNumberOfProblems;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
    let settings = change.settings;
    maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
    // Revalidate any open text documents
    //documents.all().forEach(validateTextDocument);
});
// Use this to send a request to the client
// https://github.com/Microsoft/vscode/blob/80bd73b5132268f68f624a86a7c3e56d2bbac662/extensions/json/client/src/jsonMain.ts
// https://github.com/Microsoft/vscode/blob/580d19ab2e1fd6488c3e515e27fe03dceaefb819/extensions/json/server/src/server.ts
//connection.sendRequest()
connection.onDidChangeWatchedFiles((change) => {
    // Monitored files have change in VSCode
    connection.console.log('We recevied an file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition) => {
    var toReturn = null;
    var doc = documents.get(textDocumentPosition.textDocument.uri);
    try {
        var suggestionBuilder = new suggestionBuilder_1.SuggestionBuilder();
        suggestionBuilder.prepare(textDocumentPosition, doc, workspaceTree);
        toReturn = suggestionBuilder.build();
    }
    catch (ex) {
        let message = "";
        if (ex.message)
            message = ex.message;
        if (ex.stack)
            message += " :: STACK TRACE :: " + ex.stack;
        if (message && message != "")
            Debug_1.Debug.sendErrorTelemetry(message);
        Debug_1.Debug.error("Completion error: " + ex.message + "\n" + ex.stack);
    }
    return toReturn;
});
// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    // TODO -- Add phpDoc info
    // if (item.data === 1) {
    //     item.detail = 'TypeScript details',
    //     item.documentation = 'TypeScript documentation'
    // } else if (item.data === 2) {
    //     item.detail = 'JavaScript details',
    //     item.documentation = 'JavaScript documentation'
    // }
    return item;
});
connection.onDefinition((params, cancellationToken) => {
    return new Promise((resolve, reject) => {
        var locations = null;
        try {
            let path = Files_1.Files.getPathFromUri(params.textDocument.uri);
            let filenode = getFileNodeFromPath(path);
            let definitionProvider = new definition_1.DefinitionProvider(params, path, filenode, workspaceTree);
            locations = definitionProvider.findDefinition();
        }
        catch (ex) {
            let message = "";
            if (ex.message)
                message = ex.message;
            if (ex.stack)
                message += " :: STACK TRACE :: " + ex.stack;
            if (message && message != "")
                Debug_1.Debug.sendErrorTelemetry(message);
        }
        resolve(locations);
    });
});
connection.onDocumentSymbol((params, cancellationToken) => {
    return new Promise((resolve, reject) => {
        var symbols = null;
        try {
            let path = Files_1.Files.getPathFromUri(params.textDocument.uri);
            let filenode = getFileNodeFromPath(path);
            let documentSymbolProvider = new documentSymbol_1.DocumentSymbolProvider(filenode);
            symbols = documentSymbolProvider.findSymbols();
        }
        catch (ex) {
            let message = "";
            if (ex.message)
                message = ex.message;
            if (ex.stack)
                message += " :: STACK TRACE :: " + ex.stack;
            if (message && message != "")
                Debug_1.Debug.sendErrorTelemetry(message);
        }
        resolve(symbols);
    });
});
connection.onWorkspaceSymbol((params, cancellationToken) => {
    return new Promise((resolve, reject) => {
        var symbols = null;
        try {
            let workspaceSymbolProvider = new workspaceSymbol_1.WorkspaceSymbolProvider(workspaceTree, params.query);
            symbols = workspaceSymbolProvider.findSymbols();
        }
        catch (ex) {
            let message = "";
            if (ex.message)
                message = ex.message;
            if (ex.stack)
                message += " :: STACK TRACE :: " + ex.stack;
            if (message && message != "")
                Debug_1.Debug.sendErrorTelemetry(message);
        }
        resolve(symbols);
    });
});
var buildObjectTreeForDocument = new vscode_languageserver_1.RequestType("buildObjectTreeForDocument");
connection.onRequest(buildObjectTreeForDocument, (requestObj) => {
    var fileUri = requestObj.path;
    var text = requestObj.text;
    treeBuilder.Parse(text, fileUri).then(result => {
        addToWorkspaceTree(result.tree);
        // notifyClientOfWorkComplete();
        return true;
    })
        .catch(error => {
        Debug_1.Debug.error("Build request error :\n" + (error.stack ? error.stack : error));
        notifyClientOfWorkComplete();
        return false;
    });
});
var deleteFile = new vscode_languageserver_1.RequestType("deleteFile");
connection.onRequest(deleteFile, (requestObj) => {
    var node = getFileNodeFromPath(requestObj.path);
    if (node instanceof nodes_1.FileNode) {
        removeFromWorkspaceTree(node);
    }
});
var saveTreeCache = new vscode_languageserver_1.RequestType("saveTreeCache");
connection.onRequest(saveTreeCache, request => {
    saveProjectTree(request.projectDir, request.projectTree).then(saved => {
        notifyClientOfWorkComplete();
    }).catch(error => {
        Debug_1.Debug.error(util.inspect(error, false, null));
    });
});
let docsDoneCount = 0;
let refreshProcessing = false;
var docsToDo = [];
var stubsToDo = [];
var buildFromFiles = new vscode_languageserver_1.RequestType("buildFromFiles");
connection.onRequest(buildFromFiles, (project) => {
    if (refreshProcessing) {
        // Don't reparse if we're in the middle of parsing
        return;
    }
    refreshProcessing = true;
    if (project.rebuild) {
        workspaceTree = [];
        treeBuilder = new treeBuilder_1.TreeBuilder();
    }
    enableCache = project.enableCache;
    docsToDo = project.files;
    docsDoneCount = 0;
    Debug_1.Debug.info("Preparing to parse workspace...");
    // Run asynchronously
    setTimeout(() => {
        glob(project.craneRoot + '/phpstubs/*/*.php', (err, fileNames) => {
            // Process the php stubs
            stubsToDo = fileNames;
            Debug_1.Debug.info(`Processing ${stubsToDo.length} stubs from ${project.craneRoot}/phpstubs`);
            Debug_1.Debug.info(`Stub files to process: ${stubsToDo.length}`);
            processStub().then(data => {
                Debug_1.Debug.info('Stubs parsing done!');
                Debug_1.Debug.info(`Workspace files to process: ${docsToDo.length}`);
                processWorkspaceFiles(project.projectPath, project.treePath);
            }).catch(data => {
                Debug_1.Debug.info('No stubs found!');
                Debug_1.Debug.info(`Workspace files to process: ${docsToDo.length}`);
                processWorkspaceFiles(project.projectPath, project.treePath);
            });
        });
    }, 100);
});
var buildFromProject = new vscode_languageserver_1.RequestType("buildFromProject");
connection.onRequest(buildFromProject, (data) => {
    enableCache = data.enableCache;
    cache.read(data.treePath, (err, data) => {
        if (err) {
            Debug_1.Debug.error('Could not read cache file');
            Debug_1.Debug.error((util.inspect(err, false, null)));
        }
        else {
            Debug_1.Debug.info('Cache file successfully read');
            workspaceTree = data;
            notifyClientOfWorkComplete();
        }
    });
});
/**
 * Processes the stub files
 */
function processStub() {
    return new Promise((resolve, reject) => {
        var offset = 0;
        if (stubsToDo.length == 0) {
            reject();
        }
        stubsToDo.forEach(file => {
            fq.readFile(file, { encoding: 'utf8' }, (err, data) => {
                treeBuilder.Parse(data, file).then(result => {
                    addToWorkspaceTree(result.tree);
                    Debug_1.Debug.info(`${offset} Stub Processed: ${file}`);
                    offset++;
                    if (offset == stubsToDo.length) {
                        resolve();
                    }
                }).catch(err => {
                    Debug_1.Debug.error(`${offset} Stub Error: ${file}`);
                    Debug_1.Debug.error((util.inspect(err, false, null)));
                    offset++;
                    if (offset == stubsToDo.length) {
                        resolve();
                    }
                });
            });
        });
    });
}
/**
 * Processes the users workspace files
 */
function processWorkspaceFiles(projectPath, treePath) {
    docsToDo.forEach(file => {
        fq.readFile(file, { encoding: 'utf8' }, (err, data) => {
            treeBuilder.Parse(data, file).then(result => {
                addToWorkspaceTree(result.tree);
                docsDoneCount++;
                connection.sendNotification("fileProcessed", {
                    filename: file,
                    total: docsDoneCount,
                    error: null
                });
                if (docsToDo.length == docsDoneCount) {
                    workspaceProcessed(projectPath, treePath);
                }
            }).catch(data => {
                docsDoneCount++;
                if (docsToDo.length == docsDoneCount) {
                    workspaceProcessed(projectPath, treePath);
                }
                Debug_1.Debug.error(util.inspect(data, false, null));
                Debug_1.Debug.error(`Issue processing ${file}`);
                connection.sendNotification("fileProcessed", { filename: file, total: docsDoneCount, error: util.inspect(data, false, null) });
            });
        });
    });
}
function workspaceProcessed(projectPath, treePath) {
    Debug_1.Debug.info("Workspace files have processed");
    saveProjectTree(projectPath, treePath).then(savedTree => {
        notifyClientOfWorkComplete();
        if (savedTree) {
            Debug_1.Debug.info('Project tree has been saved');
        }
    }).catch(error => {
        Debug_1.Debug.error(util.inspect(error, false, null));
    });
}
function addToWorkspaceTree(tree) {
    // Loop through existing filenodes and replace if exists, otherwise add
    var fileNode = workspaceTree.filter((fileNode) => {
        return fileNode.path == tree.path;
    })[0];
    var index = workspaceTree.indexOf(fileNode);
    if (index !== -1) {
        workspaceTree[index] = tree;
    }
    else {
        workspaceTree.push(tree);
    }
}
function removeFromWorkspaceTree(tree) {
    var index = workspaceTree.indexOf(tree);
    if (index > -1) {
        workspaceTree.splice(index, 1);
    }
}
function getClassNodeFromTree(className) {
    var toReturn = null;
    for (var i = 0, l = workspaceTree.length; i < l; i++) {
        var fileNode = workspaceTree[i];
        for (var j = 0, sl = fileNode.classes.length; j < sl; j++) {
            var classNode = fileNode.classes[j];
            if (classNode.name.toLowerCase() == className.toLowerCase()) {
                toReturn = classNode;
            }
        }
    }
    return toReturn;
}
function getTraitNodeFromTree(traitName) {
    var toReturn = null;
    for (var i = 0, l = workspaceTree.length; i < l; i++) {
        var fileNode = workspaceTree[i];
        for (var j = 0, sl = fileNode.traits.length; j < sl; j++) {
            var traitNode = fileNode.traits[j];
            if (traitNode.name.toLowerCase() == traitName.toLowerCase()) {
                toReturn = traitNode;
            }
        }
    }
    return toReturn;
}
function getFileNodeFromPath(path) {
    var returnNode = null;
    for (var i = 0, l = workspaceTree.length; i < l; i++) {
        var fileNode = workspaceTree[i];
        if (fileNode.path == path) {
            returnNode = fileNode;
        }
    }
    return returnNode;
}
function notifyClientOfWorkComplete() {
    refreshProcessing = false;
    connection.sendRequest("workDone");
}
function saveProjectTree(projectPath, treeFile) {
    return new Promise((resolve, reject) => {
        if (!enableCache) {
            resolve(false);
        }
        else {
            cache.save(treeFile, workspaceTree, (result) => {
                if (result === true) {
                    resolve(true);
                }
                else {
                    reject(result);
                }
            });
        }
    });
}
connection.listen();
//# sourceMappingURL=server.js.map