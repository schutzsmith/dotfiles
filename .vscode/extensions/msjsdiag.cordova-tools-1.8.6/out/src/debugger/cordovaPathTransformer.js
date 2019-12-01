"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const telemetryHelper_1 = require("../utils/telemetryHelper");
const path = require("path");
const fs = require("fs");
/**
 * Converts a local path from Code to a path on the target.
 */
class CordovaPathTransformer extends vscode_chrome_debug_core_1.BasePathTransformer {
    constructor() {
        super();
        this._clientPathToTargetUrl = new Map();
        this._targetUrlToClientPath = new Map();
        global.cordovaPathTransformer = this;
    }
    launch(args) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initRoot(args);
            return _super("launch").call(this, args);
        });
    }
    attach(args) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initRoot(args);
            return _super("attach").call(this, args);
        });
    }
    setBreakpoints(args) {
        if (!args.source.path) {
            // sourceReference script, nothing to do
            return args;
        }
        if (vscode_chrome_debug_core_1.utils.isURL(args.source.path)) {
            // already a url, use as-is
            vscode_chrome_debug_core_1.logger.log(`Paths.setBP: ${args.source.path} is already a URL`);
            return args;
        }
        const path = vscode_chrome_debug_core_1.utils.canonicalizeUrl(args.source.path);
        const url = this.getTargetPathFromClientPath(path);
        if (url) {
            args.source.path = url;
            vscode_chrome_debug_core_1.logger.log(`Paths.setBP: Resolved ${path} to ${args.source.path}`);
            return args;
        }
        else {
            vscode_chrome_debug_core_1.logger.log(`Paths.setBP: No target url cached yet for client path: ${path}.`);
            args.source.path = path;
            return args;
        }
    }
    clearTargetContext() {
        this._clientPathToTargetUrl = new Map();
        this._targetUrlToClientPath = new Map();
    }
    scriptParsed(scriptUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const clientPath = yield this.getClientPath(scriptUrl);
            if (!clientPath) {
                // It's expected that eval scripts (eval://) won't be resolved
                if (!scriptUrl.startsWith(vscode_chrome_debug_core_1.chromeUtils.EVAL_NAME_PREFIX)) {
                    vscode_chrome_debug_core_1.logger.log(`Paths.scriptParsed: could not resolve ${scriptUrl} to a file with pathMapping/webRoot: ${JSON.stringify(this._pathMapping)}. It may be external or served directly from the server's memory (and that's OK).`);
                }
            }
            else {
                vscode_chrome_debug_core_1.logger.log(`Paths.scriptParsed: resolved ${scriptUrl} to ${clientPath}. pathMapping/webroot: ${JSON.stringify(this._pathMapping)}`);
                const canonicalizedClientPath = vscode_chrome_debug_core_1.utils.canonicalizeUrl(clientPath);
                this._clientPathToTargetUrl.set(canonicalizedClientPath, scriptUrl);
                this._targetUrlToClientPath.set(scriptUrl, clientPath);
                scriptUrl = clientPath;
            }
            return Promise.resolve(scriptUrl);
        });
    }
    stackTraceResponse(response) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(response.stackFrames.map(frame => this.fixSource(frame.source)));
        });
    }
    fixSource(source) {
        return __awaiter(this, void 0, void 0, function* () {
            if (source && source.path) {
                // Try to resolve the url to a path in the workspace. If it's not in the workspace,
                // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
                const clientPath = this.getClientPathFromTargetPath(source.path) ||
                    (yield this.targetUrlToClientPath(source.path));
                // Incoming stackFrames have sourceReference and path set. If the path was resolved to a file in the workspace,
                // clear the sourceReference since it's not needed.
                if (clientPath) {
                    source.path = clientPath;
                    source.sourceReference = undefined;
                    source.origin = undefined;
                    source.name = path.basename(clientPath);
                }
            }
        });
    }
    getTargetPathFromClientPath(clientPath) {
        // If it's already a URL, skip the Map
        return path.isAbsolute(clientPath) ?
            this._clientPathToTargetUrl.get(vscode_chrome_debug_core_1.utils.canonicalizeUrl(clientPath)) :
            clientPath;
    }
    getClientPathFromTargetPath(targetPath) {
        return this._targetUrlToClientPath.get(targetPath);
    }
    getClientPath(sourceUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            let wwwRoot = path.join(this._cordovaRoot, "www");
            // Given an absolute file:/// (such as from the iOS simulator) vscode-chrome-debug's
            // default behavior is to use that exact file, if it exists. We don't want that,
            // since we know that those files are copies of files in the local folder structure.
            // A simple workaround for this is to convert file:// paths to bogus http:// paths
            let defaultPath = "";
            let foldersForSearch = [this._webRoot, this._cordovaRoot, wwwRoot];
            if (this._projectTypes.ionic4) {
                // We don't need to connect ts files with js in www folder
                // because Ionic4 `serve` and `ionic cordova run` with livereload option enabled
                // don't use www directory anymore. If www directory is fulfilled and livereload is used then
                // source maps could be messed up.
                if (this._platform === "serve" || this._ionicLiveReload) {
                    foldersForSearch.pop();
                }
            }
            // Find the mapped local file. Try looking first in the user-specified webRoot, then in the project root, and then in the www folder
            for (const searchFolder of foldersForSearch) {
                const pathMapping = {
                    "/": searchFolder,
                };
                let mappedPath = yield vscode_chrome_debug_core_1.chromeUtils.targetUrlToClientPath(sourceUrl, pathMapping);
                if (mappedPath) {
                    defaultPath = mappedPath;
                    break;
                }
            }
            if (defaultPath.toLowerCase().indexOf(wwwRoot.toLowerCase()) === 0) {
                // If the path appears to be in www, check to see if it exists in /merges/<platform>/<relative path>
                let relativePath = path.relative(wwwRoot, defaultPath);
                let mergesPath = path.join(this._cordovaRoot, "merges", this._platform, relativePath);
                if (fs.existsSync(mergesPath)) {
                    // This file is overriden by a merge: Use that one
                    return mergesPath;
                }
            }
            return defaultPath;
        });
    }
    /**
     * Overridable for VS to ask Client to resolve path
     */
    targetUrlToClientPath(scriptUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(vscode_chrome_debug_core_1.chromeUtils.targetUrlToClientPath(scriptUrl, this._pathMapping));
        });
    }
    initRoot(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this._pathMapping = args.pathMapping;
            this._cordovaRoot = args.cwd;
            this._platform = args.platform.toLowerCase();
            this._webRoot = args.address || this._cordovaRoot;
            this._ionicLiveReload = args.ionicLiveReload || false;
            this._projectTypes = yield telemetryHelper_1.TelemetryHelper.determineProjectTypes(args.cwd);
        });
    }
}
exports.CordovaPathTransformer = CordovaPathTransformer;

//# sourceMappingURL=cordovaPathTransformer.js.map
