"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockToJump = exports.getAllVariables = exports.replaceVariables = void 0;
var smarkioRulesEngine = new (require('smarkio-rules-engine'))();
function replaceVariables(text, session, defaultReplacement) {
    defaultReplacement = defaultReplacement === undefined ? ' ' : defaultReplacement;
    return text.replace(/\{\{\%([^%]+)\%\}\}/g, function (_, item) {
        if (typeof session.privateConversationData._vars[item] !== 'undefined') {
            return session.privateConversationData._vars[item];
        }
        return defaultReplacement;
    });
}
exports.replaceVariables = replaceVariables;
function goalsCounterById(session, graphDialog) {
    var dialogGoals = graphDialog.getGoals();
    if (!dialogGoals) {
        return {};
    }
    var counters = {};
    for (const goal in dialogGoals) {
        if (dialogGoals.hasOwnProperty(goal)) {
            counters[goal] = 0;
        }
    }
    var goals = session.userData._goals || {};
    for (var i in goals) {
        if (!dialogGoals.hasOwnProperty(goals[i].goalId)) {
            continue;
        }
        if (!counters.hasOwnProperty(goals[i].goalId)) {
            counters[goals[i].goalId] = 0;
        }
        var period = 30;
        if (dialogGoals[goals[i].goalId] && dialogGoals[goals[i].goalId].hasOwnProperty('period')) {
            period = dialogGoals[goals[i].goalId].period;
        }
        if (((new Date()).getTime() - goals[i].timeStamp) / 86400000 < period) {
            counters[goals[i].goalId]++;
        }
    }
    return counters;
}
function getAllVariables(session, graphDialog, includeGoals = false) {
    let variables = Object.assign({}, session.privateConversationData._vars);
    if (includeGoals) {
        var goals = goalsCounterById(session, graphDialog);
        for (var i in goals) {
            if (goals.hasOwnProperty(i)) {
                variables['__goal_' + i] = goals[i];
                variables['__goal_' + i.replace(/-/g, '_')] = goals[i];
            }
        }
    }
    return variables;
}
exports.getAllVariables = getAllVariables;
function getBlockToJump(session, graphDialog, existsOnSessionMatched) {
    let vars = getAllVariables(session, graphDialog, true);
    vars['_smk_internal_inactive_time'] = Math.trunc((new Date().getTime() - (session.privateConversationData._last_interaction || 0)) / 1000);
    vars['_smk_internal_gbl_interaction'] = 'interacted';
    var rules = graphDialog.getGobalRules();
    for (var i in rules) {
        var result = smarkioRulesEngine.evaluate(rules[i].condition, vars);
        let persistent = rules[i].multiple_runs || false;
        if (result && (persistent || !existsOnSessionMatched)) {
            return rules[i].block;
        }
    }
    return null;
}
exports.getBlockToJump = getBlockToJump;
