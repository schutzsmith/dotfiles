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
const electronStackProvider_1 = require("./electronStackProvider");
const _ = require("lodash");
const call_1 = require("./call");
const appEvents_1 = require("./appEvents");
const EventEmitter = require("events");
const proxyTraceSource_1 = require("./proxyTraceSource");
class ElectronApp {
    constructor() {
        this.currentCallParticipants = {};
        this.callChangedEventEmitter = new EventEmitter();
    }
    loadSlimCore() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] loadSlimCore`);
                this.stackProvider = new electronStackProvider_1.ElectronStackProvider();
                this.callingStack = yield this.stackProvider.build();
                this.config = this.stackProvider.config;
                proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] loaded slimcore`);
            }
            catch (e) {
                proxyTraceSource_1.proxyTraceSource.error(`[ElectronApp] failed to load slimcore: ${e}`);
                throw e;
            }
        });
    }
    initialize(skypeToken, displayName) {
        return __awaiter(this, void 0, void 0, function* () {
            proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] create callRegistry`);
            this.callRegistry = this.callingStack.getCallRegistry();
            proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] init callRegistry`);
            yield this.callRegistry.init({
                displayName: displayName, id: skypeToken.skypeId, tokenProvider: () => {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] return token`);
                    return Promise.resolve(skypeToken.skypeToken);
                }
            });
            proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] get DeviceManager`);
            this.deviceManager = this.callingStack.getDeviceManager();
            proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] done`);
            return new Promise((resolve, reject) => {
                setTimeout(() => resolve(), 1500);
            });
        });
    }
    endAndCleanUpCurrentCall() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.currentCall) {
                return;
            }
            try {
                yield this.currentCall.stop();
            }
            finally {
                this.dispose();
            }
        });
    }
    enumerateDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.deviceManager) {
                return [];
            }
            const devices = yield this.deviceManager.enumerateDevicesAsync();
            proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] finished enumerating devices: ${devices}`);
            return devices;
        });
    }
    getSelectedDevices() {
        if (!this.deviceManager) {
            return;
        }
        return this.deviceManager.getSelectedDevices();
    }
    getCurrentParticipants() {
        return this.currentCallParticipants ? _.map(this.currentCallParticipants, (x) => {
            return {
                displayName: x.displayName,
                id: x.id,
                isServerMuted: x.isServerMuted,
                voiceLevel: x.voiceLevel
            };
        }) : [];
    }
    getDominantSpeakers() {
        if (!this.currentCall) {
            return [];
        }
        return _.map(this.currentCall.dominantSpeakerInfo.speakerList, (x) => {
            const participant = this.currentCallParticipants[x];
            return {
                displayName: participant.displayName,
                id: participant.id,
                isServerMuted: participant.isServerMuted,
                voiceLevel: participant.voiceLevel
            };
        });
    }
    selectDevices(selectedDevices) {
        if (!this.deviceManager) {
            return;
        }
        return this.deviceManager.selectDevices(selectedDevices);
    }
    isMuted() {
        if (!this.callWrapper) {
            return true;
        }
        return this.callWrapper.isMuted();
    }
    connectToCall(groupContext) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentCall) {
                proxyTraceSource_1.proxyTraceSource.warn(`[ElectronApp] Already connected to a call`);
                return this.endAndCleanUpCurrentCall().then(() => {
                    return Promise.reject(new Error('Already connected to a call. Ending current call. Please retry audio join'));
                });
            }
            try {
                proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] Connecting to call with group context: ${groupContext}`);
                const call = this.callRegistry.createCall(groupContext);
                call.init({ threadId: groupContext, mediaPeerType: 2 /* ConsumerMultiParty */ });
                call.on('participantAdded', () => __awaiter(this, void 0, void 0, function* () {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] participantAdded`);
                    _.forEach(call.participants, (participant) => __awaiter(this, void 0, void 0, function* () {
                        if (!(participant.id in this.currentCallParticipants)) {
                            this.currentCallParticipants[participant.id] = participant;
                            const event = new appEvents_1.CallChanged(appEvents_1.CallChangedType.participantsChanged);
                            this.callChangedEventEmitter.emit(appEvents_1.NotificationType.callChanged, event);
                        }
                    }));
                }));
                call.on('participantRemoved', () => {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] participantRemoved`);
                    const stillInCall = {};
                    _.forEach(call.participants, (participant) => {
                        stillInCall[participant.id] = participant;
                    });
                    let toRemove = [];
                    _.forEach(Object.keys(this.currentCallParticipants), (participantId) => {
                        if (!(participantId in stillInCall)) {
                            toRemove.push(this.currentCallParticipants[participantId]);
                        }
                    });
                    _.forEach(toRemove, (participant) => {
                        delete this.currentCallParticipants[participant.id];
                        const event = new appEvents_1.CallChanged(appEvents_1.CallChangedType.participantsChanged);
                        this.callChangedEventEmitter.emit(appEvents_1.NotificationType.callChanged, event);
                    });
                    toRemove = null;
                });
                call.on('serverMutedChanged', (isServerMuted) => {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] serverMutedChanged: ${isServerMuted}`);
                    const event = new appEvents_1.CallChanged(appEvents_1.CallChangedType.muteChanged, /*callParticipant*/ null);
                    this.callChangedEventEmitter.emit(appEvents_1.NotificationType.callChanged, event);
                });
                call.on('participantUpdated', (participant) => {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] participantUpdated`);
                    const participantInfo = {
                        displayName: participant.displayName,
                        id: participant.id,
                        isServerMuted: participant.isServerMuted,
                        voiceLevel: participant.voiceLevel
                    };
                    const event = new appEvents_1.CallChanged(appEvents_1.CallChangedType.participantChanged, participantInfo);
                    this.callChangedEventEmitter.emit(appEvents_1.NotificationType.callChanged, event);
                });
                call.on('callStateChanged', () => {
                    proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] callStateChanged: ${call.state}`);
                    switch (call.state) {
                        case 3 /* Connected */:
                            {
                                proxyTraceSource_1.proxyTraceSource.info(`[ElectronApp] callStateChanged: connected to call`);
                                const callInfo = {
                                    threadId: call.threadId,
                                    callId: call.callId,
                                    state: call.state
                                };
                                const event = new appEvents_1.CallChanged(appEvents_1.CallChangedType.callStarted, null, callInfo);
                                this.callChangedEventEmitter.emit(appEvents_1.NotificationType.callChanged, event);
                            }
                            break;
                        default:
                            return;
                    }
                });
                this.currentCall = call;
                yield call.start({ screenshareDirection: 0 /* Disabled */ });
                this.callWrapper = new call_1.default(call);
            }
            catch (e) {
                proxyTraceSource_1.proxyTraceSource.error(`[ElectronApp] error while connecting to call: ${e.message}`);
                throw e;
            }
        });
    }
    muteOrUnmute(isMute, participantInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.currentCall) {
                return;
            }
            let mutedParticipants;
            if (!participantInfo) {
                // Mute or unmute my own microphone.
                return isMute ? yield this.currentCall.mute() : yield this.currentCall.unmute();
            }
            // Find the participant associated with the participant info
            const participant = _.find(this.currentCallParticipants, (x) => (x.id === participantInfo.id));
            if (!participant) {
                return;
            }
            // Mute or unmute a participant.
            mutedParticipants = _.filter(this.currentCallParticipants, p => p.isServerMuted);
            const index = mutedParticipants.indexOf(participant);
            if (isMute && index < 0) {
                // Add the participant to the list of muted participants.
                mutedParticipants.push(participant);
            }
            else if (!isMute && index >= 0) {
                // Remove the participant from the list of muted participants.
                mutedParticipants.splice(index, 1);
            }
            yield this.currentCall.muteParticipants(1 /* Specified */, mutedParticipants);
        });
    }
    getCallInfo() {
        if (!this.callWrapper) {
            return;
        }
        return this.callWrapper.getCallInfo();
    }
    dispose() {
        if (this.callWrapper) {
            this.callWrapper.dispose();
            this.callWrapper = null;
        }
        if (this.stackProvider) {
            this.stackProvider.dispose();
            this.stackProvider = null;
        }
        this.callingStack = null;
        this.callRegistry = null;
        this.currentCall = null;
        this.deviceManager = null;
        this.config = null;
        this.currentCallParticipants = {};
    }
}
exports.ElectronApp = ElectronApp;
//# sourceMappingURL=electronApp.js.map