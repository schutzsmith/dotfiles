"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const crane_1 = require("../crane");
const Debug_1 = require("./Debug");
const Config_1 = require("./Config");
const crypto = require('crypto');
const fs = require('fs');
const fstream = require('fstream');
const http = require('https');
const unzip = require('unzip');
const util = require('util');
const mkdirp = require('mkdirp');
const rmrf = require('rimraf');
let craneSettings = vscode_1.workspace.getConfiguration("crane");
class Cranefs {
    isCacheable() {
        return Config_1.Config.enableCache;
    }
    getCraneDir() {
        if (process.env.APPDATA) {
            return process.env.APPDATA + '/Crane';
        }
        if (process.platform == 'darwin') {
            return process.env.HOME + '/Library/Preferences/Crane';
        }
        if (process.platform == 'linux') {
            return process.env.HOME + '/Crane';
        }
    }
    getVersionFile() {
        return new Promise((resolve, reject) => {
            var filePath = this.getCraneDir() + "/version";
            fs.readFile(filePath, "utf-8", (err, data) => {
                resolve({ err, data });
            });
        });
    }
    createOrUpdateVersionFile(fileExists) {
        var filePath = this.getCraneDir() + "/version";
        if (fileExists) {
            // Delete the file
            fs.unlinkSync(filePath);
        }
        // Create the file + write Config.version into it
        mkdirp(this.getCraneDir(), err => {
            if (err) {
                Debug_1.Debug.error(err);
                return;
            }
            fs.writeFile(filePath, Config_1.Config.version, "utf-8", err => {
                if (err != null) {
                    Debug_1.Debug.error(err);
                }
            });
        });
    }
    deleteAllCaches() {
        return new Promise((resolve, reject) => {
            rmrf(this.getCraneDir() + '/projects/*', err => {
                if (!err) {
                    Debug_1.Debug.info('Project caches were deleted');
                    return resolve(true);
                }
                Debug_1.Debug.info('Project caches were not deleted');
                return resolve(false);
            });
        });
    }
    getProjectDir() {
        var md5sum = crypto.createHash('md5');
        // Get the workspace location for the user
        return this.getCraneDir() + '/projects/' + (md5sum.update(vscode_1.workspace.rootPath)).digest('hex');
    }
    getStubsDir() {
        return this.getCraneDir() + '/phpstubs';
    }
    getTreePath() {
        return this.getProjectDir() + '/tree.cache';
    }
    createProjectDir() {
        return new Promise((resolve, reject) => {
            if (this.isCacheable()) {
                this.createProjectFolder().then(projectCreated => {
                    resolve(projectCreated);
                }).catch(error => {
                    Debug_1.Debug.error(util.inspect(error, false, null));
                });
            }
            else {
                resolve({ folderExists: false, folderCreated: false, path: null });
            }
        });
    }
    doesProjectTreeExist() {
        return new Promise((resolve, reject) => {
            fs.stat(this.getTreePath(), (err, stat) => {
                if (err === null) {
                    resolve({ exists: true, path: this.getTreePath() });
                }
                else {
                    resolve({ exists: false, path: null });
                }
            });
        });
    }
    processWorkspaceFiles(rebuild = false) {
        if (vscode_1.workspace.rootPath == undefined)
            return;
        var fileProcessCount = 0;
        // Get PHP files from 'files.associations' to be processed
        var files = Config_1.Config.phpFileTypes;
        // Exclude files ignored by the user
        files.exclude = files.exclude.concat(Config_1.Config.ignoredPaths);
        // Find all the php files to process
        vscode_1.workspace.findFiles(`{${files.include.join(',')}}`, `{${files.exclude.join(',')}}`).then(files => {
            Debug_1.Debug.info(`Preparing to parse ${files.length} PHP source files...`);
            fileProcessCount = files.length;
            var filePaths = [];
            // Get the objects path value for the current file system
            files.forEach(file => {
                filePaths.push(file.fsPath);
            });
            crane_1.default.statusBarItem.text = "$(zap) Indexing PHP files";
            // Send the array of paths to the language server
            crane_1.default.langClient.onReady().then(() => {
                crane_1.default.langClient.sendRequest("buildFromFiles", {
                    files: filePaths,
                    craneRoot: this.getCraneDir(),
                    projectPath: this.getProjectDir(),
                    treePath: this.getTreePath(),
                    enableCache: this.isCacheable(),
                    rebuild: rebuild
                });
            });
            // Update the UI so the user knows the processing status
            var fileProcessed = new vscode_languageclient_1.NotificationType("fileProcessed");
            crane_1.default.langClient.onReady().then(() => {
                crane_1.default.langClient.onNotification(fileProcessed, data => {
                    // Get the percent complete
                    var percent = ((data.total / fileProcessCount) * 100).toFixed(1);
                    crane_1.default.statusBarItem.text = `$(zap) Indexing PHP files (${data.total} of ${fileProcessCount} / ${percent}%)`;
                    if (data.error) {
                        Debug_1.Debug.error("There was a problem parsing PHP file: " + data.filename);
                        Debug_1.Debug.error(`${data.error}`);
                    }
                    else {
                        Debug_1.Debug.info(`Parsed file ${data.total} of ${fileProcessCount} : ${data.filename}`);
                    }
                });
            });
        });
    }
    processProject() {
        Debug_1.Debug.info('Building project from cache file: ' + this.getTreePath());
        crane_1.default.langClient.onReady().then(() => {
            crane_1.default.langClient.sendRequest("buildFromProject", {
                treePath: this.getTreePath(),
                enableCache: this.isCacheable()
            });
        });
    }
    rebuildProject() {
        Debug_1.Debug.info('Rebuilding the project files');
        fs.unlink(this.getTreePath(), (err) => {
            this.createProjectFolder().then(success => {
                if (success) {
                    this.processWorkspaceFiles(true);
                }
            });
        });
    }
    downloadPHPLibraries() {
        var zip = Config_1.Config.phpstubsZipFile;
        var tmp = this.getCraneDir() + '/phpstubs.tmp.zip';
        Debug_1.Debug.info(`Downloading ${zip} to ${tmp}`);
        this.createPhpStubsFolder().then(created => {
            if (created) {
                var file = fs.createWriteStream(tmp);
                http.get(zip, (response) => {
                    response.pipe(file);
                    response.on('end', () => {
                        Debug_1.Debug.info('PHPStubs Download Complete');
                        Debug_1.Debug.info(`Unzipping to ${this.getStubsDir()}`);
                        fs.createReadStream(tmp)
                            .pipe(unzip.Parse())
                            .pipe(fstream.Writer(this.getStubsDir()));
                        vscode_1.window.showInformationMessage('PHP Library Stubs downloaded and installed. You may need to re-index the workspace for them to work correctly.', 'Rebuild Now').then(item => {
                            this.rebuildProject();
                        });
                    });
                });
            }
        }).catch(error => {
            Debug_1.Debug.error(util.inspect(error, false, null));
        });
    }
    createProjectFolder() {
        return new Promise((resolve, reject) => {
            mkdirp(this.getProjectDir(), (err) => {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    createPhpStubsFolder() {
        return new Promise((resolve, reject) => {
            var craneDir = this.getCraneDir();
            mkdirp(craneDir + '/phpstubs', (err) => {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
}
exports.Cranefs = Cranefs;
//# sourceMappingURL=Cranefs.js.map