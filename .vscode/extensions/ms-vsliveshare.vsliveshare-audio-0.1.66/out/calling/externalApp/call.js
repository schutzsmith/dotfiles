"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const proxyTraceSource_1 = require("./proxyTraceSource");
class Call {
    constructor(call) {
        this.call = call;
    }
    stop() {
        if (this.isActiveCall()) {
            this.call.stop()
                .then(() => proxyTraceSource_1.proxyTraceSource.info(`[Call] Call finished, state: ${this.call.state}, reason:${this.call.terminatedReason} `))
                .catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] stop failed: ${e}`));
        }
    }
    isMuted() {
        if (!this.call) {
            return true;
        }
        return (this.call.isMuted || this.call.isServerMuted);
    }
    mute() {
        if (this.isActiveCall()) {
            this.call.mute().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] mute failed: ${e}`));
        }
    }
    unmute() {
        if (this.isActiveCall()) {
            this.call.unmute().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] unmute failed: ${e}`));
        }
    }
    muteAll() {
        if (this.isActiveCall()) {
            this.call.muteParticipants(0 /* All */, []).catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] muteAll failed: ${e}`));
        }
    }
    muteSpeaker() {
        if (this.isActiveCall()) {
            this.call.muteSpeaker().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] muteSpeaker failed: ${e}`));
        }
    }
    unmuteSpeaker() {
        if (this.isActiveCall()) {
            this.call.unmuteSpeaker().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] unmuteSpeaker failed: ${e}`));
        }
    }
    hold() {
        if (this.isActiveCall()) {
            this.call.hold().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] hold failed: ${e}`));
        }
    }
    unhold() {
        if (this.isActiveCall()) {
            this.call.unhold().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] unhold failed: ${e}`));
        }
    }
    reconnect() {
        if (this.call) {
            this.call.reconnect().catch(e => proxyTraceSource_1.proxyTraceSource.error(`[Call] reconnect failed: ${e}`));
        }
    }
    getCall() {
        return this.call;
    }
    getCallInfo() {
        if (!this.call) {
            return null;
        }
        return {
            callId: this.call.callId,
            state: this.call.state,
            threadId: this.call.threadId
        };
    }
    isActiveCall() {
        return this.call &&
            (this.call.state !== 7 /* Disconnected */) &&
            (this.call.state !== 6 /* Disconnecting */);
    }
    dispose() {
        this.call = null;
    }
}
exports.default = Call;
//# sourceMappingURL=call.js.map