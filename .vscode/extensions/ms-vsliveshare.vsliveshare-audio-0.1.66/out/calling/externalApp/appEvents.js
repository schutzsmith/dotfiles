"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CallChangedType;
(function (CallChangedType) {
    CallChangedType[CallChangedType["callStarted"] = 0] = "callStarted";
    CallChangedType[CallChangedType["muteChanged"] = 1] = "muteChanged";
    CallChangedType[CallChangedType["participantChanged"] = 2] = "participantChanged";
    CallChangedType[CallChangedType["participantsChanged"] = 3] = "participantsChanged";
})(CallChangedType = exports.CallChangedType || (exports.CallChangedType = {}));
var RequestType;
(function (RequestType) {
    RequestType["getCallInfo"] = "getCallInfo";
    RequestType["getCurrentParticipants"] = "getCurrentParticipants";
    RequestType["getDominantSpeakers"] = "getDominantSpeakers";
    RequestType["endCall"] = "endCall";
    RequestType["enumerateDevices"] = "enumerateDevices";
    RequestType["initializeStackEvent"] = "initializeStackEvent";
    RequestType["isMuted"] = "isMuted";
    RequestType["loadSlimCore"] = "loadSlimCore";
    RequestType["muteOrUnmute"] = "muteOrUnmute";
    RequestType["selectDevices"] = "selectDevices";
    RequestType["getSelectedDevices"] = "getSelectedDevices";
    RequestType["startOrJoinCall"] = "startOrJoinCall";
})(RequestType = exports.RequestType || (exports.RequestType = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["callChanged"] = "callChanged";
    NotificationType["electronAppReady"] = "electronAppReady";
    NotificationType["trace"] = "trace";
})(NotificationType = exports.NotificationType || (exports.NotificationType = {}));
var TraceType;
(function (TraceType) {
    TraceType[TraceType["error"] = 0] = "error";
    TraceType[TraceType["info"] = 1] = "info";
    TraceType[TraceType["warning"] = 2] = "warning";
})(TraceType = exports.TraceType || (exports.TraceType = {}));
class AppEvents {
    constructor(jsonRPCProxy) {
        this.jsonRPCProxy = jsonRPCProxy;
    }
    get isDisposed() {
        return this.jsonRPCProxy.isDisposed;
    }
    on(eventType, func) {
        this.jsonRPCProxy.on(eventType, func);
    }
    sendRequest(event) {
        return this.jsonRPCProxy.sendRequest(event);
    }
    sendNotification(event) {
        return this.jsonRPCProxy.sendNotification(event);
    }
    dispose() {
        this.jsonRPCProxy.dispose();
    }
}
exports.AppEvents = AppEvents;
class CallChanged {
    constructor(changeType, callParticipant, callInfo) {
        this.changeType = changeType;
        this.callParticipant = callParticipant;
        this.callInfo = callInfo;
        this.eventType = NotificationType.callChanged;
    }
}
exports.CallChanged = CallChanged;
class GetCallInfo {
    constructor() {
        this.eventType = RequestType.getCallInfo;
    }
}
exports.GetCallInfo = GetCallInfo;
class GetCurrentParticipants {
    constructor() {
        this.eventType = RequestType.getCurrentParticipants;
    }
}
exports.GetCurrentParticipants = GetCurrentParticipants;
class GetDominantSpeakers {
    constructor() {
        this.eventType = RequestType.getDominantSpeakers;
    }
}
exports.GetDominantSpeakers = GetDominantSpeakers;
class ElectronAppReady {
    constructor() {
        this.eventType = NotificationType.electronAppReady;
    }
}
exports.ElectronAppReady = ElectronAppReady;
class EndCall {
    constructor() {
        this.eventType = RequestType.endCall;
    }
}
exports.EndCall = EndCall;
class EnumerateDevices {
    constructor() {
        this.eventType = RequestType.enumerateDevices;
    }
}
exports.EnumerateDevices = EnumerateDevices;
class InitializeStackEvent {
    constructor(skypeToken, displayName) {
        this.skypeToken = skypeToken;
        this.displayName = displayName;
        this.eventType = RequestType.initializeStackEvent;
    }
}
exports.InitializeStackEvent = InitializeStackEvent;
class IsMuted {
    constructor() {
        this.eventType = RequestType.isMuted;
    }
}
exports.IsMuted = IsMuted;
class LoadSlimCore {
    constructor() {
        this.eventType = RequestType.loadSlimCore;
    }
}
exports.LoadSlimCore = LoadSlimCore;
class MuteOrUnmute {
    constructor(isMute, participant) {
        this.isMute = isMute;
        this.participant = participant;
        this.eventType = RequestType.muteOrUnmute;
    }
}
exports.MuteOrUnmute = MuteOrUnmute;
class SelectDevices {
    constructor(selectedDevices) {
        this.selectedDevices = selectedDevices;
        this.eventType = RequestType.selectDevices;
    }
}
exports.SelectDevices = SelectDevices;
class GetSelectedDevices {
    constructor() {
        this.eventType = RequestType.getSelectedDevices;
    }
}
exports.GetSelectedDevices = GetSelectedDevices;
class StartOrJoinCall {
    constructor(groupContext) {
        this.groupContext = groupContext;
        this.eventType = RequestType.startOrJoinCall;
    }
}
exports.StartOrJoinCall = StartOrJoinCall;
class Trace {
    constructor(traceType, message) {
        this.traceType = traceType;
        this.message = message;
        this.eventType = NotificationType.trace;
        if (typeof message !== 'string') {
            this.message = '';
        }
    }
}
exports.Trace = Trace;
//# sourceMappingURL=appEvents.js.map