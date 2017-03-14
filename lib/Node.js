"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("./Common");
var NodeType;
(function (NodeType) {
    NodeType[NodeType["text"] = 0] = "text";
    NodeType[NodeType["prompt"] = 1] = "prompt";
    NodeType[NodeType["score"] = 2] = "score";
    NodeType[NodeType["handler"] = 3] = "handler";
    NodeType[NodeType["sequence"] = 4] = "sequence";
    NodeType[NodeType["end"] = 5] = "end";
    NodeType[NodeType["heroCard"] = 6] = "heroCard";
    NodeType[NodeType["carousel"] = 7] = "carousel";
})(NodeType = exports.NodeType || (exports.NodeType = {}));
class Node {
    constructor(node, type) {
        this.id = node.id;
        this.name = node.name || node.id;
        if (typeof type === 'string') {
            this.type = NodeType[type];
            this.typeName = type;
        }
        else
            this.type = type;
        this.varname = node.varname || this.id;
        this.additionalVarnames = node.additionalVarnames || [];
        this.steps = new Common_1.List();
        this.scenarios = new Common_1.List();
        this.body = node;
        this.data = node.data;
    }
}
exports.Node = Node;
