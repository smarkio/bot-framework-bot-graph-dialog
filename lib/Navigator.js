"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ConditionHandler_1 = require("./ConditionHandler");
const Logging_1 = require("./Logging");
class Navigator {
    constructor(parser, options = {}) {
        this.parser = parser;
        this.options = options;
        this.models = parser.models;
        this.handlers = parser.handlers;
    }
    getCurrentNode(session) {
        Logging_1.Log('getCurrentNode');
        let currNodeId = session.privateConversationData._currentNodeId;
        if (!currNodeId) {
            let root = this.parser.root;
            session.privateConversationData._currentNodeId = root && root.id;
            return root;
        }
        let current = this.parser.getNodeInstanceById(currNodeId);
        return current;
    }
    getNextNode(session, overrideId) {
        Logging_1.Log('getNextNode');
        let next = null;
        let current = this.parser.getNodeInstanceById(session.privateConversationData._currentNodeId);
        let scenarios = current.scenarios;
        for (var i = 0; i < current.scenarios.size(); i++) {
            var scenario = current.scenarios.get(i);
            if (ConditionHandler_1.ConditionHandler.evaluateExpression(session.dialogData.data, scenario.condition)) {
                next = scenario.node || scenario.steps.get(0);
            }
        }
        if (overrideId) {
            Logging_1.Log(`OverrideNode Id set, trying to find node ${overrideId}`);
            next = this.parser.getNodeInstanceById(overrideId);
            if (!next) {
                Logging_1.Log('OverrideNode not found continuing with normal process');
            }
        }
        if (!next) {
            let scenarios = current.scenarios;
            for (var i = 0; i < current.scenarios.size(); i++) {
                var scenario = current.scenarios.get(i);
                if (ConditionHandler_1.ConditionHandler.evaluateExpression(session.dialogData, scenario.condition)) {
                    next = scenario.node || scenario.steps.get(0);
                }
            }
        }
        next = next || current.steps.get(0);
        var nodeNavigator = current;
        while (!next && nodeNavigator) {
            next = nodeNavigator.next;
            nodeNavigator = nodeNavigator.parent;
        }
        Logging_1.Log(`getNextNode: [current: ${current.id}, next: ${next && next.id}]`);
        session.privateConversationData._currentNodeId = next && next.id;
        return next;
    }
}
exports.Navigator = Navigator;
