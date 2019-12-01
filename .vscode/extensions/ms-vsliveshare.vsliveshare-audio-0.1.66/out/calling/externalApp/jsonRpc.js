"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rpc = require("vscode-jsonrpc");
const os = require("os");
const net_1 = require("net");
const appEvents_1 = require("./appEvents");
class JsonRPC {
    constructor(pipeName, trace, serverMode = false) {
        this.connectionRegistrationQueue = [];
        this.trace = trace;
        if (serverMode) {
            this.setupServer(pipeName);
        }
        else {
            this.setupClient(pipeName);
        }
    }
    get isDisposed() {
        return this.disposed;
    }
    sendNotification(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connection) {
                return;
            }
            try {
                const notificationType = new rpc.NotificationType(event.eventType);
                return yield this.connection.sendNotification(notificationType, event);
            }
            catch (e) {
                if (!this.disposed) {
                    this.trace.error(`[JsonRPC] sendNotification failed: ${e}`);
                    throw e;
                }
            }
        });
    }
    sendRequest(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connection) {
                return;
            }
            try {
                const requestType = new rpc.RequestType(event.eventType);
                return yield this.connection.sendRequest(requestType, event);
            }
            catch (e) {
                if (!this.disposed) {
                    this.trace.error(`[JsonRPC] sendRequest failed: ${e}`);
                    throw e;
                }
            }
        });
    }
    on(eventType, func) {
        this.connection ?
            this.registerEvent(eventType, func) :
            this.connectionRegistrationQueue.push({ eventType, func });
    }
    dispose() {
        if (!this.disposed) {
            if (this.connection) {
                this.connection.dispose();
                this.connection = null;
            }
            if (this.socket) {
                this.socket.destroy();
                this.socket = null;
            }
            this.disposed = true;
            this.connectionRegistrationQueue = [];
        }
    }
    isNotificationType(eventType) {
        return appEvents_1.NotificationType[eventType];
    }
    setupClient(pipeName) {
        const pipePath = this.getPipePath(pipeName);
        this.socket = net_1.createConnection(pipePath);
        this.socket.on('connect', () => {
            this.trace.info('[JsonRPC] socket connected');
        });
        this.socket.on('error', (e) => {
            this.trace.info(`[JsonRPC] stream connection failure with error: ${e.message}`);
        });
        this.connection = rpc.createMessageConnection(new rpc.StreamMessageReader(this.socket), new rpc.StreamMessageWriter(this.socket));
        this.initialize();
    }
    initialize() {
        for (const item of this.connectionRegistrationQueue) {
            this.registerEvent(item.eventType, item.func);
        }
        this.connectionRegistrationQueue = [];
        this.connection.onError((e) => this.trace.info(`[JsonRPC] RPC connection failure with error: ${e}`));
        this.connection.onUnhandledNotification((e) => this.trace.info(`[JsonRPC] RPC unhandled notification: ${e}`));
        this.connection.onDispose(() => this.trace.info(`[JsonRPC] RPC connection disposed`));
        this.connection.onClose(() => {
            this.trace.info(`[JsonRPC] RPC connection closed`);
            if (!this.disposed) {
                this.dispose();
            }
        });
        this.connection.listen();
    }
    registerEvent(eventType, func) {
        if (this.isNotificationType(eventType)) {
            this.trace.info(`[JsonRPC] Register NotificationType: ${eventType}`);
            const notificationType = new rpc.NotificationType(eventType);
            this.connection.onNotification(notificationType, func);
        }
        else {
            this.trace.info(`[JsonRPC] Register EventType:${eventType}`);
            const requestType = new rpc.RequestType(eventType);
            this.connection.onRequest(requestType, func);
        }
    }
    setupServer(pipeName) {
        const connectionListener = function (stream) {
            this.connection = rpc.createMessageConnection(new rpc.StreamMessageReader(stream), new rpc.StreamMessageWriter(stream));
            this.initialize();
            stream.on('connect', () => {
                this.trace.info('[JsonRPC] stream connected');
            });
            stream.on('end', () => {
                this.trace.info('[JsonRPC] stream ended');
                namedPipeServer.close();
            });
            stream.on('error', (e) => {
                this.trace.error(`[JsonRPC] stream error: ${e}`);
            });
            stream.on('data', (c) => {
                this.trace.info(`[JsonRPC] stream data: ${c}`);
            });
            stream.on('event', (c) => {
                this.trace.info(`[JsonRPC] stream event: ${c}`);
            });
        };
        const namedPipeServer = net_1.createServer(connectionListener.bind(this));
        const pipePath = this.getPipePath(pipeName);
        namedPipeServer.listen(pipePath);
    }
    getPipePath(pipeName) {
        if (process.platform === 'win32') {
            return `\\\\.\\pipe\\${pipeName}`;
        }
        else {
            return `${os.tmpdir()}/LiveShareAudio_${pipeName}`;
        }
    }
}
exports.JsonRPC = JsonRPC;
//# sourceMappingURL=jsonRpc.js.map