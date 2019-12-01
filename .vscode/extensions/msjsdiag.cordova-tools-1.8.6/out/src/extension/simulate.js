"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const path = require("path");
const cordova_simulate_1 = require("cordova-simulate");
const cordovaSimulateTelemetry_1 = require("../utils/cordovaSimulateTelemetry");
const cordovaProjectHelper_1 = require("../utils/cordovaProjectHelper");
const vscode = require("vscode");
/**
 * Plugin simulation entry point.
 */
class PluginSimulator {
    simulate(fsPath, simulateOptions, projectType) {
        return this.launchServer(fsPath, simulateOptions, projectType)
            .then(() => this.launchSimHost(simulateOptions.target))
            .then(() => this.launchAppHost(simulateOptions.target));
    }
    launchAppHost(target) {
        return cordova_simulate_1.launchBrowser(target, this.simulationInfo.appHostUrl);
    }
    launchSimHost(target) {
        if (!this.simulator) {
            return Q.reject(new Error("Launching sim host before starting simulation server"));
        }
        return Q(cordova_simulate_1.launchBrowser(target, this.simulator.simHostUrl()));
    }
    launchServer(fsPath, simulateOptions, projectType) {
        const uri = vscode.Uri.file(fsPath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        simulateOptions.dir = workspaceFolder.uri.fsPath;
        if (!simulateOptions.simulationpath) {
            simulateOptions.simulationpath = path.join(workspaceFolder.uri.fsPath, ".vscode", "simulate");
        }
        return Q({}).then(() => {
            if (this.isServerRunning()) {
                /* close the server old instance */
                return this.simulator.stopSimulation();
            }
        })
            .then(() => {
            let simulateTelemetryWrapper = new cordovaSimulateTelemetry_1.CordovaSimulateTelemetry();
            simulateOptions.telemetry = simulateTelemetryWrapper;
            this.simulator = new cordova_simulate_1.Simulator(simulateOptions);
            let platforms = cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlatforms(workspaceFolder.uri.fsPath);
            let platform = simulateOptions.platform;
            let isPlatformMissing = platform && platforms.indexOf(platform) < 0;
            if (isPlatformMissing) {
                let command = "cordova";
                if (projectType.ionic || projectType.ionic2 || projectType.ionic4) {
                    const isIonicCliVersionGte3 = cordovaProjectHelper_1.CordovaProjectHelper.isIonicCliVersionGte3(workspaceFolder.uri.fsPath);
                    command = "ionic" + (isIonicCliVersionGte3 ? " cordova" : "");
                }
                throw new Error(`Couldn't find platform ${platform} in project, please install it using '${command} platform add ${platform}'`);
            }
            return this.simulator.startSimulation()
                .then(() => {
                if (!this.simulator.isRunning()) {
                    throw new Error("Error starting the simulation");
                }
                this.simulationInfo = {
                    appHostUrl: this.simulator.appUrl(),
                    simHostUrl: this.simulator.simHostUrl(),
                    urlRoot: this.simulator.urlRoot(),
                };
                if (projectType.ionic2 && platform && platform !== "browser") {
                    this.simulationInfo.appHostUrl = `${this.simulationInfo.appHostUrl}?ionicplatform=${simulateOptions.platform}`;
                }
                return this.simulationInfo;
            });
        });
    }
    dispose() {
        if (this.registration) {
            this.registration.dispose();
            this.registration = null;
        }
        if (this.simulator) {
            this.simulator.stopSimulation().done(() => { }, () => { });
            this.simulator = null;
        }
    }
    isServerRunning() {
        return this.simulator && this.simulator.isRunning();
    }
}
exports.PluginSimulator = PluginSimulator;

//# sourceMappingURL=simulate.js.map
