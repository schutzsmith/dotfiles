"use strict";
// Portions of this file are under APACHE 2.0 license.
// See APACHE.txt in this projects root diretory for details.
Object.defineProperty(exports, "__esModule", { value: true });
// Portions of this file are under the MIT license
// See LICENSE in this projects root directory for details.
// This is a copy and adaptation of the ProjectServer from
// TypeScript's editorServices.ts copied and adapted under
// the APACHE 2.0 license. Some utility functions and
// TypeScript were also lifted.
const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const ng = require("@angular/language-service/language-service");
const lineCollectionCapacity = 4;
function toPath(fileName, currentDirectory, getCanonicalFileName) {
    return fileName;
}
const hasOwnProperty = Object.prototype.hasOwnProperty;
function createMap(template) {
    const map = Object.create(null); // tslint:disable-line:no-null-keyword
    // Using 'delete' on an object causes V8 to put the object in dictionary mode.
    // This disables creation of hidden classes, which are expensive when an object is
    // constantly changing shape.
    map["__"] = undefined;
    delete map["__"];
    // Copies keys/values from template. Note that for..in will not throw if
    // template is undefined, and instead will just exit the loop.
    for (const key in template)
        if (hasOwnProperty.call(template, key)) {
            map[key] = template[key];
        }
    return map;
}
function lastOrUndefined(array) {
    if (array.length === 0) {
        return undefined;
    }
    return array[array.length - 1];
}
let directorySeparator = "/";
function getNormalizedParts(normalizedSlashedPath, rootLength) {
    const parts = normalizedSlashedPath.substr(rootLength).split(directorySeparator);
    const normalized = [];
    for (const part of parts) {
        if (part !== ".") {
            if (part === ".." && normalized.length > 0 && lastOrUndefined(normalized) !== "..") {
                normalized.pop();
            }
            else {
                // A part may be an empty string (which is 'falsy') if the path had consecutive slashes,
                // e.g. "path//file.ts".  Drop these before re-joining the parts.
                if (part) {
                    normalized.push(part);
                }
            }
        }
    }
    return normalized;
}
// Returns length of path root (i.e. length of "/", "x:/", "//server/share/, file:///user/files")
function getRootLength(path) {
    if (path.charCodeAt(0) === 0x2F) {
        if (path.charCodeAt(1) !== 0x2F)
            return 1;
        const p1 = path.indexOf("/", 2);
        if (p1 < 0)
            return 2;
        const p2 = path.indexOf("/", p1 + 1);
        if (p2 < 0)
            return p1 + 1;
        return p2 + 1;
    }
    if (path.charCodeAt(1) === 0x3A) {
        if (path.charCodeAt(2) === 0x2F)
            return 3;
        return 2;
    }
    // Per RFC 1738 'file' URI schema has the shape file://<host>/<path>
    // if <host> is omitted then it is assumed that host value is 'localhost',
    // however slash after the omitted <host> is not removed.
    // file:///folder1/file1 - this is a correct URI
    // file://folder2/file2 - this is an incorrect URI
    if (path.lastIndexOf("file:///", 0) === 0) {
        return "file:///".length;
    }
    const idx = path.indexOf("://");
    if (idx !== -1) {
        return idx + "://".length;
    }
    return 0;
}
function getDirectoryPath(path) {
    return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(directorySeparator)));
}
function normalizeSlashes(path) {
    return path.replace(/\\/g, "/");
}
function normalizePath(path) {
    path = normalizeSlashes(path);
    const rootLength = getRootLength(path);
    const normalized = getNormalizedParts(path, rootLength);
    return path.substr(0, rootLength) + normalized.join(directorySeparator);
}
function combinePaths(path1, path2) {
    if (!(path1 && path1.length))
        return path2;
    if (!(path2 && path2.length))
        return path1;
    if (getRootLength(path2) !== 0)
        return path2;
    if (path1.charAt(path1.length - 1) === directorySeparator)
        return path1 + path2;
    return path1 + directorySeparator + path2;
}
function getScriptKindFromFileName(fileName) {
    const ext = fileName.substr(fileName.lastIndexOf("."));
    switch (ext.toLowerCase()) {
        case ".js":
            return ts.ScriptKind.JS;
        case ".jsx":
            return ts.ScriptKind.JSX;
        case ".ts":
            return ts.ScriptKind.TS;
        case ".tsx":
            return ts.ScriptKind.TSX;
        default:
            return ts.ScriptKind.Unknown;
    }
}
function addRange(to, from) {
    if (to && from) {
        for (const v of from) {
            to.push(v);
        }
    }
}
function forEachProperty(map, callback) {
    let result;
    for (const key in map) {
        if (result = callback(map[key], key))
            break;
    }
    return result;
}
function concatenate(array1, array2) {
    if (!array2 || !array2.length)
        return array1;
    if (!array1 || !array1.length)
        return array2;
    return array1.concat(array2);
}
function deduplicate(array, areEqual) {
    let result;
    if (array) {
        result = [];
        loop: for (const item of array) {
            for (const res of result) {
                if (areEqual ? areEqual(res, item) : res === item) {
                    continue loop;
                }
            }
            result.push(item);
        }
    }
    return result;
}
function clone(object) {
    const result = {};
    for (const id in object) {
        if (hasOwnProperty.call(object, id)) {
            result[id] = object[id];
        }
    }
    return result;
}
/**
 *  List of supported extensions in order of file resolution precedence.
 */
