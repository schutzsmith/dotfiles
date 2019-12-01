"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const Q = require("q");
const os = require("os");
const util = require("util");
const vscode_1 = require("vscode");
const telemetryHelper_1 = require("./telemetryHelper");
const outputChannelLogger_1 = require("./outputChannelLogger");
const cordovaProjectHelper_1 = require("./cordovaProjectHelper");
class CordovaCommandHelper {
    static executeCordovaCommand(projectRoot, command, useIonic = false) {
        let telemetryEventName = CordovaCommandHelper.CORDOVA_TELEMETRY_EVENT_NAME;
        let cliCommandName = CordovaCommandHelper.CORDOVA_CMD_NAME;
        let cliDisplayName = CordovaCommandHelper.CORDOVA_DISPLAY_NAME;
        if (useIonic) {
            telemetryEventName = CordovaCommandHelper.IONIC_TELEMETRY_EVENT_NAME;
            cliCommandName = CordovaCommandHelper.IONIC_CMD_NAME;
            cliDisplayName = CordovaCommandHelper.IONIC_DISPLAY_NAME;
        }
        return CordovaCommandHelper.selectPlatform(projectRoot, command)
            .then((platform) => {
            telemetryHelper_1.TelemetryHelper.generate(telemetryEventName, (generator) => {
                generator.add("command", command, false);
                let logger = outputChannelLogger_1.OutputChannelLogger.getMainChannel();
                let commandToExecute;
                if (useIonic && ["run", "prepare"].indexOf(command) > -1) {
                    commandToExecute = `${cliCommandName} cordova ${command}`;
                }
                else {
                    commandToExecute = `${cliCommandName} ${command}`;
                }
                if (platform) {
                    commandToExecute += ` ${platform}`;
                    // Workaround for dealing with new build system in XCode 10
                    // https://github.com/apache/cordova-ios/issues/407
                    if (platform === "ios") {
                        commandToExecute += " --buildFlag='-UseModernBuildSystem=0'";
                    }
                }
                const runArgs = CordovaCommandHelper.getRunArguments(projectRoot);
                if (runArgs.length) {
                    commandToExecute += ` ${runArgs.join(" ")}`;
                }
                logger.log(`########### EXECUTING: ${commandToExecute} ###########`);
                const env = cordovaProjectHelper_1.CordovaProjectHelper.getEnvArgument({
                    env: CordovaCommandHelper.getEnvArgs(projectRoot),
                    envFile: CordovaCommandHelper.getEnvFile(projectRoot),
                });
                let process = child_process.exec(commandToExecute, { cwd: projectRoot, env });
                let deferred = Q.defer();
                process.on("error", (err) => {
                    // ENOENT error will be thrown if no Cordova.cmd or ionic.cmd is found
                    if (err.code === "ENOENT") {
                        vscode_1.window.showErrorMessage(util.format("%s not found, please run \"npm install –g %s\" to install %s globally", cliDisplayName, cliDisplayName.toLowerCase(), cliDisplayName));
                    }
                    deferred.reject(err);
                });
                process.stderr.on("data", (data) => {
                    logger.append(data);
                });
                process.stdout.on("data", (data) => {
                    logger.append(data);
                });
                process.stdout.on("close", () => {
                    logger.log(`########### FINISHED EXECUTING: ${commandToExecute} ###########`);
                    deferred.resolve({});
                });
                return telemetryHelper_1.TelemetryHelper.determineProjectTypes(projectRoot)
                    .then((projectType) => generator.add("projectType", projectType, false))
                    .then(() => deferred.promise);
            });
        });
    }
    /**
     * Get command line run arguments from settings.json
     */
    static getRunArguments(fsPath) {
        return CordovaCommandHelper.getSetting(fsPath, "runArguments") || [];
    }
    static getCordovaExecutable(fsPath) {
        return CordovaCommandHelper.getSetting(fsPath, "cordovaExecutable") || "";
    }
    static getEnvArgs(fsPath) {
        return CordovaCommandHelper.getSetting(fsPath, "env");
    }
    static getEnvFile(fsPath) {
        return CordovaCommandHelper.getSetting(fsPath, "envFile") || "";
    }
    static getSetting(fsPath, configKey) {
        let uri = vscode_1.Uri.file(fsPath);
        const workspaceConfiguration = vscode_1.workspace.getConfiguration("cordova", uri);
        if (workspaceConfiguration.has(configKey)) {
            return workspaceConfiguration.get(configKey);
        }
    }
    static selectPlatform(projectRoot, command) {
        let platforms = cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlatforms(projectRoot);
        platforms = CordovaCommandHelper.filterAvailablePlatforms(platforms);
        return Q({})
            .then(() => {
            if (["prepare", "build", "run"].indexOf(command) > -1) {
                if (platforms.length > 1) {
                    platforms.unshift("all");
                    return vscode_1.window.showQuickPick(platforms)
                        .then((platform) => {
                        if (!platform) {
                            throw new Error("Platform selection was canceled. Please select target platform to continue!");
                        }
                        if (platform === "all") {
                            return "";
                        }
                        return platform;
                    });
                }
                else if (platforms.length === 1) {
                    return platforms[0];
                }
                else {
                    throw new Error("No any platforms installed");
                }
            }
            return "";
        });
    }
    static filterAvailablePlatforms(platforms) {
        const osPlatform = os.platform();
        return platforms.filter((platform) => {
            switch (platform) {
                case "ios":
                case "osx":
                    return osPlatform === "darwin";
                case "windows":
                    return osPlatform === "win32";
                default:
                    return true;
            }
        });
    }
}
CordovaCommandHelper.CORDOVA_CMD_NAME = os.platform() === "win32" ? "cordova.cmd" : "cordova";
CordovaCommandHelper.IONIC_CMD_NAME = os.platform() === "win32" ? "ionic.cmd" : "ionic";
CordovaCommandHelper.CORDOVA_TELEMETRY_EVENT_NAME = "cordovaCommand";
CordovaCommandHelper.IONIC_TELEMETRY_EVENT_NAME = "ionicCommand";
CordovaCommandHelper.CORDOVA_DISPLAY_NAME = "Cordova";
CordovaCommandHelper.IONIC_DISPLAY_NAME = "Ionic";
exports.CordovaCommandHelper = CordovaCommandHelper;

//# sourceMappingURL=cordovaCommandHelper.js.map
