"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const Config_1 = require("./Config");
const outputConsole = vscode_1.window.createOutputChannel("Crane Console");
const http = require('http');
class Debug {
    /**
     * Displays an info message prefixed with [INFO]
     */
    static info(message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine(`[INFO] ${message}`);
        }
    }
    /**
     * Displays and error message prefixed with [ERROR]
     */
    static error(message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine(`[ERROR] ${message}`);
        }
    }
    /**
     * Displays and warning message prefixed with [WARN]
     */
    static warning(message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine(`[WARN] ${message}`);
        }
    }
    /**
     * Displays and warning message prefixed with [WARN]
     */
    static sendErrorTelemetry(message) {
        if (Config_1.Config.enableErrorTelemetry) {
            let encoded = new Buffer(message).toString('base64');
            http.get("http://telemetry.hvy.io/?u=" + encoded, function () { });
        }
    }
    static clear() {
        outputConsole.clear();
        outputConsole.dispose();
    }
    static showConsole() {
        if (Config_1.Config.debugMode) {
            outputConsole.show();
        }
    }
}
Debug.calls = 0;
exports.Debug = Debug;
//# sourceMappingURL=Debug.js.map