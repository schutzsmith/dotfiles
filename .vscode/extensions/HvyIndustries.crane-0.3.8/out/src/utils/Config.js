"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
var pkg = require('../../../package.json');
class Config {
    static reloadConfig() {
        Config.craneSettings = vscode_1.workspace.getConfiguration("crane");
    }
    static get debugMode() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("debugMode", false) : false;
    }
    static get enableCache() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("enableCache", true) : true;
    }
    static get showBugReport() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("showStatusBarBugReportLink", false) : false;
    }
    static get phpstubsZipFile() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("phpstubsZipFile", "https://codeload.github.com/HvyIndustries/crane-php-stubs/zip/master") : "https://codeload.github.com/HvyIndustries/crane-php-stubs/zip/master";
    }
    static get ignoredPaths() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("ignoredPaths", []) : [];
    }
    static get enableErrorTelemetry() {
        Config.reloadConfig();
        return Config.craneSettings ? Config.craneSettings.get("enableErrorTelemetry", false) : false;
    }
    static get version() {
        return pkg.version.toString();
    }
    static get phpFileTypes() {
        var fileSettings = vscode_1.workspace.getConfiguration("files");
        var obj = fileSettings.get("associations", new Object());
        var extentions = { include: [], exclude: [] };
        for (var i in obj) {
            var value = '**/*' + i.replace(/^\*/, '');
            if (obj[i].toLowerCase() == 'php') {
                extentions.include.push(value);
            }
            else {
                extentions.exclude.push(value);
            }
        }
        if (extentions.include.indexOf('**/*.php') == -1) {
            extentions.include.push('**/*.php');
        }
        return extentions;
    }
}
Config.craneSettings = vscode_1.workspace.getConfiguration("crane");
exports.Config = Config;
//# sourceMappingURL=Config.js.map