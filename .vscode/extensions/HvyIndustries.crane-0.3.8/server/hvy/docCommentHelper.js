/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodes_1 = require("./nodes");
const namespaces_1 = require("../util/namespaces");
const docParser = require("doc-parser");
var docReader = new docParser();
class DocCommentHelper {
    constructor() {
        this.scalarTypes = ["bool", "boolean", "int", "integer", "float", "number", "string", "array", "null", "void"];
    }
    buildDocCommentFromBranch(branch, tree) {
        // TODO -- handle {@inheritDoc}
        var rawParsedComment = docReader.parse(branch.lines);
        var docComment = new nodes_1.DocComment(rawParsedComment.summary);
        docComment.startPos = this.buildPosition(branch.loc.start);
        docComment.endPos = this.buildPosition(branch.loc.end);
        if (rawParsedComment.body) {
            rawParsedComment.body.forEach(item => {
                if (item.kind) {
                    switch (item.kind) {
                        case "block":
                            if (item.name == "var" && item.options) {
                                var typeName = "";
                                item.options.forEach(namePart => {
                                    typeName += "\\" + namePart.value;
                                });
                                if (typeName != "" && typeName.charAt(0) == "\\") {
                                    typeName = typeName.substring(1, typeName.length);
                                }
                                docComment.returns = this.buildReturn(item, tree, typeName);
                            }
                            break;
                        case "return":
                            docComment.returns = this.buildReturn(item, tree);
                            break;
                        case "param":
                            docComment.params.push(this.buildParam(item, tree));
                            break;
                        case "throws":
                            docComment.throws.push(this.buildThrows(item, tree));
                            break;
                        case "deprecated":
                            docComment.deprecated = true;
                            docComment.deprecatedMessage = item.description;
                            break;
                    }
                }
            });
        }
        return docComment;
    }
    buildParam(item, tree) {
        var param = new nodes_1.DocCommentParam("$" + item.name, null, item.description);
        param.type = item.type.name;
        if (param.type == null) {
            return null;
        }
        if (this.scalarTypes.indexOf(param.type) == -1) {
            param.type = namespaces_1.Namespaces.getFQNFromClassname(param.type, tree);
        }
        return param;
    }
    buildThrows(item, tree) {
        var param = new nodes_1.DocCommentParam(null, null, item.description);
        param.type = item.what.name;
        if (this.scalarTypes.indexOf(param.type) == -1) {
            param.type = namespaces_1.Namespaces.getFQNFromClassname(param.type, tree);
        }
        return param;
    }
    buildReturn(item, tree, type = null) {
        if (type == null || type == "") {
            if (item.what == null) {
                return null;
            }
            type = item.what.name;
        }
        var returns = new nodes_1.DocCommentParam(null, type);
        if (item.description) {
            returns.summary = item.description;
        }
        if (returns.type == null) {
            return null;
        }
        if (this.scalarTypes.indexOf(returns.type) == -1) {
            returns.type = namespaces_1.Namespaces.getFQNFromClassname(returns.type, tree);
        }
        return returns;
    }
    buildPosition(position) {
        return new nodes_1.PositionInfo(position.line - 1, position.column, position.offset);
    }
}
exports.DocCommentHelper = DocCommentHelper;
//# sourceMappingURL=docCommentHelper.js.map