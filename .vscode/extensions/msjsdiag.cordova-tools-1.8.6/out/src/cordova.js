"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const cordovaProjectHelper_1 = require("./utils/cordovaProjectHelper");
const cordovaCommandHelper_1 = require("./utils/cordovaCommandHelper");
const extensionServer_1 = require("./extension/extensionServer");
const Q = require("q");
const semver = require("semver");
const simulate_1 = require("./extension/simulate");
const telemetry_1 = require("./utils/telemetry");
const telemetryHelper_1 = require("./utils/telemetryHelper");
const tsdHelper_1 = require("./utils/tsdHelper");
const completionProviders_1 = require("./extension/completionProviders");
let PLUGIN_TYPE_DEFS_FILENAME = "pluginTypings.json";
let PLUGIN_TYPE_DEFS_PATH = path.resolve(__dirname, "..", "..", PLUGIN_TYPE_DEFS_FILENAME);
let CORDOVA_TYPINGS_QUERYSTRING = "cordova";
let JSCONFIG_FILENAME = "jsconfig.json";
let TSCONFIG_FILENAME = "tsconfig.json";
let projectsCache = {};
function activate(context) {
    // Asynchronously enable telemetry
    telemetry_1.Telemetry.init("cordova-tools", require("./../../package.json").version, { isExtensionProcess: true, projectRoot: "" });
    let activateExtensionEvent = telemetryHelper_1.TelemetryHelper.createTelemetryActivity("activate");
    try {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => onChangeWorkspaceFolders(context, event)));
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            registerCordovaCommands(context);
            workspaceFolders.forEach((folder) => {
                onFolderAdded(context, folder);
            });
        }
        activateExtensionEvent.properties["cordova.workspaceFoldersCount"] = workspaceFolders.length;
        telemetry_1.Telemetry.send(activateExtensionEvent);
    }
    catch (e) {
        activateExtensionEvent.properties["cordova.error"] = true;
        telemetry_1.Telemetry.send(activateExtensionEvent);
        throw e;
    }
}
exports.activate = activate;
function deactivate() {
    console.log("Extension has been deactivated");
}
exports.deactivate = deactivate;
function onChangeWorkspaceFolders(context, event) {
    if (event.removed.length) {
        event.removed.forEach((folder) => {
            onFolderRemoved(folder);
        });
    }
    if (event.added.length) {
        event.added.forEach((folder) => {
            onFolderAdded(context, folder);
        });
    }
}
function onFolderAdded(context, folder) {
    let workspaceRoot = folder.uri.fsPath;
    let cordovaProjectRoot = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaProjectRoot(workspaceRoot);
    if (!cordovaProjectRoot) {
        return;
    }
    if (path.resolve(cordovaProjectRoot) !== path.resolve(workspaceRoot)) {
        vscode.window.showWarningMessage("VSCode Cordova extension requires the workspace root to be your Cordova project's root. The extension hasn't been activated.");
        return;
    }
    // Send project type to telemetry for each workspace folder
    let cordovaProjectTypeEvent = telemetryHelper_1.TelemetryHelper.createTelemetryEvent("cordova.projectType");
    telemetryHelper_1.TelemetryHelper.determineProjectTypes(cordovaProjectRoot)
        .then((projType) => {
        cordovaProjectTypeEvent.properties["projectType"] = projType;
    })
        .finally(() => {
        telemetry_1.Telemetry.send(cordovaProjectTypeEvent);
    })
        .done();
    // We need to update the type definitions added to the project
    // as and when plugins are added or removed. For this reason,
    // setup a file system watcher to watch changes to plugins in the Cordova project
    // Note that watching plugins/fetch.json file would suffice
    let watcher = vscode.workspace.createFileSystemWatcher("**/plugins/fetch.json", false /*ignoreCreateEvents*/, false /*ignoreChangeEvents*/, false /*ignoreDeleteEvents*/);
    watcher.onDidChange(() => updatePluginTypeDefinitions(cordovaProjectRoot));
    watcher.onDidDelete(() => updatePluginTypeDefinitions(cordovaProjectRoot));
    watcher.onDidCreate(() => updatePluginTypeDefinitions(cordovaProjectRoot));
    context.subscriptions.push(watcher);
    let simulator = new simulate_1.PluginSimulator();
    let extensionServer = new extensionServer_1.ExtensionServer(simulator, workspaceRoot);
    extensionServer.setup();
    projectsCache[workspaceRoot] = {
        extensionServer,
        cordovaProjectRoot,
        folder,
    };
    // extensionServer takes care of disposing the simulator instance
    context.subscriptions.push(extensionServer);
    // In case of Ionic 1 project register completions providers for html and javascript snippets
    if (cordovaProjectHelper_1.CordovaProjectHelper.isIonic1Project(cordovaProjectRoot)) {
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(completionProviders_1.IonicCompletionProvider.JS_DOCUMENT_SELECTOR, new completionProviders_1.IonicCompletionProvider(path.resolve(__dirname, "../../snippets/ionicJs.json"))));
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(completionProviders_1.IonicCompletionProvider.HTML_DOCUMENT_SELECTOR, new completionProviders_1.IonicCompletionProvider(path.resolve(__dirname, "../../snippets/ionicHtml.json"))));
    }
    // Install Ionic type definitions if necessary
    if (cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaProjectRoot)) {
        let ionicTypings = [
            path.join("jquery", "jquery.d.ts"),
            path.join("cordova-ionic", "plugins", "keyboard.d.ts"),
        ];
        if (cordovaProjectHelper_1.CordovaProjectHelper.isIonic1Project(cordovaProjectRoot)) {
            ionicTypings = ionicTypings.concat([
                path.join("angularjs", "angular.d.ts"),
                path.join("ionic", "ionic.d.ts"),
            ]);
        }
        tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(cordovaProjectRoot), ionicTypings, cordovaProjectRoot);
    }
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    // Skip adding typings for cordova in case of Typescript or Ionic2 projects
    // to avoid conflicts between typings we install and user-installed ones.
    if (!cordovaProjectHelper_1.CordovaProjectHelper.isIonic2Project(cordovaProjectRoot) &&
        !cordovaProjectHelper_1.CordovaProjectHelper.isIonic4Project(cordovaProjectRoot) &&
        !cordovaProjectHelper_1.CordovaProjectHelper.isTypescriptProject(cordovaProjectRoot)) {
        // Install the type defintion files for Cordova
        tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(cordovaProjectRoot), [pluginTypings[CORDOVA_TYPINGS_QUERYSTRING].typingFile], cordovaProjectRoot);
    }
    // Install type definition files for the currently installed plugins
    updatePluginTypeDefinitions(cordovaProjectRoot);
    let pluginFilePath = path.join(cordovaProjectRoot, ".vscode", "plugins.json");
    if (fs.existsSync(pluginFilePath)) {
        fs.unlinkSync(pluginFilePath);
    }
    telemetryHelper_1.TelemetryHelper.sendPluginsList(cordovaProjectRoot, cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(cordovaProjectRoot));
    // In VSCode 0.10.10+, if the root doesn't contain jsconfig.json or tsconfig.json, intellisense won't work for files without /// typing references, so add a jsconfig.json here if necessary
    let jsconfigPath = path.join(workspaceRoot, JSCONFIG_FILENAME);
    let tsconfigPath = path.join(workspaceRoot, TSCONFIG_FILENAME);
    Q.all([Q.nfcall(fs.exists, jsconfigPath), Q.nfcall(fs.exists, tsconfigPath)]).spread((jsExists, tsExists) => {
        if (!jsExists && !tsExists) {
            Q.nfcall(fs.writeFile, jsconfigPath, "{}").then(() => {
                // Any open file must be reloaded to enable intellisense on them, so inform the user
                vscode.window.showInformationMessage("A 'jsconfig.json' file was created to enable IntelliSense. You may need to reload your open JS file(s).");
            });
        }
    });
}
function onFolderRemoved(folder) {
    delete projectsCache[folder.uri.fsPath];
}
function getPluginTypingsJson() {
    if (cordovaProjectHelper_1.CordovaProjectHelper.existsSync(PLUGIN_TYPE_DEFS_PATH)) {
        return require(PLUGIN_TYPE_DEFS_PATH);
    }
    console.error("Cordova plugin type declaration mapping file 'pluginTypings.json' is missing from the extension folder.");
    return null;
}
function getNewTypeDefinitions(installedPlugins) {
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    return installedPlugins.filter(pluginName => !!pluginTypings[pluginName])
        .map(pluginName => pluginTypings[pluginName].typingFile);
}
function addPluginTypeDefinitions(projectRoot, installedPlugins, currentTypeDefs) {
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    let typingsToAdd = installedPlugins.filter((pluginName) => {
        if (pluginTypings[pluginName]) {
            return currentTypeDefs.indexOf(pluginTypings[pluginName].typingFile) < 0;
        }
        // If we do not know the plugin, collect it anonymously for future prioritisation
        let unknownPluginEvent = telemetryHelper_1.TelemetryHelper.createTelemetryEvent("unknownPlugin");
        unknownPluginEvent.setPiiProperty("plugin", pluginName);
        telemetry_1.Telemetry.send(unknownPluginEvent);
        return false;
    }).map((pluginName) => {
        return pluginTypings[pluginName].typingFile;
    });
    tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), typingsToAdd, projectRoot);
}
function removePluginTypeDefinitions(projectRoot, currentTypeDefs, newTypeDefs) {
    // Find the type definition files that need to be removed
    let typeDefsToRemove = currentTypeDefs
        .filter((typeDef) => newTypeDefs.indexOf(typeDef) < 0);
    tsdHelper_1.TsdHelper.removeTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), typeDefsToRemove, projectRoot);
}
function getRelativeTypeDefinitionFilePath(projectRoot, parentPath, typeDefinitionFile) {
    return path.relative(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), path.resolve(parentPath, typeDefinitionFile)).replace(/\\/g, "\/");
}
function updatePluginTypeDefinitions(cordovaProjectRoot) {
    // We don't need to install typings for Ionic2 since it has own TS
    // wrapper around core plugins. We also won't try to manage typings
    // in typescript projects as it might break compilation due to conflicts
    // between typings we install and user-installed ones.
    if (cordovaProjectHelper_1.CordovaProjectHelper.isIonic2Project(cordovaProjectRoot) ||
        cordovaProjectHelper_1.CordovaProjectHelper.isIonic4Project(cordovaProjectRoot) ||
        cordovaProjectHelper_1.CordovaProjectHelper.isTypescriptProject(cordovaProjectRoot)) {
        return;
    }
    let installedPlugins = cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(cordovaProjectRoot);
    const nodeModulesDir = path.resolve(cordovaProjectRoot, "node_modules");
    if (semver.gte(vscode.version, "1.7.2-insider") && fs.existsSync(nodeModulesDir)) {
        // Read installed node modules and filter out plugins that have been already installed in node_modules
        // This happens if user has used '--fetch' option to install plugin. In this case VSCode will provide
        // own intellisense for these plugins using ATA (automatic typings acquisition)
        let installedNpmModules = [];
        try {
            installedNpmModules = fs.readdirSync(nodeModulesDir);
        }
        catch (e) { }
        const pluginTypingsJson = getPluginTypingsJson() || {};
        installedPlugins = installedPlugins.filter(pluginId => {
            // plugins with `forceInstallTypings` flag don't have typings on NPM yet,
            // so we still need to install these even if they present in 'node_modules'
            const forceInstallTypings = pluginTypingsJson[pluginId] &&
                pluginTypingsJson[pluginId].forceInstallTypings;
            return forceInstallTypings || installedNpmModules.indexOf(pluginId) === -1;
        });
    }
    let newTypeDefs = getNewTypeDefinitions(installedPlugins);
    let cordovaPluginTypesFolder = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaPluginTypeDefsPath(cordovaProjectRoot);
    let ionicPluginTypesFolder = cordovaProjectHelper_1.CordovaProjectHelper.getIonicPluginTypeDefsPath(cordovaProjectRoot);
    if (!cordovaProjectHelper_1.CordovaProjectHelper.existsSync(cordovaPluginTypesFolder)) {
        addPluginTypeDefinitions(cordovaProjectRoot, installedPlugins, []);
        return;
    }
    let currentTypeDefs = [];
    // Now read the type definitions of Cordova plugins
    fs.readdir(cordovaPluginTypesFolder, (err, cordovaTypeDefs) => {
        if (err) {
            // ignore
        }
        if (cordovaTypeDefs) {
            currentTypeDefs = cordovaTypeDefs.map(typeDef => getRelativeTypeDefinitionFilePath(cordovaProjectRoot, cordovaPluginTypesFolder, typeDef));
        }
        // Now read the type definitions of Ionic plugins
        fs.readdir(ionicPluginTypesFolder, (err, ionicTypeDefs) => {
            if (err) {
                // ignore
            }
            if (ionicTypeDefs) {
                currentTypeDefs.concat(ionicTypeDefs.map(typeDef => getRelativeTypeDefinitionFilePath(cordovaProjectRoot, ionicPluginTypesFolder, typeDef)));
            }
            addPluginTypeDefinitions(cordovaProjectRoot, installedPlugins, currentTypeDefs);
            removePluginTypeDefinitions(cordovaProjectRoot, currentTypeDefs, newTypeDefs);
        });
    });
}
/* Launches a simulate command and records telemetry for it */
function launchSimulateCommand(cordovaProjectRoot, options) {
    return telemetryHelper_1.TelemetryHelper.generate("simulateCommand", (generator) => {
        return telemetryHelper_1.TelemetryHelper.determineProjectTypes(cordovaProjectRoot)
            .then((projectType) => {
            generator.add("simulateOptions", options, false);
            generator.add("projectType", projectType, false);
            // visibleTextEditors is null proof (returns empty array if no editors visible)
            generator.add("visibleTextEditorsCount", vscode.window.visibleTextEditors.length, false);
            return projectType;
        });
    }).then((projectType) => {
        const uri = vscode.Uri.file(cordovaProjectRoot);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        return projectsCache[workspaceFolder.uri.fsPath].extensionServer.pluginSimulator.simulate(cordovaProjectRoot, options, projectType);
    });
}
function registerCordovaCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand("cordova.prepare", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["prepare"])));
    context.subscriptions.push(vscode.commands.registerCommand("cordova.build", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["build"])));
    context.subscriptions.push(vscode.commands.registerCommand("cordova.run", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["run"])));
    context.subscriptions.push(vscode.commands.registerCommand("ionic.prepare", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["prepare", true])));
    context.subscriptions.push(vscode.commands.registerCommand("ionic.build", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["build", true])));
    context.subscriptions.push(vscode.commands.registerCommand("ionic.run", () => commandWrapper(cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand, ["run", true])));
    context.subscriptions.push(vscode.commands.registerCommand("cordova.simulate.android", () => {
        return selectProject()
            .then((project) => {
            return launchSimulateCommand(project.cordovaProjectRoot, { dir: project.folder.uri.fsPath, target: "chrome", platform: "android" });
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("cordova.simulate.ios", () => {
        return selectProject()
            .then((project) => {
            return launchSimulateCommand(project.cordovaProjectRoot, { dir: project.folder.uri.fsPath, target: "chrome", platform: "ios" });
        });
    }));
}
function selectProject() {
    let keys = Object.keys(projectsCache);
    if (keys.length > 1) {
        return Q.Promise((resolve, reject) => {
            vscode.window.showQuickPick(keys)
                .then((selected) => {
                if (selected) {
                    resolve(projectsCache[selected]);
                }
            }, reject);
        });
    }
    else if (keys.length === 1) {
        return Q.resolve(projectsCache[keys[0]]);
    }
    else {
        return Q.reject(new Error("No Cordova project is found"));
    }
}
function commandWrapper(fn, args) {
    return selectProject()
        .then((project) => {
        return fn(project.cordovaProjectRoot, ...args);
    });
}

//# sourceMappingURL=cordova.js.map
