import * as builder from 'botbuilder';
import { GraphDialog } from './GraphDialog';
var smarkioRulesEngine = new(require('smarkio-rules-engine'))();

export function replaceVariables(text: string, session: builder.Session, defaultReplacement?: string): string {
    defaultReplacement = defaultReplacement === undefined ? ' ' : defaultReplacement;
    return text.replace(/\{\{\%([^%]+)\%\}\}/g, function (_, item) {
        if (typeof session.privateConversationData._vars[item] !== 'undefined') {
            return session.privateConversationData._vars[item];
        }
        return defaultReplacement;
    });
}

function goalsCounterById(session: builder.Session, graphDialog: GraphDialog): any{
    if(!session.userData._goals){
        return {};
    }
    var dialogGoals = graphDialog.getGoals();
    if(!dialogGoals){
        return {};
    }
    var counters = {};
    var goals = session.userData._goals;
    for(var i in goals){
        if(!dialogGoals.hasOwnProperty(goals[i].goalId)){
            continue;
        }
        if(!counters.hasOwnProperty(goals[i].goalId)){
            counters[goals[i].goalId] = 0;
        }
        var period = 30;
        if(dialogGoals[goals[i].goalId] && dialogGoals[goals[i].goalId].hasOwnProperty('period')){
            period = dialogGoals[goals[i].goalId].period;
        }
        if(((new Date()).getTime()-goals[i].timeStamp)/86400000< period){
            counters[goals[i].goalId]++;
        }
    }
    return counters;
}

export function getAllVariables(session: builder.Session, graphDialog: GraphDialog, includeGoals: boolean =  false): object {
    let variables = Object.assign({}, session.privateConversationData._vars);
    if(includeGoals){
        var goals = goalsCounterById(session, graphDialog);
        for(var i in goals){
            if(goals.hasOwnProperty(i)){
                variables['__goal_'+i] = goals[i];
                variables['__goal_'+i.replace(/-/g,'_')] = goals[i];
            }
        }
    }
    return variables;
}

export function getBlockToJump(session: builder.Session, graphDialog: GraphDialog): string | undefined{
    let vars = getAllVariables(session,graphDialog,true);
    vars['_smk_internal_inactive_time'] =  Math.trunc((new Date().getTime() - (session.privateConversationData._last_interaction || 0))/1000);
    vars['_smk_internal_gbl_interaction'] = 'interacted';
    var rules = graphDialog.getGobalRules()
    for(var i in rules){
        var result = smarkioRulesEngine.evaluate(rules[i].condition, vars);
        if(result){
            return rules[i].block;
        }
    }
    return null;
}
