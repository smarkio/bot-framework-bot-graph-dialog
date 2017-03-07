"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("./Common");
class Scenario {
    constructor(condition, node = null) {
        this.condition = condition;
        this.node = node;
        this.steps = new Common_1.List();
    }
}
exports.Scenario = Scenario;
