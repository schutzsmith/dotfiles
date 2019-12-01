/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Entity Schema
// TODO - if/else blocks
//      - switch blocks
//      - handle autoloaded files
class BaseNode {
    constructor(name = "") {
        this.name = name;
    }
}
exports.BaseNode = BaseNode;
class FileNode {
    constructor() {
        this.constants = [];
        this.topLevelVariables = [];
        this.functions = [];
        this.namespaceUsings = [];
        this.classes = [];
        this.interfaces = [];
        this.traits = [];
        this.namespaces = [];
        this.namespaceParts = [];
        // Any files that we're referencing with include(), require(), include_once() or require_once()
        this.fileReferences = [];
        this.symbolCache = [];
        this.lineCache = [];
    }
}
exports.FileNode = FileNode;
class FileSymbolCache {
}
exports.FileSymbolCache = FileSymbolCache;
class LineCache {
}
exports.LineCache = LineCache;
class NamespaceCache {
    constructor() {
        this.namespaces = [];
    }
}
exports.NamespaceCache = NamespaceCache;
class NamespacePart {
    constructor(name = null) {
        this.children = [];
        this.name = name;
    }
}
exports.NamespacePart = NamespacePart;
var SymbolType;
(function (SymbolType) {
    SymbolType[SymbolType["Unknown"] = 0] = "Unknown";
    SymbolType[SymbolType["Class"] = 1] = "Class";
    SymbolType[SymbolType["Interface"] = 2] = "Interface";
    SymbolType[SymbolType["Trait"] = 3] = "Trait";
    SymbolType[SymbolType["Property"] = 4] = "Property";
    SymbolType[SymbolType["Method"] = 5] = "Method";
    SymbolType[SymbolType["Constant"] = 6] = "Constant";
    SymbolType[SymbolType["TopLevelVariable"] = 7] = "TopLevelVariable";
    SymbolType[SymbolType["TopLevelFunction"] = 8] = "TopLevelFunction";
})(SymbolType = exports.SymbolType || (exports.SymbolType = {}));
class NamespaceUsingNode extends BaseNode {
}
exports.NamespaceUsingNode = NamespaceUsingNode;
class NamespaceNode extends BaseNode {
}
exports.NamespaceNode = NamespaceNode;
class ClassNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.implements = [];
        this.isAbstract = false;
        this.isFinal = false;
        this.isStatic = false;
        this.properties = [];
        this.methods = [];
        this.constants = [];
        this.traits = [];
    }
}
exports.ClassNode = ClassNode;
class TraitNode extends ClassNode {
}
exports.TraitNode = TraitNode;
class InterfaceNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.extends = [];
        this.constants = [];
        this.methods = [];
    }
}
exports.InterfaceNode = InterfaceNode;
class MethodNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.params = [];
        this.returns = "unknown";
        this.accessModifier = AccessModifierNode.public;
        this.isStatic = false;
        this.isAbstract = false;
        this.isFinal = false;
        this.globalVariables = [];
        this.scopeVariables = [];
        this.functionCalls = [];
    }
}
exports.MethodNode = MethodNode;
class ConstructorNode extends MethodNode {
    constructor() {
        super(...arguments);
        this.isDeprecated = false;
    }
}
exports.ConstructorNode = ConstructorNode;
class FunctionCallNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.params = [];
        this.parents = [];
    }
}
exports.FunctionCallNode = FunctionCallNode;
class VariableNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.type = "unknown";
        this.variableType = "variable"; // "variable" or "property"
    }
}
exports.VariableNode = VariableNode;
class ParameterNode extends VariableNode {
    constructor() {
        super(...arguments);
        this.optional = false;
        this.parents = [];
        this.byRef = false;
        this.nullable = false;
        // To be used with doc comment parsing integration later on
        this.docType = "";
        this.docDescription = "";
    }
}
exports.ParameterNode = ParameterNode;
class PropertyNode extends BaseNode {
    constructor() {
        super(...arguments);
        this.type = "unknown";
        this.isStatic = false;
    }
}
exports.PropertyNode = PropertyNode;
class ConstantNode extends BaseNode {
    constructor() {
        super(...arguments);
        // Constants are always public
        // Constants (should) only be basic types
        this.type = "unknown";
    }
}
exports.ConstantNode = ConstantNode;
var AccessModifierNode;
(function (AccessModifierNode) {
    AccessModifierNode[AccessModifierNode["public"] = 0] = "public";
    AccessModifierNode[AccessModifierNode["private"] = 1] = "private";
    AccessModifierNode[AccessModifierNode["protected"] = 2] = "protected";
})(AccessModifierNode = exports.AccessModifierNode || (exports.AccessModifierNode = {}));
class PositionInfo {
    constructor(line = 0, col = 0, offset = 0) {
        this.line = line;
        this.col = col;
        this.offset = offset;
    }
}
exports.PositionInfo = PositionInfo;
class SymbolLookupCache {
}
exports.SymbolLookupCache = SymbolLookupCache;
class SymbolCache {
}
exports.SymbolCache = SymbolCache;
//# sourceMappingURL=nodes.js.map