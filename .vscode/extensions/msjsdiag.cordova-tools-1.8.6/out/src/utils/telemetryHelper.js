"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:no-use-before-declare */
const cordovaProjectHelper_1 = require("./cordovaProjectHelper");
const fs = require("fs");
const path = require("path");
const Q = require("q");
const telemetry_1 = require("./telemetry");
class TelemetryGeneratorBase {
    constructor(componentName) {
        this.telemetryProperties = {};
        this.currentStep = "initialStep";
        this.errorIndex = -1; // In case we have more than one error (We start at -1 because we increment it before using it)
        this.componentName = componentName;
        this.currentStepStartTime = process.hrtime();
    }
    add(baseName, value, isPii) {
        return this.addWithPiiEvaluator(baseName, value, () => isPii);
    }
    addWithPiiEvaluator(baseName, value, piiEvaluator) {
        // We have 3 cases:
        //     * Object is an array, we add each element as baseNameNNN
        //     * Object is a hash, we add each element as baseName.KEY
        //     * Object is a value, we add the element as baseName
        try {
            if (Array.isArray(value)) {
                this.addArray(baseName, value, piiEvaluator);
            }
            else if (!!value && (typeof value === "object" || typeof value === "function")) {
                this.addHash(baseName, value, piiEvaluator);
            }
            else {
                this.addString(baseName, String(value), piiEvaluator);
            }
        }
        catch (error) {
            // We don't want to crash the functionality if the telemetry fails.
            // This error message will be a javascript error message, so it's not pii
            this.addString("telemetryGenerationError." + baseName, String(error), () => false);
        }
        return this;
    }
    addError(error) {
        this.add("error.message" + ++this.errorIndex, error.message, /*isPii*/ true);
        let errorWithErrorCode = error;
        if (errorWithErrorCode.errorCode) {
            this.add("error.code" + this.errorIndex, errorWithErrorCode.errorCode, /*isPii*/ false);
        }
        return this;
    }
    time(name, codeToMeasure) {
        let startTime = process.hrtime();
        return Q(codeToMeasure()).finally(() => this.finishTime(name, startTime)).fail((reason) => {
            this.addError(reason);
            throw reason;
        });
    }
    step(name) {
        // First we finish measuring this step time, and we send a telemetry event for this step
        this.finishTime(this.currentStep, this.currentStepStartTime);
        this.sendCurrentStep();
        // Then we prepare to start gathering information about the next step
        this.currentStep = name;
        this.telemetryProperties = {};
        this.currentStepStartTime = process.hrtime();
        return this;
    }
    send() {
        if (this.currentStep) {
            this.add("lastStepExecuted", this.currentStep, /*isPii*/ false);
        }
        this.step(null); // Send the last step
    }
    getTelemetryProperties() {
        return this.telemetryProperties;
    }
    sendCurrentStep() {
        this.add("step", this.currentStep, /*isPii*/ false);
        let telemetryEvent = new telemetry_1.Telemetry.TelemetryEvent(this.componentName);
        TelemetryHelper.addTelemetryEventProperties(telemetryEvent, this.telemetryProperties);
        this.sendTelemetryEvent(telemetryEvent);
    }
    addArray(baseName, array, piiEvaluator) {
        // Object is an array, we add each element as baseNameNNN
        let elementIndex = 1; // We send telemetry properties in a one-based index
        array.forEach((element) => this.addWithPiiEvaluator(baseName + elementIndex++, element, piiEvaluator));
    }
    addHash(baseName, hash, piiEvaluator) {
        // Object is a hash, we add each element as baseName.KEY
        Object.keys(hash).forEach((key) => this.addWithPiiEvaluator(baseName + "." + key, hash[key], piiEvaluator));
    }
    addString(name, value, piiEvaluator) {
        this.telemetryProperties[name] = TelemetryHelper.telemetryProperty(value, piiEvaluator(value, name));
    }
    combine(...components) {
        let nonNullComponents = components.filter((component) => component !== null);
        return nonNullComponents.join(".");
    }
    finishTime(name, startTime) {
        let endTime = process.hrtime(startTime);
        this.add(this.combine(name, "time"), String(endTime[0] * 1000 + endTime[1] / 1000000), /*isPii*/ false);
    }
}
exports.TelemetryGeneratorBase = TelemetryGeneratorBase;
class TelemetryGenerator extends TelemetryGeneratorBase {
    sendTelemetryEvent(telemetryEvent) {
        telemetry_1.Telemetry.send(telemetryEvent);
    }
}
exports.TelemetryGenerator = TelemetryGenerator;
class TelemetryHelper {
    static createTelemetryEvent(eventName) {
        return new telemetry_1.Telemetry.TelemetryEvent(eventName);
    }
    static createTelemetryActivity(eventName) {
        return new telemetry_1.Telemetry.TelemetryActivity(eventName);
    }
    static determineProjectTypes(projectRoot) {
        let promiseExists = (file) => {
            let deferred = Q.defer();
            fs.exists(file, (exist) => deferred.resolve(exist));
            return deferred.promise;
        };
        let isIonic1 = cordovaProjectHelper_1.CordovaProjectHelper.isIonic1Project(projectRoot);
        let isIonic2 = cordovaProjectHelper_1.CordovaProjectHelper.isIonic2Project(projectRoot);
        let isIonic4 = cordovaProjectHelper_1.CordovaProjectHelper.isIonic4Project(projectRoot);
        let meteor = promiseExists(path.join(projectRoot, ".meteor"));
        let mobilefirst = promiseExists(path.join(projectRoot, ".project"));
        let phonegap = promiseExists(path.join(projectRoot, "www", "res", ".pgbomit"));
        let cordova = promiseExists(path.join(projectRoot, "config.xml"));
        return Q.all([meteor, mobilefirst, phonegap, cordova])
            .spread((isMeteor, isMobilefirst, isPhonegap, isCordova) => {
            return { ionic: isIonic1, ionic2: isIonic2, ionic4: isIonic4, meteor: isMeteor, mobilefirst: isMobilefirst, phonegap: isPhonegap, cordova: isCordova };
        });
    }
    static telemetryProperty(propertyValue, pii) {
        return { value: String(propertyValue), isPii: pii || false };
    }
    static addTelemetryEventProperties(event, properties) {
        if (!properties) {
            return;
        }
        Object.keys(properties).forEach(function (propertyName) {
            TelemetryHelper.addTelemetryEventProperty(event, propertyName, properties[propertyName].value, properties[propertyName].isPii);
        });
    }
    static addTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        if (Array.isArray(propertyValue)) {
            TelemetryHelper.addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        }
        else {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        }
    }
    static generate(name, codeGeneratingTelemetry) {
        let generator = new TelemetryGenerator(name);
        return generator.time(null, () => codeGeneratingTelemetry(generator)).finally(() => generator.send());
    }
    static sendPluginsList(projectRoot, pluginsList) {
        // Load list of previously sent plugins = previousPlugins
        let pluginFilePath = path.join(projectRoot, ".vscode", "plugins.json");
        let pluginFileJson;
        if (cordovaProjectHelper_1.CordovaProjectHelper.existsSync(pluginFilePath)) {
            try {
                let pluginFileJsonContents = fs.readFileSync(pluginFilePath, "utf8").toString();
                pluginFileJson = JSON.parse(pluginFileJsonContents);
            }
            catch (error) {
                console.error(error);
            }
        }
        // Get list of plugins in pluginsList but not in previousPlugins
        let pluginsFileList = new Array();
        if (pluginFileJson && pluginFileJson.plugins) {
            pluginsFileList = pluginFileJson.plugins;
        }
        else {
            pluginFileJson = new Object();
        }
        let newPlugins = new Array();
        pluginsList.forEach(plugin => {
            if (pluginsFileList.indexOf(plugin) < 0) {
                newPlugins.push(plugin);
                pluginsFileList.push(plugin);
            }
        });
        // If none, return
        if (newPlugins.length === 0) {
            return;
        }
        // Send telemetry event with list of new plugins
        let pluginDetails = newPlugins.map(pluginName => cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPluginDetails(projectRoot, pluginName))
            .filter(detail => !!detail);
        let pluginEvent = new telemetry_1.Telemetry.TelemetryEvent("plugins", { plugins: JSON.stringify(pluginDetails) });
        telemetry_1.Telemetry.send(pluginEvent);
        // Write out new list of previousPlugins
        pluginFileJson.plugins = pluginsFileList;
        fs.writeFileSync(pluginFilePath, JSON.stringify(pluginFileJson), "utf8");
    }
    static setTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        if (isPii) {
            event.setPiiProperty(propertyName, String(propertyValue));
        }
        else {
            event.properties[propertyName] = String(propertyValue);
        }
    }
    static addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        for (let i = 0; i < propertyValue.length; i++) {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName + i, propertyValue[i], isPii);
        }
    }
}
exports.TelemetryHelper = TelemetryHelper;
/* tslint:enable */

//# sourceMappingURL=telemetryHelper.js.map
