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
const electronApp_1 = require("./electronApp");
const appEvents_1 = require("./appEvents");
const proxyTraceSource_1 = require("./proxyTraceSource");
const electronApp = new electronApp_1.ElectronApp();
const loadSlimCore = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: loadSlimCore');
    return yield electronApp.loadSlimCore();
});
const initalizeStack = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: initalizeStack');
    return yield electronApp.initialize(event.skypeToken, event.displayName);
});
const startOrJoinCall = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: startOrJoinCall');
    return yield electronApp.connectToCall(event.groupContext);
});
const endCall = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: endCall');
    return yield electronApp.endAndCleanUpCurrentCall();
});
const enumerateDevices = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: enumerateDevices');
    return yield electronApp.enumerateDevices();
});
const getSelectedDevices = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: selectedDevices');
    return electronApp.getSelectedDevices();
});
const selectDevices = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: selectDevices');
    return electronApp.selectDevices(event.selectedDevices);
});
const muteOrUnmute = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: muteOrUnmute');
    return electronApp.muteOrUnmute(event.isMute, event.participant);
});
const getCurrentParticipants = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: currentParticipants');
    return yield electronApp.getCurrentParticipants();
});
const getDominantSpeakers = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: dominantSpeakers');
    return yield electronApp.getDominantSpeakers();
});
const isMuted = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: isMuted');
    return electronApp.isMuted();
});
const getCallInfo = (event) => __awaiter(this, void 0, void 0, function* () {
    proxyTraceSource_1.proxyTraceSource.info('Request: callInfo');
    return electronApp.getCallInfo();
});
window.onload = () => __awaiter(this, void 0, void 0, function* () {
    const appEvents = window.appEvents;
    appEvents.on(appEvents_1.RequestType.getCallInfo, getCallInfo);
    appEvents.on(appEvents_1.RequestType.getCurrentParticipants, getCurrentParticipants);
    appEvents.on(appEvents_1.RequestType.getDominantSpeakers, getDominantSpeakers);
    appEvents.on(appEvents_1.RequestType.endCall, endCall);
    appEvents.on(appEvents_1.RequestType.enumerateDevices, enumerateDevices);
    appEvents.on(appEvents_1.RequestType.initializeStackEvent, initalizeStack);
    appEvents.on(appEvents_1.RequestType.isMuted, isMuted);
    appEvents.on(appEvents_1.RequestType.loadSlimCore, loadSlimCore);
    appEvents.on(appEvents_1.RequestType.muteOrUnmute, muteOrUnmute);
    appEvents.on(appEvents_1.RequestType.selectDevices, selectDevices);
    appEvents.on(appEvents_1.RequestType.getSelectedDevices, getSelectedDevices);
    appEvents.on(appEvents_1.RequestType.startOrJoinCall, startOrJoinCall);
    electronApp.callChangedEventEmitter.on(appEvents_1.NotificationType.callChanged, (event) => {
        appEvents.sendNotification(event);
    });
    yield appEvents.sendNotification(new appEvents_1.ElectronAppReady());
});
window.onbeforeunload = () => {
    electronApp.dispose();
};
//# sourceMappingURL=index.js.map