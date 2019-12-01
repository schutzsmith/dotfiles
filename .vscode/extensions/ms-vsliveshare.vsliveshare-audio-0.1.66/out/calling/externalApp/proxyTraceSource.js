"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appEvents_1 = require("./appEvents");
class ProxyTraceSource {
    error(message) {
        console.error(message);
        const appEvents = this.getAppEvents();
        if (!appEvents) {
            return;
        }
        const event = new appEvents_1.Trace(appEvents_1.TraceType.error, message);
        appEvents.sendNotification(event);
    }
    info(message) {
        console.log(message);
        const appEvents = this.getAppEvents();
        if (!appEvents) {
            return;
        }
        const event = new appEvents_1.Trace(appEvents_1.TraceType.info, message);
        appEvents.sendNotification(event);
    }
    warn(message) {
        console.warn(message);
        const appEvents = this.getAppEvents();
        if (!appEvents) {
            return;
        }
        const event = new appEvents_1.Trace(appEvents_1.TraceType.warning, message);
        appEvents.sendNotification(event);
    }
    getAppEvents() {
        return window.appEvents;
    }
}
exports.ProxyTraceSource = ProxyTraceSource;
exports.proxyTraceSource = new ProxyTraceSource();
//# sourceMappingURL=proxyTraceSource.js.map