const supportedTypeScriptExtensions = [".ts", ".tsx", ".d.ts"];
/** Must have ".d.ts" first because if ".ts" goes first, that will be detected as the extension instead of ".d.ts". */
const supportedTypescriptExtensionsForExtractExtension = [".d.ts", ".ts", ".tsx"];
const supportedJavascriptExtensions = [".js", ".jsx"];
const allSupportedExtensions = supportedTypeScriptExtensions.concat(supportedJavascriptExtensions);
function getSupportedExtensions(options) {
    return options && options.allowJs ? allSupportedExtensions : supportedTypeScriptExtensions;
}
function isSupportedSourceFileName(fileName, compilerOptions) {
    if (!fileName) {
        return false;
    }
    for (const extension of getSupportedExtensions(compilerOptions)) {
        if (fileExtensionIs(fileName, extension)) {
            return true;
        }
    }
    return false;
}
function fileExtensionIs(path, extension) {
    return path.length > extension.length && endsWith(path, extension);
}
function endsWith(str, suffix) {
    const expectedPos = str.length - suffix.length;
    return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos;
}
function arrayIsEqualTo(array1, array2, equaler) {
    if (!array1 || !array2) {
        return array1 === array2;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    for (let i = 0; i < array1.length; i++) {
        const equals = equaler ? equaler(array1[i], array2[i]) : array1[i] === array2[i];
        if (!equals) {
            return false;
        }
    }
    return true;
}
function getBaseFileName(path) {
    if (path === undefined) {
        return undefined;
    }
    const i = path.lastIndexOf(directorySeparator);
    return i < 0 ? path : path.substring(i + 1);
}
function reduceProperties(map, callback, initial) {
    let result = initial;
    for (const key in map) {
        result = callback(result, map[key], String(key));
    }
    return result;
}
function removeTrailingDirectorySeparator(path) {
    if (path.charAt(path.length - 1) === directorySeparator) {
        return path.substr(0, path.length - 1);
    }
    return path;
}
function normalizedPathComponents(path, rootLength) {
    const normalizedParts = getNormalizedParts(path, rootLength);
    return [path.substr(0, rootLength)].concat(normalizedParts);
}
function getNormalizedPathComponents(path, currentDirectory) {
    path = normalizeSlashes(path);
    let rootLength = getRootLength(path);
    if (rootLength === 0) {
        // If the path is not rooted it is relative to current directory
        path = combinePaths(normalizeSlashes(currentDirectory), path);
        rootLength = getRootLength(path);
    }
    return normalizedPathComponents(path, rootLength);
}
function compareValues(a, b) {
    if (a === b)
        return 0 /* EqualTo */;
    if (a === undefined)
        return -1 /* LessThan */;
    if (b === undefined)
        return 1 /* GreaterThan */;
    return a < b ? -1 /* LessThan */ : 1 /* GreaterThan */;
}
function compareStrings(a, b, ignoreCase) {
    if (a === b)
        return 0 /* EqualTo */;
    if (a === undefined)
        return -1 /* LessThan */;
    if (b === undefined)
        return 1 /* GreaterThan */;
    if (ignoreCase) {
        if (String.prototype.localeCompare) {
            const result = a.localeCompare(b, /*locales*/ undefined, { usage: "sort", sensitivity: "accent" });
            return result < 0 ? -1 /* LessThan */ : result > 0 ? 1 /* GreaterThan */ : 0 /* EqualTo */;
        }
        a = a.toUpperCase();
        b = b.toUpperCase();
        if (a === b)
            return 0 /* EqualTo */;
    }
    return a < b ? -1 /* LessThan */ : 1 /* GreaterThan */;
}
function comparePaths(a, b, currentDirectory, ignoreCase) {
    if (a === b)
        return 0 /* EqualTo */;
    if (a === undefined)
        return -1 /* LessThan */;
    if (b === undefined)
        return 1 /* GreaterThan */;
    a = removeTrailingDirectorySeparator(a);
    b = removeTrailingDirectorySeparator(b);
    const aComponents = getNormalizedPathComponents(a, currentDirectory);
    const bComponents = getNormalizedPathComponents(b, currentDirectory);
    const sharedLength = Math.min(aComponents.length, bComponents.length);
    for (let i = 0; i < sharedLength; i++) {
        const result = compareStrings(aComponents[i], bComponents[i], ignoreCase);
        if (result !== 0 /* EqualTo */) {
            return result;
        }
    }
    return compareValues(aComponents.length, bComponents.length);
}
function filter(array, f) {
    if (array) {
        const len = array.length;
        let i = 0;
        while (i < len && f(array[i]))
            i++;
        if (i < len) {
            const result = array.slice(0, i);
            i++;
            while (i < len) {
                const item = array[i];
                if (f(item)) {
                    result.push(item);
                }
                i++;
            }
            return result;
        }
    }
    return array;
}
function computeLineStarts(text) {
    const result = new Array();
    let pos = 0;
    let lineStart = 0;
    while (pos < text.length) {
        const ch = text.charCodeAt(pos);
        pos++;
        switch (ch) {
            case 0x0D:
                if (text.charCodeAt(pos) === 0x0A) {
                    pos++;
                }
            case 0x0A:
            case 0x2028:
            case 0x2029:
                result.push(lineStart);
                lineStart = pos;
                break;
        }
    }
    result.push(lineStart);
    return result;
}
function createGetCanonicalFileName(useCaseSensitivefileNames) {
    return useCaseSensitivefileNames
        ? ((fileName) => fileName)
        : ((fileName) => fileName.toLowerCase());
}
class ScriptInfo {
    constructor(host, fileName, content, isOpen = false) {
        this.host = host;
        this.fileName = fileName;
        this.isOpen = isOpen;
        this.children = []; // files referenced by this file
        this.path = toPath(fileName, host.getCurrentDirectory(), createGetCanonicalFileName(host.useCaseSensitiveFileNames));
        this.svc = ScriptVersionCache.fromString(host, content);
    }
    // setFormatOptions(formatOptions: protocol.FormatOptions): void {
    //     if (formatOptions) {
    //         mergeFormatOptions(this.formatCodeOptions, formatOptions);
    //     }
    // }
    close() {
        this.isOpen = false;
    }
    addChild(childInfo) {
        this.children.push(childInfo);
    }
    snap() {
        return this.svc.getSnapshot();
    }
    getText() {
        const snap = this.snap();
        return snap.getText(0, snap.getLength());
    }
    getLineInfo(line) {
        const snap = this.snap();
        return snap.index.lineNumberToInfo(line);
    }
    editContent(start, end, newText) {
        this.svc.edit(start, end - start, newText);
    }
    getTextChangeRangeBetweenVersions(startVersion, endVersion) {
        return this.svc.getTextChangesBetweenVersions(startVersion, endVersion);
    }
    getChangeRange(oldSnapshot) {
        return this.snap().getChangeRange(oldSnapshot);
    }
}
exports.ScriptInfo = ScriptInfo;
class LSHost {
    constructor(host, project) {
        this.host = host;
        this.project = project;
        this.roots = [];
        this.version = 0;
        this.getCanonicalFileName = createGetCanonicalFileName(host.useCaseSensitiveFileNames);
        this.resolvedModuleNames = new Map();
        this.resolvedTypeReferenceDirectives = new Map();
        this.filenameToScript = new Map();
        this.moduleResolutionHost = {
            fileExists: fileName => this.fileExists(fileName),
            readFile: fileName => this.host.readFile(fileName),
            directoryExists: directoryName => this.host.directoryExists(directoryName)
        };
        //   if (this.host.realpath) {
        //       this.moduleResolutionHost.realpath = path => this.host.realpath(path);
        //   }
    }
    resolveNamesWithLocalCache(names, containingFile, cache, loader, getResult) {
        const path = toPath(containingFile, this.host.getCurrentDirectory(), this.getCanonicalFileName);
        const currentResolutionsInFile = cache.get(path);
        const newResolutions = createMap();
        const resolvedModules = [];
        const compilerOptions = this.getCompilationSettings();
        for (const name of names) {
            // check if this is a duplicate entry in the list
            let resolution = newResolutions[name];
            if (!resolution) {
                const existingResolution = currentResolutionsInFile && currentResolutionsInFile[name];
                if (moduleResolutionIsValid(existingResolution)) {
                    // ok, it is safe to use existing name resolution results
                    resolution = existingResolution;
                }
                else {
                    resolution = loader(name, containingFile, compilerOptions, this.moduleResolutionHost);
                    resolution.lastCheckTime = Date.now();
                    newResolutions[name] = resolution;
                }
            }
            resolvedModules.push(getResult(resolution));
        }
        // replace old results with a new one
        cache.set(path, newResolutions);
        return resolvedModules;
        function moduleResolutionIsValid(resolution) {
            if (!resolution) {
                return false;
            }
            if (getResult(resolution)) {
                // TODO: consider checking failedLookupLocations
                // TODO: use lastCheckTime to track expiration for module name resolution
                return true;
            }
            // consider situation if we have no candidate locations as valid resolution.
            // after all there is no point to invalidate it if we have no idea where to look for the module.
            if (resolution.failedLookupLocations === undefined) {
                return true;
            }
            return resolution.failedLookupLocations.length === 0;
        }
    }
    getProjectVersion() {
        return this.version.toString();
    }
    resolveTypeReferenceDirectives(typeDirectiveNames, containingFile) {
        return this.resolveNamesWithLocalCache(typeDirectiveNames, containingFile, this.resolvedTypeReferenceDirectives, ts.resolveTypeReferenceDirective, m => m.resolvedTypeReferenceDirective);
    }
    resolveModuleNames(moduleNames, containingFile) {
        return this.resolveNamesWithLocalCache(moduleNames, containingFile, this.resolvedModuleNames, ts.resolveModuleName, m => m.resolvedModule);
    }
    getDefaultLibFileName() {
        const nodeModuleBinDir = getDirectoryPath(normalizePath(this.host.getExecutingFilePath()));
        return combinePaths(nodeModuleBinDir, ts.getDefaultLibFileName(this.compilationSettings));
    }
    getScriptSnapshot(filename) {
        const scriptInfo = this.getScriptInfo(filename);
        if (scriptInfo) {
            return scriptInfo.snap();
        }
    }
    setCompilationSettings(opt) {
        this.compilationSettings = opt;
        // conservatively assume that changing compiler options might affect module resolution strategy
        this.resolvedModuleNames.clear();
        this.resolvedTypeReferenceDirectives.clear();
        this.modified();
    }
    lineAffectsRefs(filename, line) {
        const info = this.getScriptInfo(filename);
        const lineInfo = info.getLineInfo(line);
        if (lineInfo && lineInfo.text) {
            const regex = /reference|import|\/\*|\*\//;
            return regex.test(lineInfo.text);
        }
    }
    getCompilationSettings() {
        // change this to return active project settings for file
        return this.compilationSettings;
    }
    getScriptFileNames() {
        return this.roots.map(root => root.fileName);
    }
    getScriptKind(fileName) {
        const info = this.getScriptInfo(fileName);
        if (!info) {
            return undefined;
        }
        if (!info.scriptKind) {
            info.scriptKind = getScriptKindFromFileName(fileName);
        }
        return info.scriptKind;
    }
    getScriptVersion(filename) {
        const info = this.getScriptInfo(filename);
        if (info) {
            return info.svc.latestVersion().toString();
        }
        return "<unknown>";
    }
    getCurrentDirectory() {
        return this.host.getCurrentDirectory();
    }
    getScriptIsOpen(filename) {
        return this.getScriptInfo(filename).isOpen;
    }
    removeReferencedFile(info) {
        if (!info.isOpen) {
            this.filenameToScript.delete(info.path);
            this.resolvedModuleNames.delete(info.path);
            this.resolvedTypeReferenceDirectives.delete(info.path);
            this.modified();
        }
    }
    getScriptInfo(filename) {
        const path = toPath(filename, this.host.getCurrentDirectory(), this.getCanonicalFileName);
        let scriptInfo = this.filenameToScript.get(path);
        if (!scriptInfo) {
            scriptInfo = this.project.openReferencedFile(filename);
            if (scriptInfo) {
                this.filenameToScript.set(path, scriptInfo);
            }
        }
        return scriptInfo;
    }
    addRoot(info) {
        if (!this.filenameToScript.has(info.path)) {
            this.filenameToScript.set(info.path, info);
            this.roots.push(info);
            this.modified();
        }
    }
    removeRoot(info) {
        if (this.filenameToScript.has(info.path)) {
            this.filenameToScript.delete(info.path);
            this.roots = copyListRemovingItem(info, this.roots);
            this.resolvedModuleNames.delete(info.path);
            this.resolvedTypeReferenceDirectives.delete(info.path);
            this.modified();
        }
    }
    //   saveTo(filename: string, tmpfilename: string) {
    //       const script = this.getScriptInfo(filename);
    //       if (script) {
    //           const snap = script.snap();
    //           this.host.writeFile(tmpfilename, snap.getText(0, snap.getLength()));
    //       }
    //   }
    reloadScript(filename, tmpfilename, cb) {
        const script = this.getScriptInfo(filename);
        if (script) {
            script.svc.reloadFromFile(tmpfilename, cb);
            this.modified();
        }
    }
    editScript(filename, start, end, newText) {
        const script = this.getScriptInfo(filename);
        if (script) {
            script.editContent(start, end, newText);
            this.modified();
            return;
        }
        throw new Error("No script with name '" + filename + "'");
    }
    resolvePath(path) {
        const result = this.host.resolvePath(path);
        return result;
    }
    fileExists(path) {
        const result = this.host.fileExists(path);
        return result;
    }
    directoryExists(path) {
        return this.host.directoryExists(path);
    }
    getDirectories(path) {
        return this.host.getDirectories(path);
    }
    /**
     *  @param line 1 based index
     */
    lineToTextSpan(filename, line) {
        const path = toPath(filename, this.host.getCurrentDirectory(), this.getCanonicalFileName);
        const script = this.filenameToScript.get(path);
        const index = script.snap().index;
        const lineInfo = index.lineNumberToInfo(line + 1);
        let len;
        if (lineInfo.leaf) {
            len = lineInfo.leaf.text.length;
        }
        else {
            const nextLineInfo = index.lineNumberToInfo(line + 2);
            len = nextLineInfo.offset - lineInfo.offset;
        }
        return ts.createTextSpan(lineInfo.offset, len);
    }
    /**
     * @param line 1 based index
     * @param offset 1 based index
     */
    lineOffsetToPosition(filename, line, offset) {
        const path = toPath(filename, this.host.getCurrentDirectory(), this.getCanonicalFileName);
        const script = this.getScriptInfo(path);
        const index = script.snap().index;
        const lineInfo = index.lineNumberToInfo(line);
        // TODO: assert this offset is actually on the line
        return (lineInfo.offset + offset - 1);
    }
    /**
     * @param line 1-based index
     * @param offset 1-based index
     */
    positionToLineOffset(filename, position, lineIndex) {
        lineIndex = lineIndex || this.getLineIndex(filename);
        const lineOffset = lineIndex.charOffsetToLineNumberAndPos(position);
        return { line: lineOffset.line, offset: lineOffset.offset + 1, text: lineOffset.text };
    }
    getLineIndex(filename) {
        const path = toPath(filename, this.host.getCurrentDirectory(), this.getCanonicalFileName);
        const script = this.filenameToScript.get(path);
        return script.snap().index;
    }
    modified() {
        this.version++;
    }
}
exports.LSHost = LSHost;
class Project {
    constructor(projectService, logger, documentRegistry, projectOptions, languageServiceDisabled = false) {
        this.projectService = projectService;
        this.logger = logger;
        this.documentRegistry = documentRegistry;
        this.projectOptions = projectOptions;
        this.languageServiceDisabled = languageServiceDisabled;
        // Used to keep track of what directories are watched for this project
        this.directoriesWatchedForTsconfig = [];
        this.filenameToSourceFile = createMap();
        this.referencesFile = new Set();
        this.updateGraphSeq = 0;
        /** Used for configured projects which may have multiple open roots */
        this.openRefCount = 0;
        if (projectOptions && projectOptions.files) {
            // If files are listed explicitly, allow all extensions
            projectOptions.compilerOptions['allowNonTsExtensions'] = true;
        }
        if (!languageServiceDisabled) {
            this.compilerService = new CompilerService(this, logger, this.documentRegistry, projectOptions && projectOptions.compilerOptions);
        }
    }
    enableLanguageService() {
        // if the language service was disabled, we should re-initiate the compiler service
        if (this.languageServiceDisabled) {
            this.compilerService = new CompilerService(this, this.logger, this.documentRegistry, this.projectOptions && this.projectOptions.compilerOptions);
        }
        this.languageServiceDisabled = false;
    }
    disableLanguageService() {
        this.languageServiceDisabled = true;
    }
    addOpenRef() {
        this.openRefCount++;
    }
    deleteOpenRef() {
        this.openRefCount--;
        return this.openRefCount;
    }
    openReferencedFile(filename) {
        return this.projectService.openFile(filename, /*openedByClient*/ false);
    }
    getRootFiles() {
        if (this.languageServiceDisabled) {
            // When the languageService was disabled, only return file list if it is a configured project
            return this.projectOptions ? this.projectOptions.files : undefined;
        }
        return this.compilerService.host.roots.map(info => info.fileName);
    }
    getFileNames() {
        if (this.languageServiceDisabled) {
            if (!this.projectOptions) {
                return undefined;
            }
            const fileNames = [];
            if (this.projectOptions && this.projectOptions.compilerOptions) {
                fileNames.push(ts.getDefaultLibFilePath(this.projectOptions.compilerOptions));
            }
            addRange(fileNames, this.projectOptions.files);
            return fileNames;
        }
        const sourceFiles = this.program.getSourceFiles();
        return sourceFiles.map(sourceFile => sourceFile.fileName);
    }
    references(info) {
        if (this.languageServiceDisabled) {
            return undefined;
        }
        return this.referencesFile.has(info.fileName);
    }
    getSourceFile(info) {
        if (this.languageServiceDisabled) {
            return undefined;
        }
        return this.filenameToSourceFile[info.fileName];
    }
    getSourceFileFromName(filename, requireOpen) {
        if (this.languageServiceDisabled) {
            return undefined;
        }
        const info = this.projectService.getScriptInfo(filename);
        if (info) {
            if ((!requireOpen) || info.isOpen) {
                return this.getSourceFile(info);
            }
        }
    }
    isRoot(info) {
        if (this.languageServiceDisabled) {
            return undefined;
        }
        return this.compilerService.host.roots.some(root => root === info);
    }
    removeReferencedFile(info) {
        if (this.languageServiceDisabled) {
            return;
        }
        this.compilerService.host.removeReferencedFile(info);
        this.updateGraph();
    }
    updateFileMap() {
        if (this.languageServiceDisabled) {
            return;
        }
        this.filenameToSourceFile = createMap();
        this.referencesFile = new Set();
        // Update all references to TypeScript files
        const sourceFiles = this.program.getSourceFiles();
        for (let i = 0, len = sourceFiles.length; i < len; i++) {
            const normFilename = normalizePath(sourceFiles[i].fileName);
            this.filenameToSourceFile[normFilename] = sourceFiles[i];
            this.referencesFile.add(normFilename);
        }
        // Update all referenced angular templates
        for (let template of this.compilerService.ngService.getTemplateReferences()) {
            const normFilename = normalizePath(template);
            this.referencesFile.add(normFilename);
        }
    }
    finishGraph() {
        if (this.languageServiceDisabled) {
            return;
        }
        this.updateGraph();
        this.compilerService.languageService.getNavigateToItems(".*");
    }
    updateGraph() {
        if (this.languageServiceDisabled) {
            return;
        }
        this.program = this.compilerService.languageService.getProgram();
        this.updateFileMap();
    }
    isConfiguredProject() {
        return this.projectFilename;
    }
    // add a root file to project
    addRoot(info) {
        if (this.languageServiceDisabled) {
            return;
        }
        this.compilerService.host.addRoot(info);
    }
    // remove a root file from project
    removeRoot(info) {
        if (this.languageServiceDisabled) {
            return;
        }
        this.compilerService.host.removeRoot(info);
    }
    filesToString() {
        if (this.languageServiceDisabled) {
            if (this.projectOptions) {
                let strBuilder = "";
                this.projectOptions.files.forEach(file => { strBuilder += file + "\n"; });
                return strBuilder;
            }
        }
        let strBuilder = "";
        forEachProperty(this.filenameToSourceFile, sourceFile => { strBuilder += sourceFile.fileName + "\n"; });
        return strBuilder;
    }
    setProjectOptions(projectOptions) {
        this.projectOptions = projectOptions;
        if (projectOptions.compilerOptions) {
            projectOptions.compilerOptions['allowNonTsExtensions'] = true;
            if (!this.languageServiceDisabled) {
                this.compilerService.setCompilerOptions(projectOptions.compilerOptions);
            }
        }
    }
}
exports.Project = Project;
function copyListRemovingItem(item, list) {
    const copiedList = [];
    for (let i = 0, len = list.length; i < len; i++) {
        if (list[i] != item) {
            copiedList.push(list[i]);
        }
    }
    return copiedList;
}
/**
 * This helper funciton processes a list of projects and return the concatenated, sortd and deduplicated output of processing each project.
 */
function combineProjectOutput(projects, action, comparer, areEqual) {
    const result = projects.reduce((previous, current) => concatenate(previous, action(current)), []).sort(comparer);
    return projects.length > 1 ? deduplicate(result, areEqual) : result;
}
exports.combineProjectOutput = combineProjectOutput;
class ProjectService {
    constructor(host, psLogger, eventHandler) {
        this.host = host;
        this.psLogger = psLogger;
        this.eventHandler = eventHandler;
        this.documentRegistry = ts.createDocumentRegistry();
        this.filenameToScriptInfo = createMap();
        // open, non-configured root files
        this.openFileRoots = [];
        // projects built from openFileRoots
        this.inferredProjects = [];
        // projects specified by a tsconfig.json file
        this.configuredProjects = [];
        // open files referenced by a project
        this.openFilesReferenced = [];
        // open files that are roots of a configured project
        this.openFileRootsConfigured = [];
        // a path to directory watcher map that detects added tsconfig files
        this.directoryWatchersForTsconfig = createMap();
        // count of how many projects are using the directory watcher. If the
        // number becomes 0 for a watcher, then we should close it.
        this.directoryWatchersRefCount = createMap();
        this.timerForDetectingProjectFileListChanges = createMap();
        this.changeSeq = 0;
        // ts.disableIncrementalParsing = true;
        this.addDefaultHostConfiguration();
    }
    addDefaultHostConfiguration() {
        this.hostConfiguration = {
            formatCodeOptions: clone(CompilerService.getDefaultFormatCodeOptions(this.host)),
            hostInfo: "Unknown host"
        };
    }
    watchedFileChanged(fileName) {
        const info = this.filenameToScriptInfo[fileName];
        if (!info) {
            this.psLogger.info("Error: got watch notification for unknown file: " + fileName);
        }
        if (!this.host.fileExists(fileName)) {
            // File was deleted
            this.fileDeletedInFilesystem(info);
        }
        else {
            if (info && (!info.isOpen)) {
                info.svc.reloadFromFile(info.fileName);
            }
        }
    }
    report(eventName, fileName, project) {
        if (this.eventHandler) {
            this.eventHandler({ eventName, data: { project, fileName } });
        }
    }
    /**
     * This is the callback function when a watched directory has added or removed source code files.
     * @param project the project that associates with this directory watcher
     * @param fileName the absolute file name that changed in watched directory
     */
    directoryWatchedForSourceFilesChanged(project, fileName) {
        // If a change was made inside "folder/file", node will trigger the callback twice:
        // one with the fileName being "folder/file", and the other one with "folder".
        // We don't respond to the second one.
        if (fileName && !isSupportedSourceFileName(fileName, project.projectOptions ? project.projectOptions.compilerOptions : undefined)) {
            return;
        }
        this.log("Detected source file changes: " + fileName);
        this.startTimerForDetectingProjectFileListChanges(project);
    }
    startTimerForDetectingProjectFileListChanges(project) {
        if (this.timerForDetectingProjectFileListChanges[project.projectFilename]) {
            this.host.clearTimeout(this.timerForDetectingProjectFileListChanges[project.projectFilename]);
        }
        this.timerForDetectingProjectFileListChanges[project.projectFilename] = this.host.setTimeout(() => this.handleProjectFileListChanges(project), 250);
    }
    handleProjectFileListChanges(project) {
        const { projectOptions, errors } = this.configFileToProjectOptions(project.projectFilename);
        this.reportConfigFileDiagnostics(project.projectFilename, errors);
        const newRootFiles = projectOptions.files.map((f => this.getCanonicalFileName(f)));
        const currentRootFiles = project.getRootFiles().map((f => this.getCanonicalFileName(f)));
        // We check if the project file list has changed. If so, we update the project.
        if (!arrayIsEqualTo(currentRootFiles && currentRootFiles.sort(), newRootFiles && newRootFiles.sort())) {
            // For configured projects, the change is made outside the tsconfig file, and
            // it is not likely to affect the project for other files opened by the client. We can
            // just update the current project.
            this.updateConfiguredProject(project);
            // Call updateProjectStructure to clean up inferred projects we may have
            // created for the new files
            this.updateProjectStructure();
        }
    }
    reportConfigFileDiagnostics(configFileName, diagnostics, triggerFile) {
        if (diagnostics && diagnostics.length > 0 && this.eventHandler) {
            this.eventHandler({
                eventName: "configFileDiag",
                data: { configFileName, diagnostics, triggerFile }
            });
        }
    }
    /**
     * This is the callback function when a watched directory has an added tsconfig file.
     */
    directoryWatchedForTsconfigChanged(fileName) {
        if (getBaseFileName(fileName) !== "tsconfig.json") {
            this.log(fileName + " is not tsconfig.json");
            return;
        }
        this.log("Detected newly added tsconfig file: " + fileName);
        const { projectOptions, errors } = this.configFileToProjectOptions(fileName);
        this.reportConfigFileDiagnostics(fileName, errors);
        if (!projectOptions) {
            return;
        }
        const rootFilesInTsconfig = projectOptions.files.map(f => this.getCanonicalFileName(f));
        const openFileRoots = this.openFileRoots.map(s => this.getCanonicalFileName(s.fileName));
        // We should only care about the new tsconfig file if it contains any
        // opened root files of existing inferred projects
        for (const openFileRoot of openFileRoots) {
            if (rootFilesInTsconfig.indexOf(openFileRoot) >= 0) {
                this.reloadProjects();
                return;
            }
        }
    }
    getCanonicalFileName(fileName) {
        const name = this.host.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        return normalizePath(name);
    }
    watchedProjectConfigFileChanged(project) {
        this.log("Config file changed: " + project.projectFilename);
        const configFileErrors = this.updateConfiguredProject(project);
        this.updateProjectStructure();
        if (configFileErrors && configFileErrors.length > 0 && this.eventHandler) {
            this.eventHandler({ eventName: "configFileDiag", data: { triggerFile: project.projectFilename, configFileName: project.projectFilename, diagnostics: configFileErrors } });
        }
    }
    log(msg, type = "Err") {
        this.psLogger.msg(msg, type);
    }
    closeLog() {
        this.psLogger.close();
    }
    createInferredProject(root) {
        const project = new Project(this, this.psLogger, this.documentRegistry);
        project.addRoot(root);
        project.finishGraph();
        this.inferredProjects.push(project);
        return project;
    }
    fileDeletedInFilesystem(info) {
        this.psLogger.info(info.fileName + " deleted");
        if (info.fileWatcher) {
            info.fileWatcher.close();
            info.fileWatcher = undefined;
        }
        if (!info.isOpen) {
            this.filenameToScriptInfo[info.fileName] = undefined;
            const referencingProjects = this.findReferencingProjects(info);
            if (info.defaultProject) {
                info.defaultProject.removeRoot(info);
            }
            for (let i = 0, len = referencingProjects.length; i < len; i++) {
                referencingProjects[i].removeReferencedFile(info);
            }
            for (let j = 0, flen = this.openFileRoots.length; j < flen; j++) {
                const openFile = this.openFileRoots[j];
                this.report("context", openFile.fileName, openFile.defaultProject);
            }
            for (let j = 0, flen = this.openFilesReferenced.length; j < flen; j++) {
                const openFile = this.openFilesReferenced[j];
                this.report("context", openFile.fileName, openFile.defaultProject);
            }
        }
        this.printProjects();
    }
    removeProject(project) {
        this.log("remove project: " + project.getRootFiles().toString());
        if (project.isConfiguredProject()) {
            project.projectFileWatcher.close();
            project.directoryWatcher.close();
            forEachProperty(project.directoriesWatchedForWildcards, watcher => { watcher.close(); });
            delete project.directoriesWatchedForWildcards;
            this.configuredProjects = copyListRemovingItem(project, this.configuredProjects);
        }
        else {
            for (const directory of project.directoriesWatchedForTsconfig) {
                // if the ref count for this directory watcher drops to 0, it's time to close it
                project.projectService.directoryWatchersRefCount[directory]--;
                if (!project.projectService.directoryWatchersRefCount[directory]) {
                    this.log("Close directory watcher for: " + directory);
                    project.projectService.directoryWatchersForTsconfig[directory].close();
                    delete project.projectService.directoryWatchersForTsconfig[directory];
                }
            }
            this.inferredProjects = copyListRemovingItem(project, this.inferredProjects);
        }
        const fileNames = project.getFileNames();
        for (const fileName of fileNames) {
            const info = this.getScriptInfo(fileName);
            if (info.defaultProject == project) {
                info.defaultProject = undefined;
            }
        }
    }
    setConfiguredProjectRoot(info) {
        for (let i = 0, len = this.configuredProjects.length; i < len; i++) {
            const configuredProject = this.configuredProjects[i];
            if (configuredProject.isRoot(info)) {
                info.defaultProject = configuredProject;
                configuredProject.addOpenRef();
                return true;
            }
        }
        return false;
    }
    addOpenFile(info) {
        if (this.setConfiguredProjectRoot(info)) {
            this.openFileRootsConfigured.push(info);
        }
        else {
            this.findReferencingProjects(info);
            if (info.defaultProject) {
                info.defaultProject.addOpenRef();
                this.openFilesReferenced.push(info);
            }
            else {
                // create new inferred project p with the newly opened file as root
                info.defaultProject = this.createInferredProject(info);
                const openFileRoots = [];
                // for each inferred project root r
                for (let i = 0, len = this.openFileRoots.length; i < len; i++) {
                    const r = this.openFileRoots[i];
                    // if r referenced by the new project
                    if (info.defaultProject.references(r)) {
                        // remove project rooted at r
                        this.removeProject(r.defaultProject);
                        // put r in referenced open file list
                        this.openFilesReferenced.push(r);
                        // set default project of r to the new project
                        r.defaultProject = info.defaultProject;
                    }
                    else {
                        // otherwise, keep r as root of inferred project
                        openFileRoots.push(r);
                    }
                }
                this.openFileRoots = openFileRoots;
                this.openFileRoots.push(info);
            }
        }
        this.report("opened", info.fileName, info.defaultProject);
    }
    /**
      * Remove this file from the set of open, non-configured files.
      * @param info The file that has been closed or newly configured
      */
    closeOpenFile(info) {
        // Closing file should trigger re-reading the file content from disk. This is
        // because the user may chose to discard the buffer content before saving
        // to the disk, and the server's version of the file can be out of sync.
        info.svc.reloadFromFile(info.fileName);
        const openFileRoots = [];
        let removedProject;
        for (let i = 0, len = this.openFileRoots.length; i < len; i++) {
            // if closed file is root of project
            if (info === this.openFileRoots[i]) {
                // remove that project and remember it
                removedProject = info.defaultProject;
            }
            else {
                openFileRoots.push(this.openFileRoots[i]);
            }
        }
        this.openFileRoots = openFileRoots;
        if (!removedProject) {
            const openFileRootsConfigured = [];
            for (let i = 0, len = this.openFileRootsConfigured.length; i < len; i++) {
                if (info === this.openFileRootsConfigured[i]) {
                    if (info.defaultProject.deleteOpenRef() === 0) {
                        removedProject = info.defaultProject;
                    }
                }
                else {
                    openFileRootsConfigured.push(this.openFileRootsConfigured[i]);
                }
            }
            this.openFileRootsConfigured = openFileRootsConfigured;
        }
        if (removedProject && !removedProject.isConfiguredProject()) {
            this.removeProject(removedProject);
            const openFilesReferenced = [];
            const orphanFiles = [];
            // for all open, referenced files f
            for (let i = 0, len = this.openFilesReferenced.length; i < len; i++) {
                const f = this.openFilesReferenced[i];
                // if f was referenced by the removed project, remember it
                if (f.defaultProject === removedProject || !f.defaultProject) {
                    f.defaultProject = undefined;
                    orphanFiles.push(f);
                }
                else {
                    // otherwise add it back to the list of referenced files
                    openFilesReferenced.push(f);
                }
            }
            this.openFilesReferenced = openFilesReferenced;
            // treat orphaned files as newly opened
            for (let i = 0, len = orphanFiles.length; i < len; i++) {
                this.addOpenFile(orphanFiles[i]);
            }
        }
        else {
            this.openFilesReferenced = copyListRemovingItem(info, this.openFilesReferenced);
        }
        this.report("closed", info.fileName, info.defaultProject);
        info.close();
    }
    findReferencingProjects(info, excludedProject) {
        const referencingProjects = [];
        info.defaultProject = undefined;
        for (let i = 0, len = this.inferredProjects.length; i < len; i++) {
            const inferredProject = this.inferredProjects[i];
            inferredProject.updateGraph();
            if (inferredProject !== excludedProject) {
                if (inferredProject.references(info)) {
                    info.defaultProject = inferredProject;
                    referencingProjects.push(inferredProject);
                }
            }
        }
        for (let i = 0, len = this.configuredProjects.length; i < len; i++) {
            const configuredProject = this.configuredProjects[i];
            configuredProject.updateGraph();
            if (configuredProject.references(info)) {
                info.defaultProject = configuredProject;
                referencingProjects.push(configuredProject);
            }
        }
        return referencingProjects;
    }
    /**
     * This function rebuilds the project for every file opened by the client
     */
    reloadProjects() {
        this.log("reload projects.");
        // First check if there is new tsconfig file added for inferred project roots
        for (const info of this.openFileRoots) {
            this.openOrUpdateConfiguredProjectForFile(info.fileName);
        }
        this.updateProjectStructure();
    }
    /**
     * This function is to update the project structure for every projects.
     * It is called on the premise that all the configured projects are
     * up to date.
     */
    updateProjectStructure() {
        this.log("updating project structure from ...", "Info");
        this.printProjects();
        const unattachedOpenFiles = [];
        const openFileRootsConfigured = [];
        for (const info of this.openFileRootsConfigured) {
            const project = info.defaultProject;
            if (!project || !(project.references(info))) {
                info.defaultProject = undefined;
                unattachedOpenFiles.push(info);
            }
            else {
                openFileRootsConfigured.push(info);
            }
        }
        this.openFileRootsConfigured = openFileRootsConfigured;
        // First loop through all open files that are referenced by projects but are not
        // project roots.  For each referenced file, see if the default project still
        // references that file.  If so, then just keep the file in the referenced list.
        // If not, add the file to an unattached list, to be rechecked later.
        const openFilesReferenced = [];
        for (let i = 0, len = this.openFilesReferenced.length; i < len; i++) {
            const referencedFile = this.openFilesReferenced[i];
            referencedFile.defaultProject.updateGraph();
            const references = referencedFile.defaultProject.references(referencedFile);
            if (references) {
                openFilesReferenced.push(referencedFile);
            }
            else {
                unattachedOpenFiles.push(referencedFile);
            }
        }
        this.openFilesReferenced = openFilesReferenced;
        // Then, loop through all of the open files that are project roots.
        // For each root file, note the project that it roots.  Then see if
        // any other projects newly reference the file.  If zero projects
        // newly reference the file, keep it as a root.  If one or more
        // projects newly references the file, remove its project from the
        // inferred projects list (since it is no longer a root) and add
        // the file to the open, referenced file list.
        const openFileRoots = [];
        for (let i = 0, len = this.openFileRoots.length; i < len; i++) {
            const rootFile = this.openFileRoots[i];
            const rootedProject = rootFile.defaultProject;
            const referencingProjects = this.findReferencingProjects(rootFile, rootedProject);
            if (rootFile.defaultProject && rootFile.defaultProject.isConfiguredProject()) {
                // If the root file has already been added into a configured project,
                // meaning the original inferred project is gone already.
                if (!rootedProject.isConfiguredProject()) {
                    this.removeProject(rootedProject);
                }
                this.openFileRootsConfigured.push(rootFile);
            }
            else {
                if (referencingProjects.length === 0) {
                    rootFile.defaultProject = rootedProject;
                    openFileRoots.push(rootFile);
                }
                else {
                    // remove project from inferred projects list because root captured
                    this.removeProject(rootedProject);
                    this.openFilesReferenced.push(rootFile);
                }
            }
        }
        this.openFileRoots = openFileRoots;
        // Finally, if we found any open, referenced files that are no longer
        // referenced by their default project, treat them as newly opened
        // by the editor.
        for (let i = 0, len = unattachedOpenFiles.length; i < len; i++) {
            this.addOpenFile(unattachedOpenFiles[i]);
        }
        // Update Angular summaries
        let start = Date.now();
        for (const project of this.configuredProjects) {
            const ngHost = project.compilerService.ngHost;
            if (ngHost.updateAnalyzedModules) {
                // For backwards compatibility
                ngHost.updateAnalyzedModules();
            }
            else {
                ngHost.getAnalyzedModules();
            }
        }
        for (const project of this.inferredProjects) {
            const ngHost = project.compilerService.ngHost;
            if (ngHost.updateAnalyzedModules) {
                // For backwards compatibility
                ngHost.updateAnalyzedModules();
            }
            else {
                ngHost.getAnalyzedModules();
            }
        }
        this.log(`updated: ng - ${Date.now() - start}ms`, "Info");
        this.printProjects();
    }
    getScriptInfo(filename) {
        filename = normalizePath(filename);
        return this.filenameToScriptInfo[filename];
    }
    /**
     * @param filename is absolute pathname
     * @param fileContent is a known version of the file content that is more up to date than the one on disk
     */
    openFile(fileName, openedByClient, fileContent, scriptKind) {
        fileName = normalizePath(fileName);
        let info = this.filenameToScriptInfo[fileName];
        if (!info) {
            let content;
            if (this.host.fileExists(fileName)) {
                content = fileContent || this.host.readFile(fileName);
            }
            if (!content) {
                if (openedByClient) {
                    content = "";
                }
            }
            if (content !== undefined) {
                info = new ScriptInfo(this.host, fileName, content, openedByClient);
                info.scriptKind = scriptKind;
                // info.setFormatOptions(this.getFormatCodeOptions());
                this.filenameToScriptInfo[fileName] = info;
                if (!info.isOpen) {
                    info.fileWatcher = this.host.watchFile(fileName, _ => { this.watchedFileChanged(fileName); });
                }
            }
        }
        if (info) {
            if (fileContent) {
                info.svc.reload(fileContent);
            }
            if (openedByClient) {
                info.isOpen = true;
            }
        }
        return info;
    }
    // This is different from the method the compiler uses because
    // the compiler can assume it will always start searching in the
    // current directory (the directory in which tsc was invoked).
    // The server must start searching from the directory containing
    // the newly opened file.
    findConfigFile(searchPath) {
        while (true) {
            const tsconfigFileName = combinePaths(searchPath, "tsconfig.json");
            if (this.host.fileExists(tsconfigFileName)) {
                return tsconfigFileName;
            }
            const jsconfigFileName = combinePaths(searchPath, "jsconfig.json");
            if (this.host.fileExists(jsconfigFileName)) {
                return jsconfigFileName;
            }
            const parentPath = getDirectoryPath(searchPath);
            if (parentPath === searchPath) {
                break;
            }
            searchPath = parentPath;
        }
        return undefined;
    }
    /**
     * Open file whose contents is managed by the client
     * @param filename is absolute pathname
     * @param fileContent is a known version of the file content that is more up to date than the one on disk
     */
    openClientFile(fileName, fileContent, scriptKind) {
        const { configFileName, configFileErrors } = this.openOrUpdateConfiguredProjectForFile(fileName);
        const info = this.openFile(fileName, /*openedByClient*/ true, fileContent, scriptKind);
        this.addOpenFile(info);
        this.printProjects();
        this.report("opened", info.fileName);
        return { configFileName, configFileErrors };
    }
    /**
     * Report a client file change.
     */
    clientFileChanges(fileName, changes) {
        const file = normalizePath(fileName);
        const project = this.getProjectForFile(file);
        if (project && !project.languageServiceDisabled) {
            const compilerService = project.compilerService;
            for (const change of changes) {
                if (change.start >= 0) {
                    compilerService.host.editScript(file, change.start, change.end, change.insertText);
                    this.changeSeq++;
                }
            }
            this.requestUpdateProjectStructure(this.changeSeq, (n) => n === this.changeSeq);
        }
        this.report("change", file, project);
    }
    reloadScript(filename) {
        const info = this.filenameToScriptInfo[filename];
        if (info) {
            info.svc.reloadFromFile(filename);
            this.changeSeq++;
            this.report("change", info.fileName);
        }
    }
    forcedGetProjectForFile(fileName) {
        const file = normalizePath(fileName);
        const info = this.filenameToScriptInfo[file];
        if (info) {
            let project = info.defaultProject;
            if (!project) {
                // Force the association of the info with a default project.
                this.findReferencingProjects(info);
                project = info.defaultProject;
            }
            return project;
        }
    }
    lineOffsetsToPositions(fileName, positions) {
        const project = this.forcedGetProjectForFile(fileName);
        if (project && !project.languageServiceDisabled) {
            const compilerService = project.compilerService;
            return positions.map(position => compilerService.host.lineOffsetToPosition(fileName, position.line, position.col));
        }
    }
    positionsToLineOffsets(fileName, offsets) {
        const project = this.forcedGetProjectForFile(fileName);
        if (project && !project.languageServiceDisabled) {
            const compilerService = project.compilerService;
            return offsets.map(offset => compilerService.host.positionToLineOffset(fileName, offset)).map(pos => ({ line: pos.line, col: pos.offset }));
        }
    }
    positionToLineOffset(fileName, offset) {
        const project = this.forcedGetProjectForFile(fileName);
        if (project && !project.languageServiceDisabled) {
            const compilerService = project.compilerService;
            return compilerService.host.positionToLineOffset(fileName, offset);
        }
    }
    requestUpdateProjectStructure(changeSeq, matchSeq) {
        this.host.setTimeout(() => {
            if (matchSeq(changeSeq)) {
                this.updateProjectStructure();
            }
        }, 1500);
    }
    /**
     * This function tries to search for a tsconfig.json for the given file. If we found it,
     * we first detect if there is already a configured project created for it: if so, we re-read
     * the tsconfig file content and update the project; otherwise we create a new one.
     */
    openOrUpdateConfiguredProjectForFile(fileName) {
        const searchPath = normalizePath(getDirectoryPath(fileName));
        this.log("Search path: " + searchPath, "Info");
        const configFileName = this.findConfigFile(searchPath);
        if (configFileName) {
            this.log("Config file name: " + configFileName, "Info");
            const project = this.findConfiguredProjectByConfigFile(configFileName);
            if (!project) {
                const configResult = this.openConfigFile(configFileName, fileName);
                if (!configResult.project) {
                    return { configFileName, configFileErrors: configResult.errors };
                }
                else {
                    // even if opening config file was successful, it could still
                    // contain errors that were tolerated.
                    this.log("Opened configuration file " + configFileName, "Info");
                    this.configuredProjects.push(configResult.project);
                    if (configResult.errors && configResult.errors.length > 0) {
                        return { configFileName, configFileErrors: configResult.errors };
                    }
                }
            }
            return { configFileName };
        }
        else {
            this.log("No config files found.");
        }
        return {};
    }
    /**
     * Close file whose contents is managed by the client
     * @param filename is absolute pathname
     */
    closeClientFile(filename) {
        const info = this.filenameToScriptInfo[filename];
        if (info) {
            this.closeOpenFile(info);
            info.isOpen = false;
            this.report("closed", info.fileName);
        }
        this.printProjects();
    }
    getProjectForFile(filename) {
        const scriptInfo = this.filenameToScriptInfo[filename];
        if (scriptInfo) {
            return scriptInfo.defaultProject;
        }
    }
    printProjectsForFile(filename) {
        const scriptInfo = this.filenameToScriptInfo[filename];
        if (scriptInfo) {
            this.psLogger.startGroup();
            this.psLogger.info("Projects for " + filename);
            const projects = this.findReferencingProjects(scriptInfo);
            for (let i = 0, len = projects.length; i < len; i++) {
                this.psLogger.info("Project " + i.toString());
            }
            this.psLogger.endGroup();
        }
        else {
            this.psLogger.info(filename + " not in any project");
        }
    }
    printProjects() {
        if (!this.psLogger.isVerbose()) {
            return;
        }
        this.psLogger.startGroup();
        for (let i = 0, len = this.inferredProjects.length; i < len; i++) {
            const project = this.inferredProjects[i];
            project.updateGraph();
            this.psLogger.info("Project " + i.toString());
            this.psLogger.info(project.filesToString());
            this.psLogger.info("-----------------------------------------------");
        }
        for (let i = 0, len = this.configuredProjects.length; i < len; i++) {
            const project = this.configuredProjects[i];
            project.updateGraph();
            this.psLogger.info("Project (configured) " + (i + this.inferredProjects.length).toString());
            this.psLogger.info(project.filesToString());
            this.psLogger.info("-----------------------------------------------");
        }
        this.psLogger.info("Open file roots of inferred projects: ");
        for (let i = 0, len = this.openFileRoots.length; i < len; i++) {
            this.psLogger.info(this.openFileRoots[i].fileName);
        }
        this.psLogger.info("Open files referenced by inferred or configured projects: ");
        for (let i = 0, len = this.openFilesReferenced.length; i < len; i++) {
            let fileInfo = this.openFilesReferenced[i].fileName;
            if (this.openFilesReferenced[i].defaultProject.isConfiguredProject()) {
                fileInfo += " (configured)";
            }
            this.psLogger.info(fileInfo);
        }
        this.psLogger.info("Open file roots of configured projects: ");
        for (let i = 0, len = this.openFileRootsConfigured.length; i < len; i++) {
            this.psLogger.info(this.openFileRootsConfigured[i].fileName);
        }
        this.psLogger.endGroup();
    }
    configProjectIsActive(fileName) {
        return this.findConfiguredProjectByConfigFile(fileName) === undefined;
    }
    findConfiguredProjectByConfigFile(configFileName) {
        for (let i = 0, len = this.configuredProjects.length; i < len; i++) {
            if (this.configuredProjects[i].projectFilename == configFileName) {
                return this.configuredProjects[i];
            }
        }
        return undefined;
    }
    configFileToProjectOptions(configFilename) {
        configFilename = normalizePath(configFilename);
        let errors = [];
        // file references will be relative to dirPath (or absolute)
        const dirPath = getDirectoryPath(configFilename);
        const contents = this.host.readFile(configFilename);
        const { config, error } = ts.parseConfigFileTextToJson(configFilename, contents);
        if (error) {
            errors.push(error);
        }
        const parsedCommandLine = ts.parseJsonConfigFileContent(config, this.host, dirPath, /*existingOptions*/ {}, configFilename);
        errors = concatenate(errors, parsedCommandLine.errors);
        //      Debug.assert(!!parsedCommandLine.fileNames);
        if (parsedCommandLine.fileNames.length === 0) {
            // errors.push(createCompilerDiagnostic(Diagnostics.The_config_file_0_found_doesn_t_contain_any_source_files, configFilename));
            return { errors };
        }
        else {
            // if the project has some files, we can continue with the parsed options and tolerate
            // errors in the parsedCommandLine
            const projectOptions = {
                files: parsedCommandLine.fileNames,
                wildcardDirectories: parsedCommandLine.wildcardDirectories,
                compilerOptions: parsedCommandLine.options,
            };
            return { projectOptions, errors };
        }
    }
    openConfigFile(configFilename, clientFileName) {
        const parseConfigFileResult = this.configFileToProjectOptions(configFilename);
        let errors = parseConfigFileResult.errors;
        if (!parseConfigFileResult.projectOptions) {
            return { errors };
        }
        const projectOptions = parseConfigFileResult.projectOptions;
        const project = this.createProject(configFilename, projectOptions);
        for (const rootFilename of projectOptions.files) {
            if (this.host.fileExists(rootFilename)) {
                const info = this.openFile(rootFilename, /*openedByClient*/ clientFileName == rootFilename);
                project.addRoot(info);
            }
        }
        project.finishGraph();
        project.projectFileWatcher = this.host.watchFile(configFilename, _ => this.watchedProjectConfigFileChanged(project));
        const configDirectoryPath = getDirectoryPath(configFilename);
        this.log("Add recursive watcher for: " + configDirectoryPath);
        project.directoryWatcher = this.host.watchDirectory(configDirectoryPath, path => this.directoryWatchedForSourceFilesChanged(project, path), 
        /*recursive*/ true);
        project.directoriesWatchedForWildcards = reduceProperties(createMap(projectOptions.wildcardDirectories), (watchers, flag, directory) => {
            if (comparePaths(configDirectoryPath, directory, ".", !this.host.useCaseSensitiveFileNames) !== 0 /* EqualTo */) {
                const recursive = (flag & ts.WatchDirectoryFlags.Recursive) !== 0;
                this.log(`Add ${recursive ? "recursive " : ""}watcher for: ${directory}`);
                watchers[directory] = this.host.watchDirectory(directory, path => this.directoryWatchedForSourceFilesChanged(project, path), recursive);
            }
            return watchers;
        }, {});
        return { project: project, errors };
    }
    updateConfiguredProject(project) {
        if (!this.host.fileExists(project.projectFilename)) {
            this.log("Config file deleted");
            this.removeProject(project);
        }
        else {
            const { projectOptions, errors } = this.configFileToProjectOptions(project.projectFilename);
            if (!projectOptions) {
                return errors;
            }
            else {
                if (project.languageServiceDisabled) {
                    project.setProjectOptions(projectOptions);
                    project.enableLanguageService();
                    project.directoryWatcher = this.host.watchDirectory(getDirectoryPath(project.projectFilename), path => this.directoryWatchedForSourceFilesChanged(project, path), 
                    /*recursive*/ true);
                    for (const rootFilename of projectOptions.files) {
                        if (this.host.fileExists(rootFilename)) {
                            const info = this.openFile(rootFilename, /*openedByClient*/ false);
                            project.addRoot(info);
                        }
                    }
                    project.finishGraph();
                    return errors;
                }
                // if the project is too large, the root files might not have been all loaded if the total
                // program size reached the upper limit. In that case project.projectOptions.files should
                // be more precise. However this would only happen for configured project.
                const oldFileNames = project.projectOptions ? project.projectOptions.files : project.compilerService.host.roots.map(info => info.fileName);
                const newFileNames = filter(projectOptions.files, f => this.host.fileExists(f));
                const fileNamesToRemove = oldFileNames.filter(f => newFileNames.indexOf(f) < 0);
                const fileNamesToAdd = newFileNames.filter(f => oldFileNames.indexOf(f) < 0);
                for (const fileName of fileNamesToRemove) {
                    const info = this.getScriptInfo(fileName);
                    if (info) {
                        project.removeRoot(info);
                    }
                }
                for (const fileName of fileNamesToAdd) {
                    let info = this.getScriptInfo(fileName);
                    if (!info) {
                        info = this.openFile(fileName, /*openedByClient*/ false);
                    }
                    else {
                        // if the root file was opened by client, it would belong to either
                        // openFileRoots or openFileReferenced.
                        if (info.isOpen) {
                            if (this.openFileRoots.indexOf(info) >= 0) {
                                this.openFileRoots = copyListRemovingItem(info, this.openFileRoots);
                                if (info.defaultProject && !info.defaultProject.isConfiguredProject()) {
                                    this.removeProject(info.defaultProject);
                                }
                            }
                            if (this.openFilesReferenced.indexOf(info) >= 0) {
                                this.openFilesReferenced = copyListRemovingItem(info, this.openFilesReferenced);
                            }
                            this.openFileRootsConfigured.push(info);
                            info.defaultProject = project;
                        }
                    }
                    project.addRoot(info);
                }
                project.setProjectOptions(projectOptions);
                project.finishGraph();
            }
            return errors;
        }
    }
    createProject(projectFilename, projectOptions, languageServiceDisabled) {
        const project = new Project(this, this.psLogger, this.documentRegistry, projectOptions, languageServiceDisabled);
        project.projectFilename = projectFilename;
        return project;
    }
}
exports.ProjectService = ProjectService;
class CompilerService {
    constructor(project, logger, documentRegistry, opt) {
        this.project = project;
        this.logger = logger;
        this.documentRegistry = documentRegistry;
        this.host = new LSHost(project.projectService.host, project);
        if (opt) {
            this.setCompilerOptions(opt);
        }
        else {
            const defaultOpts = ts.getDefaultCompilerOptions();
            defaultOpts['allowNonTsExtensions'] = true;
            defaultOpts.allowJs = true;
            this.setCompilerOptions(defaultOpts);
        }
        this.languageService = ts.createLanguageService(this.host, this.documentRegistry);
        this.ng = this.resolveLanguageServiceModule();
        this.log(`Angular Language Service: ${this.ng.VERSION.full}`);
        this.log(`TypeScript: ${ts.version}`);
        this.ngHost = new this.ng.TypeScriptServiceHost(this.host, this.languageService);
        this.ngService = logServiceTimes(logger, this.ng.createLanguageService(this.ngHost));
        if (this.ngHost.setSite) {
            this.ngHost.setSite(this.ngService);
        }
        this.classifier = ts.createClassifier();
    }
    setCompilerOptions(opt) {
        this.settings = opt;
        this.host.setCompilationSettings(opt);
    }
    isExternalModule(filename) {
        const sourceFile = this.languageService.getNonBoundSourceFile(filename);
        return ts.isExternalModule(sourceFile);
    }
    resolveLanguageServiceModule() {
        const host = path.resolve(this.host.getCurrentDirectory(), 'main.ts');
        const modules = this.host.resolveModuleNames(['@angular/language-service'], host);
        let result = ng;
        if (modules && modules[0]) {
            const resolvedModule = modules[0];
            const moduleName = path.dirname(resolvedModule.resolvedFileName);
            if (fs.existsSync(moduleName)) {
                try {
                    result = require(moduleName) || result;
                }
                catch (e) {
                    this.log(`Error loading module "${moduleName}"; using local language service instead`);
                    this.log(e.stack);
                }
            }
        }
        if (typeof result === 'function') {
            // The language service bundle exposes a function to allow hooking module dependencies
            // such as TypeScript.
            result = result({ typescript: ts });
        }
        return result;
    }
    log(message) {
        return this.logger.msg(message);
    }
    static getDefaultFormatCodeOptions(host) {
        return clone({
            BaseIndentSize: 0,
            IndentSize: 4,
            TabSize: 4,
            NewLineCharacter: host.newLine || "\n",
            ConvertTabsToSpaces: true,
            IndentStyle: ts.IndentStyle.Smart,
            InsertSpaceAfterCommaDelimiter: true,
            InsertSpaceAfterSemicolonInForStatements: true,
            InsertSpaceBeforeAndAfterBinaryOperators: true,
            InsertSpaceAfterKeywordsInControlFlowStatements: true,
            InsertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
            InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            InsertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
            PlaceOpenBraceOnNewLineForFunctions: false,
            PlaceOpenBraceOnNewLineForControlBlocks: false,
        });
    }
}
exports.CompilerService = CompilerService;
var CharRangeSection;
(function (CharRangeSection) {
    CharRangeSection[CharRangeSection["PreStart"] = 0] = "PreStart";
    CharRangeSection[CharRangeSection["Start"] = 1] = "Start";
    CharRangeSection[CharRangeSection["Entire"] = 2] = "Entire";
    CharRangeSection[CharRangeSection["Mid"] = 3] = "Mid";
    CharRangeSection[CharRangeSection["End"] = 4] = "End";
    CharRangeSection[CharRangeSection["PostEnd"] = 5] = "PostEnd";
})(CharRangeSection = exports.CharRangeSection || (exports.CharRangeSection = {}));
class BaseLineIndexWalker {
    constructor() {
        this.goSubtree = true;
        this.done = false;
    }
    leaf(rangeStart, rangeLength, ll) {
    }
}
class EditWalker extends BaseLineIndexWalker {
    constructor() {
        super();
        this.lineIndex = new LineIndex();
        this.endBranch = [];
        this.state = CharRangeSection.Entire;
        this.initialText = "";
        this.trailingText = "";
        this.suppressTrailingText = false;
        this.lineIndex.root = new LineNode();
        this.startPath = [this.lineIndex.root];
        this.stack = [this.lineIndex.root];
    }
    insertLines(insertedText) {
        if (this.suppressTrailingText) {
            this.trailingText = "";
        }
        if (insertedText) {
            insertedText = this.initialText + insertedText + this.trailingText;
        }
        else {
            insertedText = this.initialText + this.trailingText;
        }
        const lm = LineIndex.linesFromText(insertedText);
        const lines = lm.lines;
        if (lines.length > 1) {
            if (lines[lines.length - 1] == "") {
                lines.length--;
            }
        }
        let branchParent;
        let lastZeroCount;
        for (let k = this.endBranch.length - 1; k >= 0; k--) {
            this.endBranch[k].updateCounts();
            if (this.endBranch[k].charCount() === 0) {
                lastZeroCount = this.endBranch[k];
                if (k > 0) {
                    branchParent = this.endBranch[k - 1];
                }
                else {
                    branchParent = this.branchNode;
                }
            }
        }
        if (lastZeroCount) {
            branchParent.remove(lastZeroCount);
        }
        // path at least length two (root and leaf)
        let insertionNode = this.startPath[this.startPath.length - 2];
        const leafNode = this.startPath[this.startPath.length - 1];
        const len = lines.length;
        if (len > 0) {
            leafNode.text = lines[0];
            if (len > 1) {
                let insertedNodes = new Array(len - 1);
                let startNode = leafNode;
                for (let i = 1, len = lines.length; i < len; i++) {
                    insertedNodes[i - 1] = new LineLeaf(lines[i]);
                }
                let pathIndex = this.startPath.length - 2;
                while (pathIndex >= 0) {
                    insertionNode = this.startPath[pathIndex];
                    insertedNodes = insertionNode.insertAt(startNode, insertedNodes);
                    pathIndex--;
                    startNode = insertionNode;
                }
                let insertedNodesLen = insertedNodes.length;
                while (insertedNodesLen > 0) {
                    const newRoot = new LineNode();
                    newRoot.add(this.lineIndex.root);
                    insertedNodes = newRoot.insertAt(this.lineIndex.root, insertedNodes);
                    insertedNodesLen = insertedNodes.length;
                    this.lineIndex.root = newRoot;
                }
                this.lineIndex.root.updateCounts();
            }
            else {
                for (let j = this.startPath.length - 2; j >= 0; j--) {
                    this.startPath[j].updateCounts();
                }
            }
        }
        else {
            // no content for leaf node, so delete it
            insertionNode.remove(leafNode);
            for (let j = this.startPath.length - 2; j >= 0; j--) {
                this.startPath[j].updateCounts();
            }
        }
        return this.lineIndex;
    }
    post(relativeStart, relativeLength, lineCollection, parent, nodeType) {
        // have visited the path for start of range, now looking for end
        // if range is on single line, we will never make this state transition
        if (lineCollection === this.lineCollectionAtBranch) {
            this.state = CharRangeSection.End;
        }
        // always pop stack because post only called when child has been visited
        this.stack.length--;
        return undefined;
    }
    pre(relativeStart, relativeLength, lineCollection, parent, nodeType) {
        // currentNode corresponds to parent, but in the new tree
        const currentNode = this.stack[this.stack.length - 1];
        if ((this.state === CharRangeSection.Entire) && (nodeType === CharRangeSection.Start)) {
            // if range is on single line, we will never make this state transition
            this.state = CharRangeSection.Start;
            this.branchNode = currentNode;
            this.lineCollectionAtBranch = lineCollection;
        }
        let child;
        function fresh(node) {
            if (node.isLeaf()) {
                return new LineLeaf("");
            }
            else
                return new LineNode();
        }
        switch (nodeType) {
            case CharRangeSection.PreStart:
                this.goSubtree = false;
                if (this.state !== CharRangeSection.End) {
                    currentNode.add(lineCollection);
                }
                break;
            case CharRangeSection.Start:
                if (this.state === CharRangeSection.End) {
                    this.goSubtree = false;
                }
                else {
                    child = fresh(lineCollection);
                    currentNode.add(child);
                    this.startPath[this.startPath.length] = child;
                }
                break;
            case CharRangeSection.Entire:
                if (this.state !== CharRangeSection.End) {
                    child = fresh(lineCollection);
                    currentNode.add(child);
                    this.startPath[this.startPath.length] = child;
                }
                else {
                    if (!lineCollection.isLeaf()) {
                        child = fresh(lineCollection);
                        currentNode.add(child);
                        this.endBranch[this.endBranch.length] = child;
                    }
                }
                break;
            case CharRangeSection.Mid:
                this.goSubtree = false;
                break;
            case CharRangeSection.End:
                if (this.state !== CharRangeSection.End) {
                    this.goSubtree = false;
                }
                else {
                    if (!lineCollection.isLeaf()) {
                        child = fresh(lineCollection);
                        currentNode.add(child);
                        this.endBranch[this.endBranch.length] = child;
                    }
                }
                break;
            case CharRangeSection.PostEnd:
                this.goSubtree = false;
                if (this.state !== CharRangeSection.Start) {
                    currentNode.add(lineCollection);
                }
                break;
        }
        if (this.goSubtree) {
            this.stack[this.stack.length] = child;
        }
        return lineCollection;
    }
    // just gather text from the leaves
    leaf(relativeStart, relativeLength, ll) {
        if (this.state === CharRangeSection.Start) {
            this.initialText = ll.text.substring(0, relativeStart);
        }
        else if (this.state === CharRangeSection.Entire) {
            this.initialText = ll.text.substring(0, relativeStart);
            this.trailingText = ll.text.substring(relativeStart + relativeLength);
        }
        else {
            // state is CharRangeSection.End
            this.trailingText = ll.text.substring(relativeStart + relativeLength);
        }
    }
}
// text change information
class TextChange {
    constructor(pos, deleteLen, insertedText) {
        this.pos = pos;
        this.deleteLen = deleteLen;
        this.insertedText = insertedText;
    }
    getTextChangeRange() {
        return ts.createTextChangeRange(ts.createTextSpan(this.pos, this.deleteLen), this.insertedText ? this.insertedText.length : 0);
    }
}
exports.TextChange = TextChange;
class ScriptVersionCache {
    constructor() {
        this.changes = [];
        this.versions = [];
        this.minVersion = 0; // no versions earlier than min version will maintain change history
        this.currentVersion = 0;
    }
    // REVIEW: can optimize by coalescing simple edits
    edit(pos, deleteLen, insertedText) {
        this.changes[this.changes.length] = new TextChange(pos, deleteLen, insertedText);
        if ((this.changes.length > ScriptVersionCache.changeNumberThreshold) ||
            (deleteLen > ScriptVersionCache.changeLengthThreshold) ||
            (insertedText && (insertedText.length > ScriptVersionCache.changeLengthThreshold))) {
            this.getSnapshot();
        }
    }
    latest() {
        return this.versions[this.currentVersion];
    }
    latestVersion() {
        if (this.changes.length > 0) {
            this.getSnapshot();
        }
        return this.currentVersion;
    }
    reloadFromFile(filename, cb) {
        let content = this.host.readFile(filename);
        // If the file doesn't exist or cannot be read, we should
        // wipe out its cached content on the server to avoid side effects.
        if (!content) {
            content = "";
        }
        this.reload(content);
        if (cb)
            cb();
    }
    // reload whole script, leaving no change history behind reload
    reload(script) {
        this.currentVersion++;
        this.changes = []; // history wiped out by reload
        const snap = new LineIndexSnapshot(this.currentVersion, this);
        this.versions[this.currentVersion] = snap;
        snap.index = new LineIndex();
        const lm = LineIndex.linesFromText(script);
        snap.index.load(lm.lines);
        // REVIEW: could use linked list
        for (let i = this.minVersion; i < this.currentVersion; i++) {
            this.versions[i] = undefined;
        }
        this.minVersion = this.currentVersion;
    }
    getSnapshot() {
        let snap = this.versions[this.currentVersion];
        if (this.changes.length > 0) {
            let snapIndex = this.latest().index;
            for (let i = 0, len = this.changes.length; i < len; i++) {
                const change = this.changes[i];
                snapIndex = snapIndex.edit(change.pos, change.deleteLen, change.insertedText);
            }
            snap = new LineIndexSnapshot(this.currentVersion + 1, this);
            snap.index = snapIndex;
            snap.changesSincePreviousVersion = this.changes;
            this.currentVersion = snap.version;
            this.versions[snap.version] = snap;
            this.changes = [];
            if ((this.currentVersion - this.minVersion) >= ScriptVersionCache.maxVersions) {
                const oldMin = this.minVersion;
                this.minVersion = (this.currentVersion - ScriptVersionCache.maxVersions) + 1;
                for (let j = oldMin; j < this.minVersion; j++) {
                    this.versions[j] = undefined;
                }
            }
        }
        return snap;
    }
    getTextChangesBetweenVersions(oldVersion, newVersion) {
        if (oldVersion < newVersion) {
            if (oldVersion >= this.minVersion) {
                const textChangeRanges = [];
                for (let i = oldVersion + 1; i <= newVersion; i++) {
                    const snap = this.versions[i];
                    for (let j = 0, len = snap.changesSincePreviousVersion.length; j < len; j++) {
                        const textChange = snap.changesSincePreviousVersion[j];
                        textChangeRanges[textChangeRanges.length] = textChange.getTextChangeRange();
                    }
                }
                return ts.collapseTextChangeRangesAcrossMultipleVersions(textChangeRanges);
            }
            else {
                return undefined;
            }
        }
        else {
            return ts.unchangedTextChangeRange;
        }
    }
    static fromString(host, script) {
        const svc = new ScriptVersionCache();
        const snap = new LineIndexSnapshot(0, svc);
        svc.versions[svc.currentVersion] = snap;
        svc.host = host;
        snap.index = new LineIndex();
        const lm = LineIndex.linesFromText(script);
        snap.index.load(lm.lines);
        return svc;
    }
}
ScriptVersionCache.changeNumberThreshold = 8;
ScriptVersionCache.changeLengthThreshold = 256;
ScriptVersionCache.maxVersions = 8;
exports.ScriptVersionCache = ScriptVersionCache;
class LineIndexSnapshot {
    constructor(version, cache) {
        this.version = version;
        this.cache = cache;
        this.changesSincePreviousVersion = [];
    }
    getText(rangeStart, rangeEnd) {
        return this.index.getText(rangeStart, rangeEnd - rangeStart);
    }
    getLength() {
        return this.index.root.charCount();
    }
    // this requires linear space so don't hold on to these
    getLineStartPositions() {
        const starts = [-1];
        let count = 1;
        let pos = 0;
        this.index.every((ll, s, len) => {
            starts[count] = pos;
            count++;
            pos += ll.text.length;
            return true;
        }, 0);
        return starts;
    }
    getLineMapper() {
        return (line) => {
            return this.index.lineNumberToInfo(line).offset;
        };
    }
    getTextChangeRangeSinceVersion(scriptVersion) {
        if (this.version <= scriptVersion) {
            return ts.unchangedTextChangeRange;
        }
        else {
            return this.cache.getTextChangesBetweenVersions(scriptVersion, this.version);
        }
    }
    getChangeRange(oldSnapshot) {
        const oldSnap = oldSnapshot;
        return this.getTextChangeRangeSinceVersion(oldSnap.version);
    }
}
exports.LineIndexSnapshot = LineIndexSnapshot;
class LineIndex {
    constructor() {
        // set this to true to check each edit for accuracy
        this.checkEdits = false;
    }
    charOffsetToLineNumberAndPos(charOffset) {
        return this.root.charOffsetToLineNumberAndPos(1, charOffset);
    }
    lineNumberToInfo(lineNumber) {
        const lineCount = this.root.lineCount();
        if (lineNumber <= lineCount) {
            const lineInfo = this.root.lineNumberToInfo(lineNumber, 0);
            lineInfo.line = lineNumber;
            return lineInfo;
        }
        else {
            return {
                line: lineNumber,
                offset: this.root.charCount()
            };
        }
    }
    load(lines) {
        if (lines.length > 0) {
            const leaves = [];
            for (let i = 0, len = lines.length; i < len; i++) {
                leaves[i] = new LineLeaf(lines[i]);
            }
            this.root = LineIndex.buildTreeFromBottom(leaves);
        }
        else {
            this.root = new LineNode();
        }
    }
    walk(rangeStart, rangeLength, walkFns) {
        this.root.walk(rangeStart, rangeLength, walkFns);
    }
    getText(rangeStart, rangeLength) {
        let accum = "";
        if ((rangeLength > 0) && (rangeStart < this.root.charCount())) {
            this.walk(rangeStart, rangeLength, {
                goSubtree: true,
                done: false,
                leaf: (relativeStart, relativeLength, ll) => {
                    accum = accum.concat(ll.text.substring(relativeStart, relativeStart + relativeLength));
                }
            });
        }
        return accum;
    }
    getLength() {
        return this.root.charCount();
    }
    every(f, rangeStart, rangeEnd) {
        if (!rangeEnd) {
            rangeEnd = this.root.charCount();
        }
        const walkFns = {
            goSubtree: true,
            done: false,
            leaf: function (relativeStart, relativeLength, ll) {
                if (!f(ll, relativeStart, relativeLength)) {
                    walkFns.done = true;
                }
            }
        };
        this.walk(rangeStart, rangeEnd - rangeStart, walkFns);
        return !walkFns.done;
    }
    edit(pos, deleteLength, newText) {
        function editFlat(source, s, dl, nt = "") {
            return source.substring(0, s) + nt + source.substring(s + dl, source.length);
        }
        if (this.root.charCount() === 0) {
            // TODO: assert deleteLength === 0
            if (newText) {
                this.load(LineIndex.linesFromText(newText).lines);
                return this;
            }
        }
        else {
            let checkText;
            if (this.checkEdits) {
                checkText = editFlat(this.getText(0, this.root.charCount()), pos, deleteLength, newText);
            }
            const walker = new EditWalker();
            if (pos >= this.root.charCount()) {
                // insert at end
                pos = this.root.charCount() - 1;
                const endString = this.getText(pos, 1);
                if (newText) {
                    newText = endString + newText;
                }
                else {
                    newText = endString;
                }
                deleteLength = 0;
                walker.suppressTrailingText = true;
            }
            else if (deleteLength > 0) {
                // check whether last characters deleted are line break
                const e = pos + deleteLength;
                const lineInfo = this.charOffsetToLineNumberAndPos(e);
                if ((lineInfo && (lineInfo.offset === 0))) {
                    // move range end just past line that will merge with previous line
                    deleteLength += lineInfo.text.length;
                    // store text by appending to end of insertedText
                    if (newText) {
                        newText = newText + lineInfo.text;
                    }
                    else {
                        newText = lineInfo.text;
                    }
                }
            }
            if (pos < this.root.charCount()) {
                this.root.walk(pos, deleteLength, walker);
                walker.insertLines(newText);
            }
            if (this.checkEdits) {
                const updatedText = this.getText(0, this.root.charCount());
                //   Debug.assert(checkText == updatedText, "buffer edit mismatch");
            }
            return walker.lineIndex;
        }
    }
    static buildTreeFromBottom(nodes) {
        const nodeCount = Math.ceil(nodes.length / lineCollectionCapacity);
        const interiorNodes = [];
        let nodeIndex = 0;
        for (let i = 0; i < nodeCount; i++) {
            interiorNodes[i] = new LineNode();
            let charCount = 0;
            let lineCount = 0;
            for (let j = 0; j < lineCollectionCapacity; j++) {
                if (nodeIndex < nodes.length) {
                    interiorNodes[i].add(nodes[nodeIndex]);
                    charCount += nodes[nodeIndex].charCount();
                    lineCount += nodes[nodeIndex].lineCount();
                }
                else {
                    break;
                }
                nodeIndex++;
            }
            interiorNodes[i].totalChars = charCount;
            interiorNodes[i].totalLines = lineCount;
        }
        if (interiorNodes.length === 1) {
            return interiorNodes[0];
        }
        else {
            return this.buildTreeFromBottom(interiorNodes);
        }
    }
    static linesFromText(text) {
        const lineStarts = computeLineStarts(text);
        if (lineStarts.length === 0) {
            return { lines: [], lineMap: lineStarts };
        }
        const lines = new Array(lineStarts.length);
        const lc = lineStarts.length - 1;
        for (let lmi = 0; lmi < lc; lmi++) {
            lines[lmi] = text.substring(lineStarts[lmi], lineStarts[lmi + 1]);
        }
        const endText = text.substring(lineStarts[lc]);
        if (endText.length > 0) {
            lines[lc] = endText;
        }
        else {
            lines.length--;
        }
        return { lines: lines, lineMap: lineStarts };
    }
}
exports.LineIndex = LineIndex;
class LineNode {
    constructor() {
        this.totalChars = 0;
        this.totalLines = 0;
        this.children = [];
    }
    isLeaf() {
        return false;
    }
    updateCounts() {
        this.totalChars = 0;
        this.totalLines = 0;
        for (let i = 0, len = this.children.length; i < len; i++) {
            const child = this.children[i];
            this.totalChars += child.charCount();
            this.totalLines += child.lineCount();
        }
    }
    execWalk(rangeStart, rangeLength, walkFns, childIndex, nodeType) {
        if (walkFns.pre) {
            walkFns.pre(rangeStart, rangeLength, this.children[childIndex], this, nodeType);
        }
        if (walkFns.goSubtree) {
            this.children[childIndex].walk(rangeStart, rangeLength, walkFns);
            if (walkFns.post) {
                walkFns.post(rangeStart, rangeLength, this.children[childIndex], this, nodeType);
            }
        }
        else {
            walkFns.goSubtree = true;
        }
        return walkFns.done;
    }
    skipChild(relativeStart, relativeLength, childIndex, walkFns, nodeType) {
        if (walkFns.pre && (!walkFns.done)) {
            walkFns.pre(relativeStart, relativeLength, this.children[childIndex], this, nodeType);
            walkFns.goSubtree = true;
        }
    }
    walk(rangeStart, rangeLength, walkFns) {
        // assume (rangeStart < this.totalChars) && (rangeLength <= this.totalChars)
        let childIndex = 0;
        let child = this.children[0];
        if (!child)
            return;
        let childCharCount = child.charCount();
        // find sub-tree containing start
        let adjustedStart = rangeStart;
        while (adjustedStart >= childCharCount) {
            this.skipChild(adjustedStart, rangeLength, childIndex, walkFns, CharRangeSection.PreStart);
            adjustedStart -= childCharCount;
            childIndex++;
            child = this.children[childIndex];
            if (!child)
                break;
            childCharCount = child.charCount();
        }
        // Case I: both start and end of range in same subtree
        if ((adjustedStart + rangeLength) <= childCharCount) {
            if (this.execWalk(adjustedStart, rangeLength, walkFns, childIndex, CharRangeSection.Entire)) {
                return;
            }
        }
        else {
            // Case II: start and end of range in different subtrees (possibly with subtrees in the middle)
            if (this.execWalk(adjustedStart, childCharCount - adjustedStart, walkFns, childIndex, CharRangeSection.Start)) {
                return;
            }
            let adjustedLength = rangeLength - (childCharCount - adjustedStart);
            childIndex++;
            child = this.children[childIndex];
            childCharCount = child.charCount();
            while (adjustedLength > childCharCount) {
                if (this.execWalk(0, childCharCount, walkFns, childIndex, CharRangeSection.Mid)) {
                    return;
                }
                adjustedLength -= childCharCount;
                childIndex++;
                child = this.children[childIndex];
                if (!child)
                    break;
                childCharCount = child.charCount();
            }
            if (adjustedLength > 0) {
                if (this.execWalk(0, adjustedLength, walkFns, childIndex, CharRangeSection.End)) {
                    return;
                }
            }
        }
        // Process any subtrees after the one containing range end
        if (walkFns.pre) {
            const clen = this.children.length;
            if (childIndex < (clen - 1)) {
                for (let ej = childIndex + 1; ej < clen; ej++) {
                    this.skipChild(0, 0, ej, walkFns, CharRangeSection.PostEnd);
                }
            }
        }
    }
    charOffsetToLineNumberAndPos(lineNumber, charOffset) {
        const childInfo = this.childFromCharOffset(lineNumber, charOffset);
        if (!childInfo.child) {
            return {
                line: lineNumber,
                offset: charOffset,
            };
        }
        else if (childInfo.childIndex < this.children.length) {
            if (childInfo.child.isLeaf()) {
                return {
                    line: childInfo.lineNumber,
                    offset: childInfo.charOffset,
                    text: (childInfo.child).text,
                    leaf: (childInfo.child)
                };
            }
            else {
                const lineNode = (childInfo.child);
                return lineNode.charOffsetToLineNumberAndPos(childInfo.lineNumber, childInfo.charOffset);
            }
        }
        else {
            const lineInfo = this.lineNumberToInfo(this.lineCount(), 0);
            return { line: this.lineCount(), offset: lineInfo.leaf.charCount() };
        }
    }
    lineNumberToInfo(lineNumber, charOffset) {
        const childInfo = this.childFromLineNumber(lineNumber, charOffset);
        if (!childInfo.child) {
            return {
                line: lineNumber,
                offset: charOffset
            };
        }
        else if (childInfo.child.isLeaf()) {
            return {
                line: lineNumber,
                offset: childInfo.charOffset,
                text: (childInfo.child).text,
                leaf: (childInfo.child)
            };
        }
        else {
            const lineNode = (childInfo.child);
            return lineNode.lineNumberToInfo(childInfo.relativeLineNumber, childInfo.charOffset);
        }
    }
    childFromLineNumber(lineNumber, charOffset) {
        let child;
        let relativeLineNumber = lineNumber;
        let i;
        let len;
        for (i = 0, len = this.children.length; i < len; i++) {
            child = this.children[i];
            const childLineCount = child.lineCount();
            if (childLineCount >= relativeLineNumber) {
                break;
            }
            else {
                relativeLineNumber -= childLineCount;
                charOffset += child.charCount();
            }
        }
        return {
            child: child,
            childIndex: i,
            relativeLineNumber: relativeLineNumber,
            charOffset: charOffset
        };
    }
    childFromCharOffset(lineNumber, charOffset) {
        let child;
        let i;
        let len;
        for (i = 0, len = this.children.length; i < len; i++) {
            child = this.children[i];
            if (child.charCount() > charOffset) {
                break;
            }
            else {
                charOffset -= child.charCount();
                lineNumber += child.lineCount();
            }
        }
        return {
            child: child,
            childIndex: i,
            charOffset: charOffset,
            lineNumber: lineNumber
        };
    }
    splitAfter(childIndex) {
        let splitNode;
        const clen = this.children.length;
        childIndex++;
        const endLength = childIndex;
        if (childIndex < clen) {
            splitNode = new LineNode();
            while (childIndex < clen) {
                splitNode.add(this.children[childIndex]);
                childIndex++;
            }
            splitNode.updateCounts();
        }
        this.children.length = endLength;
        return splitNode;
    }
    remove(child) {
        const childIndex = this.findChildIndex(child);
        const clen = this.children.length;
        if (childIndex < (clen - 1)) {
            for (let i = childIndex; i < (clen - 1); i++) {
                this.children[i] = this.children[i + 1];
            }
        }
        this.children.length--;
    }
    findChildIndex(child) {
        let childIndex = 0;
        const clen = this.children.length;
        while ((this.children[childIndex] !== child) && (childIndex < clen))
            childIndex++;
        return childIndex;
    }
    insertAt(child, nodes) {
        let childIndex = this.findChildIndex(child);
        const clen = this.children.length;
        const nodeCount = nodes.length;
        // if child is last and there is more room and only one node to place, place it
        if ((clen < lineCollectionCapacity) && (childIndex === (clen - 1)) && (nodeCount === 1)) {
            this.add(nodes[0]);
            this.updateCounts();
            return [];
        }
        else {
            const shiftNode = this.splitAfter(childIndex);
            let nodeIndex = 0;
            childIndex++;
            while ((childIndex < lineCollectionCapacity) && (nodeIndex < nodeCount)) {
                this.children[childIndex] = nodes[nodeIndex];
                childIndex++;
                nodeIndex++;
            }
            let splitNodes = [];
            let splitNodeCount = 0;
            if (nodeIndex < nodeCount) {
                splitNodeCount = Math.ceil((nodeCount - nodeIndex) / lineCollectionCapacity);
                splitNodes = new Array(splitNodeCount);
                let splitNodeIndex = 0;
                for (let i = 0; i < splitNodeCount; i++) {
                    splitNodes[i] = new LineNode();
                }
                let splitNode = splitNodes[0];
                while (nodeIndex < nodeCount) {
                    splitNode.add(nodes[nodeIndex]);
                    nodeIndex++;
                    if (splitNode.children.length === lineCollectionCapacity) {
                        splitNodeIndex++;
                        splitNode = splitNodes[splitNodeIndex];
                    }
                }
                for (let i = splitNodes.length - 1; i >= 0; i--) {
                    if (splitNodes[i].children.length === 0) {
                        splitNodes.length--;
                    }
                }
            }
            if (shiftNode) {
                splitNodes[splitNodes.length] = shiftNode;
            }
            this.updateCounts();
            for (let i = 0; i < splitNodeCount; i++) {
                splitNodes[i].updateCounts();
            }
            return splitNodes;
        }
    }
    // assume there is room for the item; return true if more room
    add(collection) {
        this.children[this.children.length] = collection;
        return (this.children.length < lineCollectionCapacity);
    }
    charCount() {
        return this.totalChars;
    }
    lineCount() {
        return this.totalLines;
    }
}
exports.LineNode = LineNode;
class LineLeaf {
    constructor(text) {
        this.text = text;
    }
    setUdata(data) {
        this.udata = data;
    }
    getUdata() {
        return this.udata;
    }
    isLeaf() {
        return true;
    }
    walk(rangeStart, rangeLength, walkFns) {
        walkFns.leaf(rangeStart, rangeLength, this);
    }
    charCount() {
        return this.text.length;
    }
    lineCount() {
        return 1;
    }
}
exports.LineLeaf = LineLeaf;
function logServiceTimes(logger, service) {
    function time(name, cb) {
        const start = Date.now();
        let result = null;
        try {
            result = cb();
        }
        catch (error) {
            logger.msg(`Error for ${name}:\n` +
                `    ${error.stack || error}`);
        }
        logger.msg(`${name}: ${Date.now() - start}ms`);
        return result;
    }
    return {
        getCompletionsAt(fileName, position) {
            return time("getCompletions", () => service.getCompletionsAt(fileName, position));
        },
        getDiagnostics(fileName) {
            return time("getDiagnostics", () => service.getDiagnostics(fileName));
        },
        getTemplateReferences() {
            return time("getTemplateReferences", () => service.getTemplateReferences());
        },
        getDefinitionAt(fileName, position) {
            return time("getDefinitionAt", () => service.getDefinitionAt(fileName, position));
        },
        getHoverAt(fileName, position) {
            return time("getHoverAt", () => service.getHoverAt(fileName, position));
        },
        getPipesAt(fileName, position) {
            return service.getPipesAt(fileName, position);
        }
    };
}
//# sourceMappingURL=editorServices.js.map