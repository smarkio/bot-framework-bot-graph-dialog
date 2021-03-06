import * as builder from 'botbuilder';
import {IGraphDialog} from './GraphDialog';

/**
 * Interface for a custom handler callback
 */
export interface IExecute {
    /**
     * @param  {builder.Session} session
     * @param  {} next
     * @param  {} data
	 * @param  {IGraphDialog} graphDialog
     * @returns void
     */
    (session: builder.Session, next, data, graphDialog: IGraphDialog): void
}

/**
 * Interface for providing a custom node handler
 */
export interface ICustomNodeTypeHandler {

	/**
	 * the name
	 */
	name: string,

	/**
	 * the handler
	 */
	execute: IExecute
}

/**
 * Wrapper for a custom node handler
 */
export class CustomNodeTypeHandler implements ICustomNodeTypeHandler {
		
	/**
	 * @param  {string} name the name for the handler
	 * @param  {IExecute} execute the handler callback
	 */
	constructor(public name: string, public execute: IExecute) {

	}

}