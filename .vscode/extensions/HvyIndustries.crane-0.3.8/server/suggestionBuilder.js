/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const nodes_1 = require("./hvy/nodes");
const Files_1 = require("./util/Files");
const namespaces_1 = require("./util/namespaces");
const Debug_1 = require("./util/Debug");
const fs = require('fs');
class SuggestionBuilder {
    prepare(textDocumentPosition, document, workspaceTree) {
        this.workspaceTree = workspaceTree;
        this.filePath = this.buildDocumentPath(textDocumentPosition.textDocument.uri);
        this.lineIndex = textDocumentPosition.position.line;
        this.charIndex = textDocumentPosition.position.character;
        this.doc = document;
        var text = document.getText();
        var lines = text.split(/\r\n|\r|\n/gm);
        // Replace tabs with spaces
        this.currentLine = lines[this.lineIndex].replace(/\t/gm, " ");
        this.lastChar = this.currentLine[this.charIndex - 1];
        // Note - this.lastChar will always be the last character of the line
        // because whitespace is stripped from the text so the index is wrong
        let filenode = this.workspaceTree.filter(item => {
            return item.path == this.filePath;
        })[0];
        // Send some telemetry information
        if (filenode == null) {
            Debug_1.Debug.sendErrorTelemetry("Unable to find filenode for path " + this.filePath);
        }
        this.currentFileNode = filenode;
    }
    isSelf() {
        if (this.currentLine.substr(this.charIndex - 6, this.charIndex - 1) == "self::") {
            return true;
        }
        if (this.currentLine.substr(this.charIndex - 8, this.charIndex - 1) == "static::") {
            return true;
        }
        return false;
    }
    build() {
        var scope = this.getScope();
        var toReturn = [];
        var options = new ScopeOptions();
        // Don't add suggestions if we're in a comment
        let commentIndex = this.currentLine.indexOf("//");
        if (commentIndex > -1 && commentIndex < this.charIndex) {
            return null;
        }
        if (this.lastChar == "p" && this.currentLine.indexOf("<?p") > -1) {
            toReturn.push({
                label: "php",
                kind: vscode_languageserver_1.CompletionItemKind.Class,
                detail: "<?php"
            });
            return toReturn;
        }
        if (this.lastChar == ">") {
            toReturn = toReturn.concat(this.checkAccessorAndAddMembers(scope));
        }
        else if (this.lastChar == ":") {
            if (this.isSelf()) {
                // Accessing via self:: or static::
                for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
                    var classNode = this.currentFileNode.classes[i];
                    if (this.withinBlock(classNode)) {
                        // Add static members for this class
                        toReturn = toReturn.concat(this.addClassMembers(classNode, true, true, true));
                    }
                }
            }
            else {
                // Probably accessing via [ClassName]::
                if (this.currentLine.indexOf("::") > -1) {
                    var classNames = this.currentLine.trim().match(/\S(\B[\\a-z0-9]+)/ig);
                    if (classNames && classNames.length > 0) {
                        var determinedClassname = classNames[classNames.length - 1];
                        if (determinedClassname.indexOf("\\") > -1) {
                            determinedClassname = "\\" + determinedClassname;
                        }
                        var className = namespaces_1.Namespaces.getFQNFromClassname(determinedClassname, this.currentFileNode);
                        var classNode = this.getClassNodeFromTree(className);
                        if (classNode != null) {
                            // Add static members for this class
                            toReturn = toReturn.concat(this.addClassMembers(classNode, true, false, false));
                        }
                    }
                }
            }
        }
        else {
            // Special cases for "extends", "implements", "use"
            let newIndex = this.currentLine.indexOf(" new ");
            let newNoSpaceIndex = this.currentLine.indexOf("=new ");
            let extendsIndex = this.currentLine.indexOf(" extends ");
            let implementsIndex = this.currentLine.indexOf(" implements ");
            let useIndex = this.currentLine.indexOf("use ");
            let namespaceIndex = this.currentLine.indexOf("namespace ");
            let newNonNamespaceIndex = this.currentLine.indexOf("new \\");
            let extendsNonNamespaceIndex = this.currentLine.indexOf("extends \\");
            let implementsNonNamespaceIndex = this.currentLine.indexOf("implements \\");
            let classIndex = this.currentLine.indexOf("class ");
            let traitIndex = this.currentLine.indexOf("trait ");
            let interfaceIndex = this.currentLine.indexOf("interface ");
            let specialCase = false;
            if (implementsIndex > -1 && implementsIndex < this.charIndex) {
                specialCase = true;
                // TODO -- use this.buildSuggestionsForNamespaceOrUseStatement() (issue #232)
                if (implementsNonNamespaceIndex > -1 && implementsNonNamespaceIndex < this.charIndex) {
                    options.noNamespaceOnly = true;
                    options.includeLeadingSlash = false;
                }
                // Show only interfaces
                options.interfaces = true;
                toReturn = this.buildSuggestionsForScope(scope, options);
            }
            if (!specialCase && (newIndex > -1 || newNoSpaceIndex > -1 || extendsIndex > -1)
                && (newIndex < this.charIndex || newNoSpaceIndex < this.charIndex || extendsIndex < this.charIndex)) {
                specialCase = true;
                // TODO -- use this.buildSuggestionsForNamespaceOrUseStatement() (issue #232)
                if ((newNonNamespaceIndex > -1 && newNonNamespaceIndex < this.charIndex)
                    || (extendsNonNamespaceIndex > -1 && extendsNonNamespaceIndex < this.charIndex)) {
                    options.noNamespaceOnly = true;
                    options.includeLeadingSlash = false;
                }
                // Show only classes
                options.classes = true;
                toReturn = this.buildSuggestionsForScope(scope, options);
            }
            if (!specialCase && (this.lastChar == "\\" || (useIndex > -1 && useIndex < this.charIndex))) {
                specialCase = true;
                toReturn = this.buildSuggestionsForNamespaceOrUseStatement(false);
            }
            if (namespaceIndex > -1 && namespaceIndex < this.charIndex) {
                specialCase = true;
                toReturn = this.buildSuggestionsForNamespaceOrUseStatement(true);
            }
            if (!specialCase
                && (classIndex > -1 || traitIndex > -1 || interfaceIndex > -1)
                && (classIndex < this.charIndex || traitIndex < this.charIndex || interfaceIndex < this.charIndex)) {
                return null;
            }
            if (!specialCase) {
                switch (scope.level) {
                    case ScopeLevel.Root:
                        if (scope.name == null) {
                            // Top level
                            // Suggestions:
                            //  / other top level variables/constants
                            //  / top level functions
                            //  / classes/interfaces/traits
                            //  - namespaces (after 'use')
                            options.topConstants = true;
                            options.topVariables = true;
                            options.topFunctions = true;
                            options.classes = true;
                            options.interfaces = true;
                            options.traits = true;
                            options.namespaces = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                        else {
                            // Top level function
                            // Suggestions:
                            //  / other top level functions
                            //  / local scope variables
                            //  / parameters
                            //  / variables included with 'global'
                            //  / classes
                            options.topFunctions = true;
                            options.localVariables = true;
                            options.parameters = true;
                            options.globalVariables = true;
                            options.classes = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                        break;
                    case ScopeLevel.Trait:
                    case ScopeLevel.Class:
                        if (scope.name == null) {
                            // Within class, not in method or constructor
                            // Suggestions
                            //  / classes (after '=' or 'extends')
                            //  / interfaces (after 'implements')
                            //  / traits (after 'use')
                            options.classes = true;
                            options.interfaces = true;
                            options.traits = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                        else {
                            // Within method or constructor
                            // Suggestions
                            //  / classes
                            //  / local variables
                            //  / parameters
                            options.classes = true;
                            options.localVariables = true;
                            options.parameters = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                        break;
                    case ScopeLevel.Interface:
                    default:
                        break;
                }
            }
        }
        // Remove duplicated (overwritten) items
        var filtered = [];
        var cache = {};
        for (var i = 0, l = toReturn.length; i < l; i++) {
            var item = toReturn[i];
            if (item && item.label && !(item.label in cache)) {
                filtered.push(item);
                cache[item.label] = true;
            }
        }
        return filtered;
    }
    buildSuggestionsForNamespaceOrUseStatement(namespaceOnly = false) {
        let namespaces = [];
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            var fileNode = this.workspaceTree[i];
            namespaces = namespaces.concat(fileNode.namespaceParts);
        }
        let line = this.currentLine;
        // TODO -- update this logic to handle use cases other than "use" and "namespace" (issue #232)
        let useStatement = (line.indexOf("use ") > -1);
        let namespaceDefinition = (line.indexOf("namespace ") > -1);
        line = line.trim();
        line = line.replace("namespace ", "");
        line = line.replace("use ", "");
        let lineParts = line.split("\\");
        let suggestions = [];
        if (line.charAt(0) == "\\" || this.currentFileNode.namespaces.length == 0) {
            let scope = new Scope(null, null, null);
            let options = new ScopeOptions();
            options.classes = true;
            options.interfaces = true;
            options.traits = true;
            if (line.charAt(0) == "\\") {
                // We are looking for non-namespaced classes only
                options.noNamespaceOnly = true;
            }
            options.includeLeadingSlash = false;
            suggestions.concat(this.buildSuggestionsForScope(scope, options));
        }
        let parent = namespaces;
        for (var i = 0, l = lineParts.length; i < l; i++) {
            var part = lineParts[i];
            let needChildren = false;
            for (var j = 0, sl = parent.length; j < sl; j++) {
                var namespace = parent[j];
                if (namespace.name == part) {
                    parent = namespace.children;
                    needChildren = true;
                    break;
                }
            }
            if (!needChildren) {
                for (var j = 0, sl = parent.length; j < sl; j++) {
                    var item = parent[j];
                    suggestions.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Module, detail: "(namespace)" });
                }
            }
        }
        // TODO -- update the code below to include classes, traits an interfaces as required (introduce new bool params)
        // Get namespace-aware suggestions for classes, traits and interfaces
        if (!namespaceOnly) {
            let namespaceToSearch = line.slice(0, line.length - 1);
            for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
                var fileNode = this.workspaceTree[i];
                for (var j = 0, sl = fileNode.classes.length; j < sl; j++) {
                    var classNode = fileNode.classes[j];
                    if (classNode.namespace == namespaceToSearch) {
                        suggestions.push({ label: classNode.name, kind: vscode_languageserver_1.CompletionItemKind.Class, detail: "(class)" });
                    }
                }
                for (var j = 0, sl = fileNode.traits.length; j < sl; j++) {
                    var traitNode = fileNode.traits[j];
                    if (traitNode.namespace == namespaceToSearch) {
                        suggestions.push({ label: traitNode.name, kind: vscode_languageserver_1.CompletionItemKind.Class, detail: "(trait)" });
                    }
                }
                for (var j = 0, sl = fileNode.interfaces.length; j < sl; j++) {
                    var interfaceNode = fileNode.interfaces[j];
                    if (interfaceNode.namespace == namespaceToSearch) {
                        suggestions.push({ label: interfaceNode.name, kind: vscode_languageserver_1.CompletionItemKind.Interface, detail: "(interface)" });
                    }
                }
            }
        }
        return suggestions;
    }
    buildSuggestionsForScope(scope, options) {
        var toReturn = [];
        // Interpret the options object to determine what to include in suggestions
        // Interpret the scope object to determine what suggestions to include for -> and :: accessors, etc
        // TODO -- Check we're on a line below where they're defined
        // TODO -- Include these if the file is included in the current file
        if (options.topConstants) {
            for (var i = 0, l = this.currentFileNode.constants.length; i < l; i++) {
                let item = this.currentFileNode.constants[i];
                let value = item.value;
                if (item.type == "string") {
                    value = "\"" + value + "\"";
                }
                toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Value, detail: `(constant) : ${item.type} : ${value}` });
            }
        }
        if (options.topVariables) {
            for (var i = 0, l = this.currentFileNode.topLevelVariables.length; i < l; i++) {
                let item = this.currentFileNode.topLevelVariables[i];
                toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: `(variable) : ${item.type}` });
            }
        }
        if (options.classes && !options.noNamespaceOnly) {
            for (var i = 0, l = this.currentFileNode.namespaceUsings.length; i < l; i++) {
                let item = this.currentFileNode.namespaceUsings[i];
                if (item.alias != null) {
                    toReturn.push({ label: item.alias, kind: vscode_languageserver_1.CompletionItemKind.Class, detail: "(class) " + item.name });
                }
            }
        }
        if (options.localVariables || options.parameters || options.globalVariables) {
            // Find out what top level function we're in
            var funcs = [];
            funcs = funcs.concat(this.currentFileNode.functions.filter(func => {
                return this.withinBlock(func);
            }));
            // Find out which method call/constructor we're in
            for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
                let classNode = this.currentFileNode.classes[i];
                funcs = funcs.concat(classNode.methods.filter(item => {
                    return this.withinBlock(item);
                }));
                if (classNode.construct != null && this.withinBlock(classNode.construct)) {
                    funcs.push(classNode.construct);
                }
            }
            // Find out which trait we're in
            for (var i = 0, l = this.currentFileNode.traits.length; i < l; i++) {
                let traitNode = this.currentFileNode.traits[i];
                funcs = funcs.concat(traitNode.methods.filter(item => {
                    return this.withinBlock(item);
                }));
            }
            if (funcs.length > 0) {
                if (options.localVariables) {
                    for (var i = 0, l = funcs[0].scopeVariables.length; i < l; i++) {
                        let item = funcs[0].scopeVariables[i];
                        toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: `(variable) : ${item.type}` });
                    }
                }
                if (options.parameters) {
                    for (var i = 0, l = funcs[0].params.length; i < l; i++) {
                        let item = funcs[0].params[i];
                        toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: `(parameter) : ${item.type}` });
                    }
                }
                if (options.globalVariables) {
                    for (var i = 0, l = funcs[0].globalVariables.length; i < l; i++) {
                        let item = funcs[0].globalVariables[i];
                        // TODO -- look up original variable to find the type
                        toReturn.push({ label: item, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: `(imported global) : mixed` });
                    }
                }
            }
        }
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            let fileNode = this.workspaceTree[i];
            if (options.classes) {
                for (var j = 0, sl = fileNode.classes.length; j < sl; j++) {
                    let item = fileNode.classes[j];
                    let include = true;
                    if (options.noNamespaceOnly) {
                        if (item.namespace) {
                            include = false;
                        }
                    }
                    if (include) {
                        toReturn.push({
                            label: item.name,
                            kind: vscode_languageserver_1.CompletionItemKind.Class,
                            detail: "(class)" + this.getNamespace(item),
                            insertText: this.getInsertTextWithNamespace(item, options)
                        });
                    }
                }
            }
            if (options.interfaces) {
                for (var j = 0, sl = fileNode.interfaces.length; j < sl; j++) {
                    let item = fileNode.interfaces[j];
                    let include = true;
                    if (options.noNamespaceOnly) {
                        if (item.namespace) {
                            include = false;
                        }
                    }
                    if (include) {
                        toReturn.push({
                            label: item.name,
                            kind: vscode_languageserver_1.CompletionItemKind.Interface,
                            detail: "(interface)" + this.getNamespace(item),
                            insertText: this.getInsertTextWithNamespace(item, options)
                        });
                    }
                }
            }
            if (options.traits) {
                for (var j = 0, sl = fileNode.traits.length; j < sl; j++) {
                    let item = fileNode.traits[j];
                    let include = true;
                    if (options.noNamespaceOnly) {
                        if (item.namespace) {
                            include = false;
                        }
                    }
                    if (include) {
                        toReturn.push({
                            label: item.name,
                            kind: vscode_languageserver_1.CompletionItemKind.Class,
                            detail: "(trait)" + this.getNamespace(item),
                            insertText: this.getInsertTextWithNamespace(item, options)
                        });
                    }
                }
            }
            if (options.topFunctions) {
                for (var j = 0, sl = fileNode.functions.length; j < sl; j++) {
                    let item = fileNode.functions[j];
                    toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: `(function) : ${item.returns}`, insertText: this.getFunctionInsertText(item) });
                }
            }
            if (options.namespaces) {
                for (var j = 0, sl = fileNode.namespaces.length; j < sl; j++) {
                    let item = fileNode.namespaces[j];
                    toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Module, detail: `(namespace)` });
                }
            }
        }
        return toReturn;
    }
    getInsertTextWithNamespace(node, options) {
        if (node.namespace) {
            let namespace = node.namespace;
            let namespaceSearch = node.namespace + "\\" + node.name;
            let found = false;
            for (var i = 0, l = this.currentFileNode.namespaceUsings.length; i < l; i++) {
                let item = this.currentFileNode.namespaceUsings[i];
                if (item.name == namespaceSearch) {
                    found = true;
                    return null;
                }
            }
            for (var i = 0, l = this.currentFileNode.namespaces.length; i < l; i++) {
                let item = this.currentFileNode.namespaces[i];
                if (item.name == namespace) {
                    found = true;
                    return null;
                }
            }
            if (!found) {
                return "\\" + namespaceSearch;
            }
            return null;
        }
        if (this.currentFileNode.namespaces.length > 0
            && options.includeLeadingSlash) {
            return "\\" + node.name;
        }
        return null;
    }
    getNamespace(node) {
        if (node.namespace) {
            return " " + node.namespace;
        }
        return "";
    }
    getFunctionInsertText(node) {
        let text = node.name;
        if (node.params.length == 0) {
            text += "()";
        }
        return text;
    }
    getScope() {
        // Are we inside a class?
        for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
            let classNode = this.currentFileNode.classes[i];
            if (this.withinBlock(classNode)) {
                if (classNode.construct != null) {
                    if (this.withinBlock(classNode.construct)) {
                        return new Scope(ScopeLevel.Class, "constructor", classNode.name);
                    }
                }
                for (var j = 0, sl = classNode.methods.length; j < sl; j++) {
                    let method = classNode.methods[j];
                    if (this.withinBlock(method)) {
                        return new Scope(ScopeLevel.Class, method.name, classNode.name);
                    }
                }
                return new Scope(ScopeLevel.Class, null, classNode.name);
            }
        }
        // Are we inside a trait?
        for (var i = 0, l = this.currentFileNode.traits.length; i < l; i++) {
            let trait = this.currentFileNode.traits[i];
            if (this.withinBlock(trait)) {
                if (trait.construct != null) {
                    if (this.withinBlock(trait.construct)) {
                        return new Scope(ScopeLevel.Trait, "constructor", trait.name);
                    }
                }
                for (var j = 0, sl = trait.methods.length; j < sl; j++) {
                    let method = trait.methods[j];
                    if (this.withinBlock(method)) {
                        return new Scope(ScopeLevel.Trait, method.name, trait.name);
                    }
                }
                return new Scope(ScopeLevel.Trait, null, trait.name);
            }
        }
        // Are we inside an interface?
        for (var i = 0, l = this.currentFileNode.interfaces.length; i < l; i++) {
            let item = this.currentFileNode.interfaces[i];
            if (this.withinBlock(item)) {
                return new Scope(ScopeLevel.Interface, null, item.name);
            }
        }
        // Are we inside a top level function?
        for (var i = 0, l = this.currentFileNode.functions.length; i < l; i++) {
            let func = this.currentFileNode.functions[i];
            if (this.withinBlock(func)) {
                return new Scope(ScopeLevel.Root, func.name, null);
            }
        }
        // Must be at the top level of a file
        return new Scope(ScopeLevel.Root, null, null);
    }
    withinBlock(block) {
        if (block.startPos.line <= this.lineIndex && block.endPos.line >= this.lineIndex) {
            return true;
        }
        return false;
    }
    buildDocumentPath(uri) {
        return Files_1.Files.getPathFromUri(uri);
    }
    getClassNodeFromTree(className) {
        let namespaceInfo = namespaces_1.Namespaces.getNamespaceInfoFromFQNClassname(className);
        var namespace = namespaceInfo.namespace;
        var rawClassname = namespaceInfo.classname;
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            let fileNode = this.workspaceTree[i];
            for (var j = 0, sl = fileNode.classes.length; j < sl; j++) {
                let classNode = fileNode.classes[j];
                if (classNode.name.toLowerCase() == rawClassname.toLowerCase()
                    && classNode.namespace == namespace) {
                    return classNode;
                }
            }
        }
    }
    getTraitNodeFromTree(traitName) {
        let namespaceInfo = namespaces_1.Namespaces.getNamespaceInfoFromFQNClassname(traitName);
        var namespace = namespaceInfo.namespace;
        var rawTraitname = namespaceInfo.classname;
        for (var i = 0, l = this.workspaceTree.length; i < l; i++) {
            let fileNode = this.workspaceTree[i];
            for (var j = 0, sl = fileNode.traits.length; j < sl; j++) {
                let traitNode = fileNode.traits[j];
                if (traitNode.name.toLowerCase() == rawTraitname.toLowerCase()
                    && traitNode.namespace == namespace) {
                    return traitNode;
                }
            }
        }
    }
    buildAccessModifierText(modifier) {
        switch (modifier) {
            case 0:
                return "public";
            case 1:
                return "private";
            case 2:
                return "protected";
        }
        return "";
    }
    checkAccessorAndAddMembers(scope) {
        var rawParts = this.currentLine.trim().match(/\$\S*(?=->)/gm);
        var parts = [];
        if (rawParts == null) {
            return [];
        }
        var rawLast = rawParts.length - 1;
        if (rawParts[rawLast].indexOf("->") > -1) {
            for (var i = 0, l = rawParts.length; i < l; i++) {
                let part = rawParts[i];
                var splitParts = part.split("->");
                for (var j = 0, sl = splitParts.length; j < sl; j++) {
                    let splitPart = splitParts[j];
                    parts.push(splitPart);
                }
            }
        }
        else {
            parts = rawParts;
        }
        // TODO -- handle instantiated properties (+ static) (eg. $this->prop->suggestion)
        // TODO -- use the char offset to work out which part to use instead of always last
        var last = parts.length - 1;
        if (parts[last].indexOf("$this", parts[last].length - 5) > -1) {
            // We're referencing the current class; show everything
            for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
                let classNode = this.currentFileNode.classes[i];
                if (this.withinBlock(classNode)) {
                    return this.addClassMembers(classNode, false, true, true);
                }
            }
            for (var i = 0, l = this.currentFileNode.traits.length; i < l; i++) {
                let traitNode = this.currentFileNode.traits[i];
                if (this.withinBlock(traitNode)) {
                    return this.addClassMembers(traitNode, false, true, true);
                }
            }
        }
        // We're probably calling from a instantiated variable
        // Check the variable is in scope to work out which suggestions to provide
        return this.checkForInstantiatedVariableAndAddSuggestions(parts[last], scope);
    }
    checkForInstantiatedVariableAndAddSuggestions(variableName, scope) {
        var variablesFound = [];
        // Check the scope paramater to find out where we're calling from
        switch (scope.level) {
            case ScopeLevel.Root:
                if (scope.name == null) {
                    // Top level variable
                    variablesFound = this.currentFileNode.topLevelVariables.filter(item => {
                        return item.name == variableName;
                    });
                }
                else {
                    // Top level function
                    for (var i = 0, l = this.currentFileNode.functions.length; i < l; i++) {
                        let func = this.currentFileNode.functions[i];
                        if (func.name == scope.name) {
                            variablesFound = variablesFound.concat(func.params.filter(item => {
                                return item.name == variableName;
                            }));
                            variablesFound = variablesFound.concat(func.scopeVariables.filter(item => {
                                return item.name == variableName;
                            }));
                            // TODO -- Add global variables
                        }
                    }
                }
                break;
            case ScopeLevel.Trait:
            case ScopeLevel.Class:
                if (scope.name == null) {
                    // Within class, not in method or constructor
                }
                else {
                    if (scope.name == "constructor") {
                        // Within constructor
                        for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
                            let classNode = this.currentFileNode.classes[i];
                            if (classNode.name == scope.parent) {
                                variablesFound = variablesFound.concat(classNode.construct.params.filter(item => {
                                    return item.name == variableName;
                                }));
                                variablesFound = variablesFound.concat(classNode.construct.scopeVariables.filter(item => {
                                    return item.name == variableName;
                                }));
                            }
                        }
                    }
                    else {
                        // Within method
                        for (var i = 0, l = this.currentFileNode.classes.length; i < l; i++) {
                            let classNode = this.currentFileNode.classes[i];
                            if (classNode.name == scope.parent) {
                                for (var j = 0, sl = classNode.methods.length; j < sl; j++) {
                                    let method = classNode.methods[j];
                                    if (method.name == scope.name) {
                                        variablesFound = variablesFound.concat(method.params.filter(item => {
                                            return item.name == variableName;
                                        }));
                                        variablesFound = variablesFound.concat(method.scopeVariables.filter(item => {
                                            return item.name == variableName;
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            case ScopeLevel.Interface:
            default:
                break;
        }
        if (variablesFound.length > 0) {
            var className = null;
            if (variablesFound[0].type == "class") {
                className = variablesFound[0].value;
            }
            else {
                className = variablesFound[0].type;
            }
            var classNode = this.getClassNodeFromTree(className);
            if (classNode != null) {
                return this.addClassMembers(classNode, false, false, false);
            }
        }
        return [];
    }
    addClassMembers(classNode, staticOnly, includePrivate, includeProtected) {
        var toReturn = [];
        if (staticOnly == true) {
            for (var i = 0, l = classNode.constants.length; i < l; i++) {
                let subNode = classNode.constants[i];
                let value = subNode.value;
                if (subNode.type == "string") {
                    value = "\"" + value + "\"";
                }
                toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Value, detail: `(constant) : ${subNode.type} : ${value}` });
            }
        }
        for (var i = 0, l = classNode.methods.length; i < l; i++) {
            let subNode = classNode.methods[i];
            if (subNode.isStatic == staticOnly) {
                var accessModifier = "(" + this.buildAccessModifierText(subNode.accessModifier);
                var insertText = this.getFunctionInsertText(subNode);
                accessModifier = accessModifier + ` method) : ${subNode.returns}`;
                if (includeProtected && subNode.accessModifier == nodes_1.AccessModifierNode.protected) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
                if (includePrivate && subNode.accessModifier == nodes_1.AccessModifierNode.private) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
                if (subNode.accessModifier == nodes_1.AccessModifierNode.public) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
            }
        }
        for (var i = 0, l = classNode.properties.length; i < l; i++) {
            let subNode = classNode.properties[i];
            if (subNode.isStatic == staticOnly) {
                var accessModifier = "(" + this.buildAccessModifierText(subNode.accessModifier) + ` property) : ${subNode.type}`;
                var insertText = subNode.name;
                if (subNode.isStatic) {
                    // Add a the leading $
                    insertText = "$" + subNode.name;
                }
                if (includeProtected && subNode.accessModifier == nodes_1.AccessModifierNode.protected) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
                if (includePrivate && subNode.accessModifier == nodes_1.AccessModifierNode.private) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
                if (subNode.accessModifier == nodes_1.AccessModifierNode.public) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
            }
        }
        // Add items from included traits
        for (var i = 0, l = classNode.traits.length; i < l; i++) {
            let traitName = classNode.traits[i];
            // Look up the trait node in the tree
            var traitNode = this.getTraitNodeFromTree(traitName);
            if (traitNode != null) {
                toReturn = toReturn.concat(this.addClassMembers(traitNode, staticOnly, true, true));
            }
        }
        // Add items from parent(s)
        if (classNode.extends != null && classNode.extends != "") {
            // Look up the class node in the tree
            var extendedClassNode = this.getClassNodeFromTree(classNode.extends);
            if (extendedClassNode != null) {
                toReturn = toReturn.concat(this.addClassMembers(extendedClassNode, staticOnly, false, true));
            }
        }
        // Remove duplicated (overwritten) items
        var filtered = [];
        var cache = {};
        for (var i = 0, l = toReturn.length; i < l; i++) {
            var item = toReturn[i];
            if (!(item.label in cache)) {
                filtered.push(item);
                cache[item.label] = true;
            }
        }
        return filtered;
    }
}
exports.SuggestionBuilder = SuggestionBuilder;
class Scope {
    constructor(level, name, parent) {
        this.level = level;
        this.name = name;
        this.parent = parent;
    }
}
class ScopeOptions {
    constructor() {
        this.topVariables = false;
        this.topConstants = false;
        this.topFunctions = false;
        this.classes = false;
        this.interfaces = false;
        this.traits = false;
        this.namespaces = false;
        this.localVariables = false;
        this.globalVariables = false;
        this.parameters = false;
        this.noNamespaceOnly = false;
        this.includeLeadingSlash = true;
        this.withinNamespace = null;
    }
}
var ScopeLevel;
(function (ScopeLevel) {
    ScopeLevel[ScopeLevel["Root"] = 0] = "Root";
    ScopeLevel[ScopeLevel["Class"] = 1] = "Class";
    ScopeLevel[ScopeLevel["Interface"] = 2] = "Interface";
    ScopeLevel[ScopeLevel["Trait"] = 3] = "Trait";
})(ScopeLevel || (ScopeLevel = {}));
//# sourceMappingURL=suggestionBuilder.js.map