import * as builder from 'botbuilder';

import { INode } from './Node';

export module ValueParser {

    /**
     * 
     * @param {string} value
     *  
     */
    export function time(session: builder.Session, value: any): any {

        value.entity = value.resolution.start.getHours() + ':' +
            ("0" + value.resolution.start.getMinutes()).substr(-2) + ':' +
            ("0" + value.resolution.start.getSeconds()).substr(-2)
            ;
        return value;

    }

    /**
     * 
     * @param {string} value
     *  
     */
    export function date(session: builder.Session, value: any): any {

        value.entity = value.resolution.start.getFullYear() + '-' +
            ("0" + (1 + value.resolution.start.getMonth())).substr(-2) + '-' +
            ("0" + value.resolution.start.getDate()).substr(-2);
        return value;
    }

    export function email(session: builder.Session, value: any): any {
        let result = null;
        if (
            (session.message.source == 'slack' &&
                (result = /^<mailto:(.*)\|.*>$/.exec(value)) != null) ||
            (session.message.source == 'skype' &&
                (result = /^<a\s+href="mailto:(.+)">.*$/.exec(value)) != null
            )
        ) {
            return result[1];
        }


        return value;
    }

    /**
     * 
     * @param {builder.Session} session 
     * @param {any} value 
     */
    export function trim(session: builder.Session, value: any): any {
        if (typeof value === "string") {
            return value.trim();
        }
        return value;
    }

}

export interface IParseValue {
    /**
     * @param  {builder.Session} session
     * @param  {any} value
     * @returns {any}
     */
    (session: builder.Session, value: any, currentNode: INode): any
}

export interface ICustomValueParser {
    /**
     * name
     */
    name: string

    /**
     * the parser function
     */
    parse: IParseValue
}

export class CustomValueParser implements ICustomValueParser {

    /**
	 * @param  {string} name the name for the parser
	 * @param  {IParseValue} parse the parser function
	 */
    constructor(public name: string, public parse: IParseValue) {

    }
}