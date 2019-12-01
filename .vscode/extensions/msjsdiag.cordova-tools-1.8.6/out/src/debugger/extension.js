"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const cordovaProjectHelper_1 = require("../utils/cordovaProjectHelper");
const Q = require("q");
const path = require("path");
const util = require("util");
// suppress the following strings because they are not actual errors:
const errorsToSuppress = ["Run an Ionic project on a connected device"];
function execCommand(command, args, errorLogger) {
    let deferred = Q.defer();
    let proc = child_process.spawn(command, args, { stdio: "pipe" });
    let stderr = "";
    let stdout = "";
    proc.stderr.on("data", (data) => {
        stderr += data.toString();
    });
    proc.stdout.on("data", (data) => {
        stdout += data.toString();
    });
    proc.on("error", (err) => {
        deferred.reject(err);
    });
    proc.on("close", (code) => {
        if (code !== 0) {
            errorLogger(stderr);
            errorLogger(stdout);
            deferred.reject(`Error running '${command} ${args.join(" ")}'`);
        }
        deferred.resolve(stdout);
    });
    return deferred.promise;
}
exports.execCommand = execCommand;
function cordovaRunCommand(command, args, env, cordovaRootPath) {
    let defer = Q.defer();
    let isIonicProject = cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaRootPath);
    let output = "";
    let stderr = "";
    let cordovaProcess = cordovaStartCommand(command, args, env, cordovaRootPath);
    // Prevent these lines to be shown more than once
    // to prevent debug console pollution
    let isShown = {
        "Running command": false,
        "cordova prepare": false,
        "cordova platform add": false,
    };
    cordovaProcess.stderr.on("data", data => {
        stderr += data.toString();
        for (let i = 0; i < errorsToSuppress.length; i++) {
            if (data.toString().indexOf(errorsToSuppress[i]) >= 0) {
                return;
            }
        }
        defer.notify([data.toString(), "stderr"]);
    });
    cordovaProcess.stdout.on("data", (data) => {
        let str = data.toString().replace(/\u001b/g, "").replace(/\[2K\[G/g, ""); // Erasing `[2K[G` artifacts from DEBUG CONSOLE output
        output += str;
        for (let message in isShown) {
            if (str.indexOf(message) > -1) {
                if (!isShown[message]) {
                    isShown[message] = true;
                    defer.notify([str, "stdout"]);
                }
                return;
            }
        }
        defer.notify([str, "stdout"]);
        if (isIonicProject && str.indexOf("LAUNCH SUCCESS") >= 0) {
            defer.resolve([output, stderr]);
        }
    });
    cordovaProcess.on("exit", exitCode => {
        if (exitCode) {
            defer.reject(new Error(util.format("'%s %s' failed with exit code %d", command, args.join(" "), exitCode)));
        }
        else {
            defer.resolve([output, stderr]);
        }
    });
    cordovaProcess.on("error", error => {
        defer.reject(error);
    });
    return defer.promise;
}
exports.cordovaRunCommand = cordovaRunCommand;
function cordovaStartCommand(command, args, env, cordovaRootPath) {
    const isIonic = cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaRootPath);
    const isIonicServe = args.indexOf("serve") >= 0;
    if (isIonic && !isIonicServe) {
        const isIonicCliVersionGte3 = cordovaProjectHelper_1.CordovaProjectHelper.isIonicCliVersionGte3(cordovaRootPath, command);
        if (isIonicCliVersionGte3) {
            args.unshift("cordova");
        }
    }
    if (isIonic) {
        args.push("--no-interactive");
    }
    else {
        args.push("--no-update-notifier");
    }
    return child_process.spawn(command, args, { cwd: cordovaRootPath, env });
}
exports.cordovaStartCommand = cordovaStartCommand;
function killTree(processId) {
    const cmd = process.platform === "win32" ?
        `taskkill.exe /F /T /PID` :
        path.join(__dirname, "../../../scripts/terminateProcess.sh");
    try {
        child_process.execSync(`${cmd} ${processId}`);
    }
    catch (err) {
    }
}
exports.killTree = killTree;
function killChildProcess(childProcess) {
    killTree(childProcess.pid);
    return Q(void 0);
}
exports.killChildProcess = killChildProcess;

//# sourceMappingURL=extension.js.map
