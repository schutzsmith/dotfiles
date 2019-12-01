"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const url = require("url");
const vscode_languageserver_1 = require("vscode-languageserver");
const editorServices_1 = require("./editorServices");
// Delegate project service host to TypeScript's sys implementation
class ProjectServiceHostImpl {
    getCurrentDirectory() {
        return ts.sys.getCurrentDirectory();
    }
    readFile(path, encoding) {
        return ts.sys.readFile(path, encoding);
    }
    directoryExists(path) {
        return ts.sys.directoryExists(path);
    }
    getExecutingFilePath() {
        return ts.sys.getExecutingFilePath();
    }
    resolvePath(path) {
        return ts.sys.resolvePath(path);
    }
    fileExists(path) {
        return ts.sys.fileExists(path);
    }
    getDirectories(path) {
        return ts.sys.getDirectories(path);
    }
    watchDirectory(path, callback, recursive) {
        return ts.sys.watchDirectory(path, callback, recursive);
    }
    watchFile(path, callback) {
        return ts.sys.watchFile(path, callback);
    }
    readDirectory(path, extensions, exclude, include) {
        return ts.sys.readDirectory(path, extensions, exclude, include);
    }
    get useCaseSensitiveFileNames() {
        return ts.sys.useCaseSensitiveFileNames;
    }
    get newLine() {
        return ts.sys.newLine;
    }
    setTimeout(callback, ms, ...args) {
        return setTimeout(callback, ms, ...args);
    }
    clearTimeout(timeoutId) {
        return clearTimeout(timeoutId);
    }
}
class ProjectLoggerImpl {
    connect(console) {
        this.console = console;
    }
    close() {
        this.console = null;
    }
    isVerbose() {
        return false;
    }
    info(s) {
        if (this.console)
            this.console.info(s);
    }
    startGroup() { }
    endGroup() { }
    msg(s, type) {
        if (this.console)
            this.console.log(s);
    }
}
function uriToFileName(uri) {
    const parsedUrl = url.parse(uri);
    switch (parsedUrl.protocol) {
        case 'file:':
        case 'private:':
            let result = unescape(parsedUrl.path);
            if (result.match(/^\/\w:/)) {
                result = result.substr(1);
            }
            return result;
    }
}
const fileProtocol = "file://";
function fileNameToUri(fileName) {
    if (fileName.match(/^\w:/)) {
        fileName = '/' + fileName;
    }
    return fileProtocol + escape(fileName);
}
exports.fileNameToUri = fileNameToUri;
class TextDocuments {
    constructor(event) {
        this.event = event;
        this.languageIds = new Map();
        this.changeNumber = 0;
        this.logger = new ProjectLoggerImpl();
        this.host = new ProjectServiceHostImpl();
        this.projectService = new editorServices_1.ProjectService(this.host, this.logger, this.handleProjectEvent.bind(this));
    }
    get syncKind() {
        return vscode_languageserver_1.TextDocumentSyncKind.Incremental;
    }
    listen(connection) {
        // Connect the logger to the connection
        this.logger.connect(connection.console);
        connection.onDidOpenTextDocument(event => this.logErrors(() => {
            // An interersting text document was opened in the client. Inform TypeScirpt's project services about it.
            const file = uriToFileName(event.textDocument.uri);
            if (file) {
                const { configFileName, configFileErrors } = this.projectService.openClientFile(file, event.textDocument.text);
                if (configFileErrors && configFileErrors.length) {
                    // TODO: Report errors
                    this.logger.msg(`Config errors encountered and need to be reported: ${configFileErrors.length}\n  ${configFileErrors.map(error => error.messageText).join('\n  ')}`);
                }
                this.languageIds.set(event.textDocument.uri, event.textDocument.languageId);
            }
        }));
        connection.onDidCloseTextDocument(event => this.logErrors(() => {
            const file = uriToFileName(event.textDocument.uri);
            if (file) {
                this.projectService.closeClientFile(file);
            }
        }));
        connection.onDidChangeTextDocument(event => this.logErrors(() => {
            const file = uriToFileName(event.textDocument.uri);
            if (file) {
                const positions = this.projectService.lineOffsetsToPositions(file, [].concat(...event.contentChanges.map(change => [{
                        // VSCode is 0 based, editor services is 1 based.
                        line: change.range.start.line + 1,
                        col: change.range.start.character + 1
                    }, {
                        line: change.range.end.line + 1,
                        col: change.range.end.character + 1
                    }])));
                if (positions) {
                    this.changeNumber++;
                    const mappedChanges = event.contentChanges.map((change, i) => {
                        const start = positions[i * 2];
                        const end = positions[i * 2 + 1];
                        return { start, end, insertText: change.text };
                    });
                    this.projectService.clientFileChanges(file, mappedChanges);
                    this.changeNumber++;
                }
            }
        }));
        connection.onDidSaveTextDocument(event => this.logErrors(() => {
            // If the file is saved, force the content to be reloaded from disk as the content might have changed on save.
            this.changeNumber++;
            const file = uriToFileName(event.textDocument.uri);
            if (file) {
                this.projectService.reloadScript(file);
                this.changeNumber++;
            }
        }));
    }
    offsetsToPositions(document, offsets) {
        const file = uriToFileName(document.uri);
        if (file) {
            const lineOffsets = this.projectService.positionsToLineOffsets(file, offsets);
            if (lineOffsets) {
                return lineOffsets.map(lineOffset => vscode_languageserver_1.Position.create(lineOffset.line - 1, lineOffset.col - 1));
            }
        }
        return [];
    }
    getDocumentLine(document, offset) {
        const info = this.getServiceInfo(document);
        if (info) {
            const lineInfo = this.projectService.positionToLineOffset(info.fileName, offset);
            if (lineInfo) {
                return { line: lineInfo.line, start: offset - lineInfo.offset, text: lineInfo.text };
            }
        }
    }
    getNgService(document) {
        return this.getServiceInfo(document).service;
    }
    getServiceInfo(document, position) {
        const fileName = uriToFileName(document.uri);
        if (fileName) {
            const project = this.projectService.getProjectForFile(fileName);
            const languageId = this.languageIds.get(document.uri);
            if (project) {
                const service = project.compilerService.ngService;
                if (position) {
                    // VSCode is 0 based, editor services are 1 based.
                    const offset = this.projectService.lineOffsetsToPositions(fileName, [{ line: position.line + 1, col: position.character + 1 }])[0];
                    return { fileName, service, offset, languageId };
                }
                return { fileName, service, languageId };
            }
            return { fileName, languageId };
        }
        return {};
    }
    ifUnchanged(f) {
        const currentChange = this.changeNumber;
        return () => {
            if (currentChange == this.changeNumber)
                f();
        };
    }
    logErrors(f) {
        try {
            f();
        }
        catch (e) {
            if (e.message && e.stack)
                this.logger.msg(`SERVER ERROR: ${e.message}\n${e.stack}`);
            throw e;
        }
    }
    handleProjectEvent(event) {
        if (this.event) {
            switch (event.eventName) {
                case 'context':
                case 'opened':
                case 'closed':
                case 'change':
                    this.event({ kind: event.eventName, document: { uri: fileNameToUri(event.data.fileName) } });
            }
        }
    }
}
exports.TextDocuments = TextDocuments;
//# sourceMappingURL=documents.js.map