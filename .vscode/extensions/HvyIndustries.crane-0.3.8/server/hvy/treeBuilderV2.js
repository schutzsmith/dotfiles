/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodes_1 = require("./nodes");
const namespaces_1 = require("../util/namespaces");
class TreeBuilderV2 {
    processBranch(branch, tree, parent) {
        this.tree = tree;
        if (Array.isArray(branch)) {
            branch.forEach(element => {
                this.processBranch(element, tree, parent);
            });
        }
        else {
            switch (branch.kind) {
                case "namespace":
                    this.buildNamespaceDeclaration(branch, tree);
                    this.processBranch(branch.children, tree, branch);
                    break;
                case "include":
                    this.buildfileInclude(branch, tree);
                    break;
                case "usegroup":
                    this.buildNamespaceUsings(branch, tree);
                    break;
                case "assign":
                    this.buildAssignment(branch, tree.topLevelVariables);
                    break;
                case "constant":
                    this.buildConstant(branch, tree.constants);
                    break;
                case "function":
                    this.buildMethod(branch, tree.functions);
                    break;
                case "call":
                    //this.buildCall(branch, tree);
                    break;
                case "class":
                    this.buildClass(branch, tree.classes, parent);
                    break;
                case "trait":
                    this.buildTrait(branch, tree.traits, parent);
                    break;
                case "interface":
                    this.buildInterface(branch, tree.interfaces, parent);
                    break;
            }
        }
        return tree;
    }
    buildNamespaceParts(tree) {
        let namespaces = [];
        let fullyQualifiedNamespaces = [];
        // build up a list of all namespaces in the file
        tree.namespaces.forEach(namespaceNode => {
            fullyQualifiedNamespaces.push(namespaceNode.name);
        });
        fullyQualifiedNamespaces.forEach(namespace => {
            if (typeof namespace === 'string' || namespace instanceof String) {
                // break down the list into parts separated by "\"
                let parts = namespace.split("\\");
                let nsPart = new nodes_1.NamespacePart(parts[0]);
                let exists = false;
                namespaces.forEach(toplevelPart => {
                    if (toplevelPart.name == parts[0]) {
                        nsPart = toplevelPart;
                        exists = true;
                        return;
                    }
                });
                parts.splice(0, 1);
                this.buildNamespacePart(parts, nsPart);
                if (!exists) {
                    namespaces.push(nsPart);
                }
            }
        });
        tree.namespaceParts = namespaces;
    }
    buildNamespacePart(parts, nsPart) {
        if (parts.length > 0) {
            let part = new nodes_1.NamespacePart(parts[0]);
            let exists = false;
            nsPart.children.forEach(subPart => {
                if (subPart.name == parts[0]) {
                    part = subPart;
                    exists = true;
                    return;
                }
            });
            parts.splice(0, 1);
            this.buildNamespacePart(parts, part);
            if (!exists) {
                nsPart.children.push(part);
            }
        }
    }
    buildNamespaceDeclaration(branch, context) {
        let namespace = new nodes_1.NamespaceNode(branch.name);
        namespace.startPos = this.buildPosition(branch.loc.start);
        namespace.endPos = this.buildPosition(branch.loc.end);
        context.namespaces.push(namespace);
    }
    buildfileInclude(branch, context) {
        switch (branch.target.kind) {
            case "string":
                // Simple case -> include "folder/file.php"
                context.fileReferences.push(branch.target.value);
                break;
            case "bin":
                // TODO
                // Use of constant -> include __DIR__ . "folder/file.php"
                // Use of variable -> include "/dir/{$folder}/file.php"
                break;
        }
    }
    buildNamespaceUsings(branch, context) {
        branch.items.forEach(item => {
            if (item.name) {
                let node = new nodes_1.NamespaceUsingNode(item.name);
                // Handle namespace aliases (eg "use HVY\test as testAlias;"
                node.alias = item.alias;
                context.namespaceUsings.push(node);
            }
        });
    }
    buildAssignment(branch, context) {
        if (branch.left && branch.left.kind == "variable") {
            let node = new nodes_1.VariableNode();
            node.name = "$" + branch.left.name;
            node.startPos = this.buildPosition(branch.loc.start);
            node.endPos = this.buildPosition(branch.loc.end);
            if (branch.right && branch.right.kind == "new") {
                if (branch.right.what && branch.right.what.name) {
                    node.value = branch.right.what.name;
                    if (branch.right.what.kind == "identifier") {
                        // Get FQN (check namespace + check usings)
                        node.type = namespaces_1.Namespaces.getFQNFromClassname(branch.right.what.name, this.tree);
                    }
                    else {
                        node.type = branch.right.what.name;
                    }
                }
            }
            context.push(node);
        }
    }
    buildNamespace(node, parent) {
        if (parent != null && parent.kind == "namespace") {
            node.namespace = parent.name;
        }
    }
    buildInterface(branch, context, parent) {
        let interfaceNode = new nodes_1.InterfaceNode();
        interfaceNode.name = branch.name;
        this.buildNamespace(interfaceNode, parent);
        if (branch.extends != null) {
            branch.extends.forEach(item => {
                interfaceNode.extends.push(item.name);
            });
        }
        if (branch.body) {
            branch.body.forEach(interfaceBodyBranch => {
                switch (interfaceBodyBranch.kind) {
                    case "classconstant":
                        this.buildConstant(interfaceBodyBranch, interfaceNode.constants);
                        break;
                    case "method":
                        this.buildMethod(interfaceBodyBranch, interfaceNode.methods);
                        break;
                }
            });
        }
        interfaceNode.startPos = this.buildPosition(branch.loc.start);
        interfaceNode.endPos = this.buildPosition(branch.loc.end);
        context.push(interfaceNode);
    }
    buildTrait(branch, context, parent) {
        let traitNode = new nodes_1.TraitNode();
        traitNode.name = branch.name;
        this.buildNamespace(traitNode, parent);
        if (branch.extends != null) {
            traitNode.extends = namespaces_1.Namespaces.getFQNFromClassname(branch.extends.name, this.tree);
        }
        if (branch.implements != null) {
            branch.implements.forEach(item => {
                traitNode.implements.push(item.name);
            });
        }
        if (branch.body) {
            branch.body.forEach(classBodyBranch => {
                this.buildClassBody(classBodyBranch, traitNode);
            });
        }
        traitNode.startPos = this.buildPosition(branch.loc.start);
        traitNode.endPos = this.buildPosition(branch.loc.end);
        context.push(traitNode);
    }
    buildClass(branch, context, parent) {
        let classNode = new nodes_1.ClassNode();
        classNode.name = branch.name;
        this.buildNamespace(classNode, parent);
        if (branch.extends != null) {
            classNode.extends = namespaces_1.Namespaces.getFQNFromClassname(branch.extends.name, this.tree);
        }
        if (branch.implements != null) {
            branch.implements.forEach(item => {
                classNode.implements.push(item.name);
            });
        }
        classNode.isAbstract = branch.isAbstract;
        classNode.isFinal = branch.isFinal;
        if (branch.body) {
            branch.body.forEach(classBodyBranch => {
                this.buildClassBody(classBodyBranch, classNode);
            });
        }
        classNode.startPos = this.buildPosition(branch.loc.start);
        classNode.endPos = this.buildPosition(branch.loc.end);
        context.push(classNode);
    }
    buildClassBody(branch, classNode) {
        switch (branch.kind) {
            case "property":
                this.buildProperty(branch, classNode);
                break;
            case "classconstant":
                this.buildConstant(branch, classNode.constants);
                break;
            case "doc":
                this.buildDocComment(branch, classNode);
                break;
            case "method":
                this.buildMethodOrConstructor(branch, classNode);
                break;
            case "traituse":
                this.buildTraitUse(branch, classNode);
                break;
        }
    }
    buildProperty(branch, classNode) {
        let propNode = new nodes_1.PropertyNode();
        propNode.name = branch.name;
        propNode.startPos = this.buildPosition(branch.loc.start);
        propNode.endPos = this.buildPosition(branch.loc.end);
        propNode.isStatic = branch.isStatic;
        // TODO -- are these needed?
        //propNode.? = branch.isAbstract;
        //propNode.? = branch.isFinal;
        if (branch.value != null && (branch.value.kind == "string"
            || branch.value.kind == "number"
            || branch.value.kind == "array"
            || branch.value.kind == "boolean")) {
            propNode.type = branch.value.kind;
        }
        propNode.accessModifier = this.getVisibility(branch.visibility);
        classNode.properties.push(propNode);
    }
    buildConstant(branch, context) {
        let constNode = new nodes_1.ConstantNode();
        constNode.startPos = this.buildPosition(branch.loc.start);
        constNode.endPos = this.buildPosition(branch.loc.end);
        constNode.name = branch.name;
        if (branch.value) {
            constNode.type = branch.value.kind;
            constNode.value = branch.value.value;
        }
        context.push(constNode);
    }
    buildDocComment(branch, classNode) {
        // TODO
    }
    buildMethodOrConstructor(branch, classNode) {
        if (branch.name == "__construct" || branch.name == classNode.name) {
            this.buildConstructor(branch, classNode);
        }
        else {
            this.buildMethod(branch, classNode.methods);
        }
    }
    buildConstructor(branch, classNode) {
        let constructorNode = new nodes_1.ConstructorNode();
        if (branch.name == classNode.name) {
            constructorNode.isDeprecated = true;
        }
        this.buildMethodCore(constructorNode, branch);
        classNode.construct = constructorNode;
    }
    buildMethod(branch, context) {
        let methodNode = new nodes_1.MethodNode();
        this.buildMethodCore(methodNode, branch);
        methodNode.isAbstract = branch.isAbstract;
        methodNode.isFinal = branch.isFinal;
        methodNode.isStatic = branch.isStatic;
        methodNode.accessModifier = this.getVisibility(branch.visibility);
        context.push(methodNode);
    }
    buildMethodCore(node, branch) {
        node.name = branch.name;
        node.startPos = this.buildPosition(branch.loc.start);
        node.endPos = this.buildPosition(branch.loc.end);
        node.params = this.buildFunctionArguments(branch.arguments);
        if (branch.body && branch.body.children) {
            branch.body.children.forEach(child => {
                switch (child.kind) {
                    case "assign":
                        this.buildAssignment(child, node.scopeVariables);
                        break;
                    case "global":
                        // Build imported global variables for suggestions
                        child.items.forEach(item => {
                            node.globalVariables.push("$" + item.name);
                        });
                        break;
                    // TODO -- handle variable assignments inside code blocks
                    // TODO -- change this to be blocks of code instead of scope variables to allow for scope-aware
                    //         accessing of variables inside loops
                    // TODO -- build scope functions calls
                    // TODO -- handle output variables ?
                    case "return":
                        // TODO -- build return type if possible
                        //node.returns = "";
                        break;
                }
            });
        }
    }
    buildFunctionArguments(methodArguments) {
        let args = new Array();
        methodArguments.forEach(item => {
            let arg = new nodes_1.ParameterNode();
            arg.name = "$" + item.name;
            arg.byRef = item.byref;
            arg.nullable = item.nullable;
            arg.startPos = this.buildPosition(item.loc.start);
            arg.endPos = this.buildPosition(item.loc.end);
            if (item.value) {
                arg.optional = true;
                arg.type = item.value.kind;
            }
            if (item.type) {
                arg.type = item.type.name;
            }
            args.push(arg);
        });
        return args;
    }
    buildTraitUse(branch, classNode) {
        branch.traits.forEach(traitItem => {
            classNode.traits.push(namespaces_1.Namespaces.getFQNFromClassname(traitItem.name, this.tree));
        });
    }
    getVisibility(visibility) {
        switch (visibility) {
            case "protected":
                return nodes_1.AccessModifierNode.protected;
            case "private":
                return nodes_1.AccessModifierNode.private;
            default:
                return nodes_1.AccessModifierNode.public;
        }
    }
    buildPosition(position) {
        return new nodes_1.PositionInfo(position.line - 1, position.column, position.offset);
    }
    methodStub(branch, tree) {
    }
}
exports.TreeBuilderV2 = TreeBuilderV2;
//# sourceMappingURL=treeBuilderV2.js.map