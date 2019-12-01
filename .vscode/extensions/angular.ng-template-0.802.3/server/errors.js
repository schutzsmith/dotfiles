"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const ts = require("typescript");
class ErrorCollector {
    constructor(documents, connection, initialDelay = 750, nextDelay = 20) {
        this.documents = documents;
        this.connection = connection;
        this.initialDelay = initialDelay;
        this.nextDelay = nextDelay;
    }
    requestErrors(...documents) {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        let index = 0;
        let process;
        process = () => {
            this.timer = undefined;
            this.sendErrorsFor(documents[index++]);
            if (index < documents.length)
                this.timer = setTimeout(process, this.nextDelay);
        };
        this.timer = setTimeout(process, this.initialDelay);
    }
    sendErrorsFor(document) {
        const { fileName, service } = this.documents.getServiceInfo(document);
        if (service) {
            const diagnostics = service.getDiagnostics(fileName);
            if (!diagnostics || !diagnostics.length) {
                this.connection.sendDiagnostics({
                    uri: document.uri,
                    diagnostics: [],
                });
                return;
            }
            if (diagnostics[0].span) {
                // Backwards compatibility with old ng.Diagnostic[]
                const offsets = [].concat(...diagnostics.map(d => [d.span.start, d.span.end]));
                const positions = this.documents.offsetsToPositions(document, offsets);
                const ranges = [];
                for (let i = 0; i < positions.length; i += 2) {
                    ranges.push(vscode_languageserver_1.Range.create(positions[i], positions[i + 1]));
                }
                this.connection.sendDiagnostics({
                    uri: document.uri,
                    diagnostics: diagnostics.map((diagnostic, i) => ({
                        range: ranges[i],
                        message: flattenChain(diagnostic.message, ''),
                        severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                        source: 'Angular'
                    }))
                });
            }
            else {
                const tsDiagnostics = diagnostics;
                const offsets = [].concat(...tsDiagnostics.map(d => {
                    const start = d.start || 0;
                    const end = start + (d.length || 0);
                    return [start, end];
                }));
                const positions = this.documents.offsetsToPositions(document, offsets);
                const ranges = [];
                for (let i = 0; i < positions.length; i += 2) {
                    ranges.push(vscode_languageserver_1.Range.create(positions[i], positions[i + 1]));
                }
                this.connection.sendDiagnostics({
                    uri: document.uri,
                    diagnostics: tsDiagnostics.map((diagnostic, i) => ({
                        range: ranges[i],
                        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                        severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                        source: 'Angular'
                    }))
                });
            }
        }
    }
}
exports.ErrorCollector = ErrorCollector;
function flattenChain(message, prefix) {
    if (typeof message === 'string') {
        return `${prefix}${message}`;
    }
    if (message.next) {
        return `${prefix}${message.message}\n${flattenChain(message.next, prefix + '  ')}`;
    }
    return `${prefix}${message.message}`;
}
//# sourceMappingURL=errors.js.map