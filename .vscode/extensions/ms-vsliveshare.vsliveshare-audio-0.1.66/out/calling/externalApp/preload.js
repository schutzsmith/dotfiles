"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const appEvents_1 = require("./appEvents");
const jsonRpc_1 = require("./jsonRpc");
const proxyTraceSource_1 = require("./proxyTraceSource");
console.log(`[Preload] pid: ${process.pid}`);
const { remote } = require('electron');
if (!remote.process.argv || remote.process.argv.length < 4) {
    throw new Error('[Preload] required arguments not specified');
}
const dynamicLoader = require('dynamicloader');
const slimCorePath = remote.process.argv[2];
const slimCore = dynamicLoader.load(slimCorePath);
const videoRendererPath = path.join(slimCorePath, 'lib/video-renderer');
const videoRenderer = dynamicLoader.load(videoRendererPath);
console.log(`[Preload] videoRenderer: ${videoRenderer}`);
const controlInjectorPath = path.join(slimCorePath, 'lib/sharing-indicator');
const controlInjector = dynamicLoader.load(controlInjectorPath);
console.log(`[Preload] controlInjector: ${controlInjector}`);
window.SlimCore = slimCore;
window.Enums = slimCore.Enums;
window.VideoRenderer = videoRenderer;
window.ControlInjector = controlInjector;
const ipcPipeName = remote.process.argv[3];
console.log(`[Preload] JsonRPC IPC PipeName: ${ipcPipeName}`);
const jsonRPCProxy = new jsonRpc_1.JsonRPC(ipcPipeName, proxyTraceSource_1.proxyTraceSource);
const appEvents = new appEvents_1.AppEvents(jsonRPCProxy);
window.appEvents = appEvents;
console.log(`[Preload] Completed`);
//# sourceMappingURL=preload.js.map