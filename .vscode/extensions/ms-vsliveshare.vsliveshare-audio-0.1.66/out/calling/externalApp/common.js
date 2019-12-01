"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DeferredPromise {
    constructor() {
        let deferredResolve;
        let deferredReject;
        this.promise = new Promise((resolve, reject) => {
            deferredResolve = resolve;
            deferredReject = reject;
        });
        this.deferredReject = deferredReject;
        this.deferredResolve = deferredResolve;
    }
    resolve(data) {
        this.deferredResolve(data);
    }
    reject(error) {
        this.deferredReject(error);
    }
}
exports.DeferredPromise = DeferredPromise;
//# sourceMappingURL=common.js.map