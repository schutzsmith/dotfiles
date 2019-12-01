"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const os = require("os");
const skype_calling_electron_1 = require("@skype/skype-calling-electron");
const callingUtils_1 = require("../callingUtils");
const proxyTraceSource_1 = require("./proxyTraceSource");
class AppLogger {
    createChild(namespace, debug) {
        return this;
    }
    log(...values) {
        proxyTraceSource_1.proxyTraceSource.info(`[AppLogger] log: ${values}`);
    }
    debug(...values) {
        proxyTraceSource_1.proxyTraceSource.info(`[AppLogger] debug: ${values}`);
    }
    info(...values) {
        proxyTraceSource_1.proxyTraceSource.info(`[AppLogger] info: ${values}`);
    }
    warn(...values) {
        proxyTraceSource_1.proxyTraceSource.warn(`[AppLogger] warn: ${values}`);
    }
    error(...values) {
        proxyTraceSource_1.proxyTraceSource.error(`[AppLogger] error: ${values}`);
    }
}
class AppHooks {
    onDisplaysChanged(callback) {
        return { dispose: () => { } };
    }
    showSharingIndicator(regionOrWindowId) {
    }
    hideSharingIndicator() {
    }
    getControlInjector() {
        return {
            setInjectorConfig: (config) => Promise.resolve(),
            injectRawInput: (buffer, sourceId) => Promise.resolve(),
            setInjectionRect: (rect) => Promise.resolve(),
            allowSingleController: (sourceId) => Promise.resolve(),
            setAvatar: (base64Buffer, sourceId) => Promise.resolve(),
            dispose: () => { }
        };
    }
}
class ElectronStackProvider {
    build() {
        const platformId = callingUtils_1.PLATFORMS[`${window.process.platform}-${window.process.arch}`];
        proxyTraceSource_1.proxyTraceSource.info(`[ElectronStackProvider] PlatformId: ${platformId}`);
        if (!platformId) {
            throw new Error(`Platform ${window.process.platform}-${window.process.arch} not supported`);
        }
        // Use the default Live Share log directory for slimcore logging
        // If the temp directory doesn't exist the slimcore
        // native process will terminate unexpectedly
        const tempDir = path.join(os.tmpdir(), 'VSFeedbackVSRTCLogs');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        proxyTraceSource_1.proxyTraceSource.info(`[ElectronStackProvider] temp slimcore directory: ${tempDir}`);
        const slimCoreSettings = {
            dataPath: tempDir,
            mediaLogsPath: tempDir,
            logFileName: 'logger',
            version: `${platformId}/${callingUtils_1.getNormalizedVersion()}//`,
            isEncrypted: false
        };
        proxyTraceSource_1.proxyTraceSource.info(`[ElectronStackProvider] creating slimcore instance`);
        this.slimCoreInstance = global.SlimCore.createSlimCoreInstance(slimCoreSettings);
        proxyTraceSource_1.proxyTraceSource.info(this.slimCoreInstance);
        this.config = {
            appHooks: new AppHooks(),
            logger: new AppLogger(),
            settings: {
                enableDXVA: false,
                autoStopLocalVideo: false
            },
            slimCoreInstance: this.slimCoreInstance
        };
        return skype_calling_electron_1.slimCoreElectronStackFactory.build(this.config);
    }
    dispose() {
        if (this.slimCoreInstance) {
            this.slimCoreInstance.dispose();
            this.slimCoreInstance = null;
        }
        global.SlimCore = null;
        global.Enums = null;
    }
}
exports.ElectronStackProvider = ElectronStackProvider;
//# sourceMappingURL=electronStackProvider.js.map