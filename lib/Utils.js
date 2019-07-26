"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
