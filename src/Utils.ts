import * as builder from 'botbuilder';

export function replaceVariables(text: string, session: builder.Session, defaultReplacement?: string): string {
    defaultReplacement = defaultReplacement === undefined ? ' ' : defaultReplacement;
    return text.replace(/\{\{\%([^%]+)\%\}\}/g, function (_, item) {
        if (typeof session.privateConversationData._vars[item] !== 'undefined') {
            return session.privateConversationData._vars[item];
        }
        return defaultReplacement;
    });
}
