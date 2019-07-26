
import { Parser } from './Parser';
import { INavigatorOptions, Navigator } from './Navigator';
import { NodeType, INode } from './Node';
import { IIntentScorer, IntentScorer } from './IntentScorer';
import { ICustomNodeTypeHandler, CustomNodeTypeHandler } from './Action';
import { Map, List } from './Common';
import * as builder from 'botbuilder';
import * as path from 'path';
import * as extend from 'extend';
import * as strformat from 'strformat';
import { Validator } from './Validator';
import { ValueParser, ICustomValueParser, CustomValueParser } from './ValueParser';
import events = require('events');
import { Log, ErrorLog, DebugLog } from './Logging';
import * as utils from './Utils';

var uuid = require('uuid');


/**
 * Interface for {IGraphDialog} options object
 *
 * @export
 * @interface IGraphDialogOptions
 * @extends {INavigatorOptions}
 */
export interface IGraphDialogOptions extends INavigatorOptions {
	/**
	 * The bot object
	 *
	 * @type {builder.UniversalBot}
	 * @memberOf IGraphDialogOptions
	 */
  bot?: builder.UniversalBot;
  /**
   * list of {ICustomNodeTypeHandler} objects
   *
   * @type {ICustomNodeTypeHandler[]}
   * @memberOf IGraphDialogOptions
   */
  customTypeHandlers?: ICustomNodeTypeHandler[];
  /**
   * list of {ICustomValueParser} objects
   *
   * @type {ICustomValueParser[]}
   * @memberOf IGraphDialogOptions
   */
  customValueParsers?: ICustomValueParser[];
  /**
   * a {IHandler} objects for custom logics before a step is being processed
   *
   * @type {IHandler}
   * @memberOf IGraphDialogOptions
   */
  onBeforeProcessingStep?: IHandler;
  /**
 * a {IHandler} objects for custom logics after a step is being processed
 *
 * @type {IHandler}
 * @memberOf IGraphDialogOptions
 */
  onAfterProcessingStep?: IHandler;
}

/**
 * Interface to define a custom node handler
 *
 * @export
 * @interface IHandler
 */
export interface IHandler {
  (session: builder.Session, results, next): void
}

/**
 * Interface to define a step function
 *
 * @interface IStepFunction
 */
interface IStepFunction {
  (session: builder.Session, results, next): void;
}

/**
 * Interface for {GraphDialog} class
 *
 * @export
 * @interface IGraphDialog
 */
export interface IGraphDialog {
  /**
   * Init graph dialog
   *
   * @returns {Promise<IGraphDialog>}
   *
   * @memberOf IGraphDialog
   */
  init(): Promise<IGraphDialog>;
  /**
   * Gets the resulting dialog to attach on the bot
   *
   * @returns {IStepFunction}
   *
   * @memberOf IGraphDialog
   */
  getDialog(): IStepFunction;
  /**
   * Gets the dialog version from the scenario's json
   *
   * @returns {string}
   *
   * @memberOf IGraphDialog
   */
  getDialogVersion(): string;
  /**
   * Gets the the dialog id from the scenario's json
   *
   * @returns {string}
   *
   * @memberOf IGraphDialog
   */
  getDialogId(): string;
  /**
   * Cancel the flow of the existing dialog and starts a new one
   *
   * @returns {void}
   *
   * @memberOf IGraphDialog
   */
  restartDialog(session: builder.Session): void;
  /**
   * Reloads scenarios for this instance.
   * Use this when the scenarios were updated on the remote data source.
   * After calling this method you'll probably want to call the restartDialog API to restart the updated dialog.
   *
   * @returns {Promise<IGraphDialog>}
   *
   * @memberOf IGraphDialog
   */
  reload(): Promise<IGraphDialog>;

  /**
   * Clears graphData from session privateConversationData
   *
   * @memberOf IGraphDialog
   */
  reloadSession(session: builder.Session): void

  /**
   * Gets the scenario id.
   *
   * @returns {string}
   *
   * @memberof IGraphDialog
   */
  getScenarioId(): string;

  /**
   * Gets the scneario id of a block of the current dialog.
   *
   * @param {string} block Block name.
   *
   * @returns {string}
   *
   * @memberof IGraphDialog
   */
  getBlockScenarioId(block: string): string;

  /**
   * Gets an array of all existing chat blocks graph dialogs.
   *
   * @returns {Array<IGraphDialog>}
   *
   * @memberof IGraphDialog
   */
  getBlockGraphDialogs(): Array<IGraphDialog>;
}


/**
 * The Graph Dialog class manages the dialog's state
 *
 * @export
 * @class GraphDialog
 * @implements {IGraphDialog}
 */
export class GraphDialog extends events.EventEmitter implements IGraphDialog {

  static readonly STEP_START_EVENT = 'step_start';
  static readonly STEP_END_EVENT = 'step_end';
  static readonly STEP_CHANGE_EVENT = 'step_change';
  static readonly STEP_OVERRIDE_EVENT = 'step_override';
  static readonly STEP_VALIDATION_FAILED_EVENT = 'step_validation_failed';
  static readonly CHAT_START = 'chat_start_event';
  static readonly CHAT_END_EVENT = 'chat_end_event';
  static readonly VARIABLE_SET_EVENT = 'chat_variable_set';

	/**
	 *
	 *
	 * @private
	 * @type {Navigator}
	 * @memberOf GraphDialog
	 */
  private nav: Navigator;
  /**
   *
   *
   * @private
   * @type {IIntentScorer}
   * @memberOf GraphDialog
   */
  private intentScorer: IIntentScorer;
	/**
	 *
	 *
	 * @private
	 *
	 * @memberOf GraphDialog
	 */
  private done: () => any;
  /**
   *
   *
   * @private
   * @type {Map<ICustomNodeTypeHandler>}
   * @memberOf GraphDialog
   */
  private customTypeHandlers: Map<ICustomNodeTypeHandler>;
  /**
   *
   * @private
   * @type {Map<ICustomValueParser>}
   * @memberOf GraphDialog
   */
  private customValueParsers: Map<ICustomValueParser>;

  /**
   * If set to true, will not travel to next step as the current step needs to be validated
   *
   * @private
   * @type {boolean}
   */
  private validateCurrentNode: boolean = false;

  private parser: Parser = null;
  private internalPath: string;
  private blockGraphDialogs: Array<GraphDialog> = [];


	/**
	 * Creates an instance of GraphDialog.
	 *
	 * @param {IGraphDialogOptions} [options={}]
	 *
	 * @memberOf GraphDialog
	 */
  constructor(private options: IGraphDialogOptions = {}) {
    super();
    if (!options.bot) throw new Error('please provide the bot object');
    this.intentScorer = new IntentScorer();
    // Initialize custom handlers
    options.customTypeHandlers = options.customTypeHandlers || new Array<ICustomNodeTypeHandler>();
    options.customValueParsers = options.customValueParsers || new Array<ICustomValueParser>();
    this.internalPath = '/_' + uuid.v4();
    this.setBotDialog();
    this.checkOrCreateCustomDialogs();

    this.customTypeHandlers = new Map<CustomNodeTypeHandler>();
    for (let i = 0; i < options.customTypeHandlers.length; i++) {
      let handler = <ICustomNodeTypeHandler>options.customTypeHandlers[i];
      this.customTypeHandlers.add(handler.name, handler);
    }
    this.customValueParsers = new Map<CustomValueParser>();
    for (let i = 0; i < options.customValueParsers.length; i++) {
      let handler = <ICustomValueParser>options.customValueParsers[i];
      this.customValueParsers.add(handler.name, handler);
    }
  }

  public getDialogVersion(): string {
    return this.parser ? this.parser.version : null;
  }

  public getDialogId(): string {
    return this.parser ? this.parser.root.id : null;
  }

  /**
   * Gets the scenario id.
   *
   * @returns {string}
   *
   * @memberof IGraphDialog
   */
  public getScenarioId(): string {
    return this.options.scenario;
  }

  /**
   * Gets the scneario id of a block of the current dialog.
   *
   * @param {string} block Block name.
   *
   * @returns {string}
   *
   * @memberof IGraphDialog
   */
  public getBlockScenarioId(block: string): string {
    return `${this.getParentScenearioId()}/block/${block}`
  }

  /**
   * Gets the scenario id of the parent dialog if any, it's own scenario id otherwise.
   *
   * @returns string
   */
  private getParentScenearioId(): string {
    return this.options.scenario.replace(/\/block\/.+$/, '');
  }

  /**
   * Gets an array of all existing chat blocks graph dialogs.
   *
   * @returns {Array<IGraphDialog>}
   *
   * @memberof IGraphDialog
   */
  public getBlockGraphDialogs(): Array<IGraphDialog> {
    return this.blockGraphDialogs;
  }

  /**
   * Initialize a graph based on graph options like a predefined JSON schema
   *
   * @returns {Promise<any>}
   *
   * @memberOf GraphDialog
   */
  public init(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.parser = new Parser(this.options);
      this.parser.init().then((graph) => {
        Log('parser is ready');
        this.nav = new Navigator(this.parser);

        var that = this;
        if (graph.hasOwnProperty('blocks') && Array.isArray(graph.blocks) && graph.blocks.length) {
          let promises = [];
          for (var i = 0; i < graph.blocks.length; i++) {
            let block = graph.blocks[i];
            let options: IGraphDialogOptions = {
              bot: this.options.bot,
              customTypeHandlers: this.options.customTypeHandlers,
              customValueParsers: this.options.customValueParsers,
              scenario: `${this.options.scenario}/block/${block.id}`,
              loadScenario: () => {
                return new Promise((resolve) => {
                  resolve(block);
                });
              }
            };
            promises.push(new GraphDialog(options).init());
          }

          return Promise.all(promises).then((blockGraphDialogs) => {
            this.blockGraphDialogs = blockGraphDialogs;
            resolve(that);
          });
        }

        return resolve(this);
      }).catch(e => reject(e));
    });
  }

	/**
	 * Generate a new graph dialog constructed based on a scenario name
	 *
	 * @static
	 * @param {IGraphDialogOptions} [options={}]
	 * @returns {Promise<IGraphDialog>}
	 *
	 * @memberOf GraphDialog
	 */
  public static fromScenario(options: IGraphDialogOptions = {}): Promise<IGraphDialog> {
    let graphDialog = new GraphDialog(options);
    return graphDialog.init();
  }

  public reload(): Promise<IGraphDialog> {
    return this.init();
  }

  public reloadSession(session: builder.Session): void {
    if (session.hasOwnProperty('dialogData') && session.dialogData) {
      delete session.dialogData._currentNodeId;
    }
  }

  public restartDialog(session: builder.Session): void {

    session.privateConversationData = {};
    Log('calling loop function after restarting dialog');

    // find this dialog on the callstack
    let dialogIndex = -1;
    let callstack = session.sessionState.callstack || [];

    for (let i = callstack.length - 1; i >= 0; i--) {
      let item = callstack[i];
      let path = item.id.split('*:')[1];
      if (path === this.internalPath) {
        dialogIndex = i;
        break;
      }
    };

    session.cancelDialog(dialogIndex, this.internalPath);
  }

  /**
   * Returns the dialog steps to bind to the bot object
   *
   * @returns {IStepFunction}
   *
   * @memberOf GraphDialog
   */
  public getDialog(): IStepFunction {
    Log('get dialog');
    return (session: builder.Session, results, next) => {
      Log('calling loop function for the first time');
      session.beginDialog(this.internalPath);
    };
  }

  /**
    * This is where the magic happens. Loops this list of steps for each node.
    *
    * @private
    *
    * @memberOf GraphDialog
    */
  private setBotDialog(): void {

    this.options.bot.dialog(this.internalPath, [
      (session, args, next) => {
        Log('before processing');
        // Add variables object.
        session.privateConversationData._vars = session.privateConversationData._vars || {};
        // Recover current node id after exiting from a block.
        if (args && args.hasOwnProperty('_overrideCurrentNodeId')) {
          session.dialogData.data = args.data || {};
          session.dialogData._currentNodeId = args._overrideCurrentNodeId;
        } else {
          session.dialogData.data = args || {};
        }
        if (this.options.onBeforeProcessingStep)
          return this.options.onBeforeProcessingStep.call(this, session, args, next);
        else return next();
      },
      (session, args, next) => {
        return this.stepInteractionHandler(session, args, next);
      },
      (session, results, next) => {
        return this.stepValueParserHandler(session, results, next);
      },
      (session, results, next) => {
        return this.stepValidationHandler(session, results, next);
      },
      (session, results, next) => {
        return this.stepResultCollectionHandler(session, results, next);
      },
      (session, args, next) => {
        if (this.options.onAfterProcessingStep)
          return this.options.onAfterProcessingStep.call(this, session, args, next);
        else return next();
      },
      (session, args, next) => {
        return this.setNextStepHandler(session, args, next);
      },
      (session, args, next) => {
        Log('calling loop function');

        // Merge block dialog and current dialog data.
        session.replaceDialog(this.internalPath, { data: Object.assign(Object.assign({}, session.dialogData.data), args), _overrideCurrentNodeId: session.dialogData._currentNodeId });
      }
    ]);
  }

  private checkOrCreateCustomDialogs() {
    if (!this.options.bot.dialog('carouselPrompt')) {
      this.options.bot.dialog('carouselPrompt', [
        (session, args, next) => {
          if (!session.dialogData.config) {
            session.dialogData.data = args.data;
            session.dialogData.config = args.config;
            session.send(this.generateCarouselMessage(builder, session, args.config));
          } else {
            next();
          }
        },
        (session, args, next) => {
          let response = session.message.text;
          if (typeof session.dialogData.config.responses != "undefined") {
            if (typeof session.dialogData.config.responses[response] != "undefined") {
              let value = response;
              for (let card of session.dialogData.config.cards) {
                if (card.id == session.dialogData.config.responses[response]) {
                  var copyOfCard = Object.assign({}, card);
                  copyOfCard.data.buttons = [];
                  session.send(this.generateHeroCardMessage(builder, session, card));
                  session.endDialogWithResult({ 'response': value });
                  return;
                }
              }
              session.send(this.generateCarouselMessage(builder, session, session.dialogData.config));
              return;
            }

          }

        }
      ]
      );
    }
  }

  /**
   * This is where the bot interacts with the user
   *
   * @private
   * @param {builder.Session} session
   * @param {any} results
   * @param {any} next
   * @returns {void}
   *
   * @memberOf GraphDialog
   */
  private stepInteractionHandler(session: builder.Session, results, next): void {
    session.privateConversationData._lastMessage = session.message && session.message.text;
    let currentNode = this.nav.getCurrentNode(session);
    let skipAfterError = false;
    if (currentNode && currentNode.skipAfterError) {
      skipAfterError = true;
      currentNode.skipAfterError = false;
    }
    Log(`perform action: ${currentNode.id}, ${currentNode.type}`);

    switch (currentNode.type) {

      case NodeType.text:

        if (Array.isArray(currentNode.data.text)) {
          for (let message of currentNode.data.text) {
            Log(`sending text for node ${currentNode.id}, text: \'${message}\'`);
            session.send(utils.replaceVariables(message, session));
          }
        } else {
          var text = currentNode.data.text;

          Log(`sending text for node ${currentNode.id}, text: \'${text}\'`);
          session.send(utils.replaceVariables(text, session));
        }
        return next();

      case NodeType.prompt:
        Log(`builder.ListStyle.button: ${builder.ListStyle["button"]}`);
        var promptType = currentNode.data.type || 'text';
        builder.Prompts[promptType](
          session,
          skipAfterError ? {} : utils.replaceVariables(currentNode.data.text, session),
          currentNode.data.options,
          {
            listStyle: currentNode.data.config && currentNode.data.config.listStyle && builder.ListStyle[currentNode.data.config.listStyle] || builder.ListStyle.button
          });
        break;

      case NodeType.score:
        /**
         * gets list of models
         *
         * @param {any} model
         */
        var botModels = currentNode.data.models.map(model => this.nav.models.get(model));

        var score_text = session.dialogData.data[currentNode.data.source] || session.privateConversationData._lastMessage;
        Log(`LUIS scoring for node: ${currentNode.id}, text: \'${score_text}\' LUIS models: ${botModels}`);

        this.intentScorer.collectIntents(botModels, score_text, currentNode.data.threashold)
          .then(intents => {
            if (intents && intents.length) {
              this.stepResultCollectionHandler(session, { response: intents[0] }, next);
            }
          },
            function (err) {
              throw error;
            }
          );

        break;

      case NodeType.handler:
        var handlerName = currentNode.data.name;
        let handler: IHandler = <IHandler>this.nav.handlers.get(handlerName);
        Log('calling handler: ', currentNode.id, handlerName);
        handler(session, next, currentNode.data);
        break;

      case NodeType.sequence:
        return next();

      case NodeType.end:
        Log('ending dialog, node:', currentNode.id);
        session.send(currentNode.data.text || 'Bye bye!');
        session.endConversation(); // this will also clear the privateConversationData
        break;

      case NodeType.heroCard:
        session.send(this.generateHeroCardMessage(builder, session, currentNode));
        return next();

      case NodeType.carousel:
        session.beginDialog('carouselPrompt', {
          data: session.dialogData.data,
          config: currentNode.data
        });
        break;

      default:

        let customHandler: ICustomNodeTypeHandler = this.customTypeHandlers.get(currentNode.typeName);
        if (customHandler) {
          Log(`invoking custom node type handler: ${currentNode.typeName}`);
          return customHandler.execute(session, next, currentNode.data, this);
        }

        var msg = 'Node type ' + currentNode.typeName + ' is not recognized';
        console.error(msg);
        var error = new Error(msg);
        console.error(error);
        throw error;
    }
  }


  /**
   * Generates a HeroCard (to be attached to a Message)
   *
   * @param builder
   * @param session
   * @param data
   * @returns {HeroCard}
   */
  private generateHeroCard(builder, session, data) {
    var hero = new builder.HeroCard(session);

    if ("undefined" != typeof data.title) {
      hero.title(utils.replaceVariables(data.title, session));
    }
    if ("undefined" != typeof data.subtitle) {
      hero.subtitle(utils.replaceVariables(data.subtitle, session));
    }
    if ("undefined" != typeof data.text) {
      hero.text(utils.replaceVariables(data.text, session));
    }
    if ("undefined" != typeof data.images[0] && data.images.length > 0) {
      let imageCard = builder.CardImage.create(session, data.images[0]);
      hero.images([
        imageCard
      ]);
      if (data.imageTap) {
        switch (data.imageTap.action) {
          case "openUrl":
            imageCard.tap(builder.CardAction.openUrl(session, data.imageTap.value));
            break;
          case "showImage":
            imageCard.tap(builder.CardAction.showImage(session, data.imageTap.value));
            break;
        }
      }
    }
    if ("undefined" != typeof data.tap) {
      switch (data.tap.action) {
        case "openUrl":
          hero.tap(builder.CardAction.openUrl(session, data.tap.value));
          break;
        case "showImage":
          hero.tap(builder.CardAction.showImage(session, data.tap.value));
          break;
      }
    }

    if ("undefined" != typeof data.buttons) {
      var buttons = [];
      data.buttons.forEach((item, index) => {
        switch (item.action) {
          case "openUrl":
            buttons.push(builder.CardAction.openUrl(session, item.value, utils.replaceVariables(item.label || item.value, session)));
            break;
          case "imBack":
            buttons.push(builder.CardAction.imBack(session, item.value, utils.replaceVariables(item.label, session)));
            break;
          case "postBack":
            buttons.push(builder.CardAction.postBack(session, item.value, utils.replaceVariables(item.label, session)));
            break;
        }
      });
      if (buttons.length > 0) {
        hero.buttons(buttons);
      }
    }

    return hero;
  }

  /**
   * Generates a HeroCard Message
   *
   * @param builder
   * @param session
   * @param node
   * @returns {Message}
   */

  public generateHeroCardMessage(builder, session, node) {
    var hero = this.generateHeroCard(builder, session, node.data);

    return new builder.Message(session)
      .textFormat(builder.TextFormat.xml)
      .attachments([hero]);
  }

  /**
   * Generates a Carousel Message
   *
   * @param builder
   * @param session
   * @param data
   * @returns {Message}
   */

  public generateCarouselMessage(builder, session, data) {
    if ("undefined" != typeof data.text) {
      session.send(utils.replaceVariables(data.text, session));
    }

    if ("undefined" != typeof data.cards && data.cards.length > 0) {
      var cards = [];
      data.cards.forEach((item, index) => {
        cards.push(this.generateHeroCard(builder, session, item.data));
      });

      return new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(cards);
    }
  }

  /**
   * Handling validation of the user input
   *
   * @private
   * @param {builder.Session} session
   * @param {any} results
   * @param {any} next
   * @returns
   *
   * @memberOf GraphDialog
   */
  private stepValidationHandler(session: builder.Session, results, next) {
    Log('Validation phase');
    let currentNode = this.nav.getCurrentNode(session);
    let varname = currentNode.varname;

    if (!(results.response && varname))
      return next(results);

    if (
      "undefined" != typeof currentNode.data.validation &&
      currentNode.data.validation instanceof Array) {
      for (let element of currentNode.data.validation) {
        // Perform validations
        var isValid = Validator.validate(element.type, results.response, element.setup);
        if (false == isValid) {
          let invalidMsg = "undefined" != typeof element.setup.invalid_msg ? element.setup.invalid_msg : 'Invalid value';
          session.send(utils.replaceVariables(invalidMsg, session));
          currentNode.needValidation = true;
          if (currentNode.body && currentNode.body.showAfterError === false) {
            currentNode.skipAfterError = true;
          }
          this.emit(GraphDialog.STEP_VALIDATION_FAILED_EVENT, session, {
            currentNode: Object.assign({}, currentNode),
            response: results.reponse,
            validator: element
          });
          return next(results);
        }
      }
    }
    return next(results);
  }

  /**
 * Handling validation of the user input
 *
 * @private
 * @param {builder.Session} session
 * @param {any} results
 * @param {any} next
 * @returns
 *
 * @memberOf GraphDialog
 */
  private stepValueParserHandler(session: builder.Session, results, next) {
    let currentNode = this.nav.getCurrentNode(session);
    let varname = currentNode.varname;

    if (!(results.response && varname))
      return next(results);
    if (
      "undefined" != typeof currentNode.data.valueParser) {

      let parsers = currentNode.data.valueParser;
      if (!Array.isArray(parsers)) {
        parsers = [parsers];
      }
      results.beforeParseResponse = {};
      for (let valueParser of parsers) {
        try {
          if (this.customValueParsers.has(valueParser)) {
            results.beforeParseResponse[valueParser] = Object.assign({}, results.response);
            let parser = this.customValueParsers.get(valueParser);
            results.response = parser.parse(session, results.response, currentNode);
          }
          else {
            results.beforeParseResponse[valueParser] = Object.assign({}, results.response);
            results.response = ValueParser[valueParser](session, results.response, currentNode);
          }
        }
        catch (e) {
          ErrorLog('Value Parser phase', e);
        }
      }

    }
    return next(results);
  }


  /**
   * Handling collection of the user input
   *
   * @private
   * @param {builder.Session} session
   * @param {any} results
   * @param {any} next
   * @returns
   *
   * @memberOf GraphDialog
   */
  private stepResultCollectionHandler(session: builder.Session, results, next) {
    DebugLog('Result phase', results);

    let currentNode = this.nav.getCurrentNode(session);
    let varname = currentNode.varname;

    if (results.assignments instanceof Object) {
      for (let key in results.assignments) {
        if (results.assignments.hasOwnProperty(key)) {
          session.privateConversationData._vars[key] = results.assignments[key];
          Log('assigning request for node: %s, variable: %s, value: %s', currentNode.id, key, session.privateConversationData._vars[key]);
        }
      }
    }
    if (results.nextStepId) {
      session.dialogData['_nextStep'] = results.nextStepId;
    }
    if (!(results.response && varname)) {
      return next(results);
    }

    let value: any = null;
    switch (currentNode.type) {
      case NodeType.prompt:

        // TODO switch to enum
        switch (currentNode.data.type) {
          case 'choice':
            value = currentNode.data.options[Object.keys(currentNode.data.options)[results.response.index]]
            break;
          case 'time':
            value = results.response.entity;
            break;
          default:
            value = results.response;
        }
        break;
      default:
        value = results.response;
    }

    session.privateConversationData._vars[varname] = value;
    this.emit(GraphDialog.VARIABLE_SET_EVENT, session, {
      currentNode: currentNode,
      varname: varname,
      value: value
    });
    Log('collecting response for node: %s, variable: %s, value: %s', currentNode.id, varname, session.privateConversationData._vars[varname]);
    for (let additionalVarname of currentNode.additionalVarnames) {
      session.privateConversationData._vars[additionalVarname] = session.privateConversationData._vars[varname];
      Log('collecting response for node: %s, variable: %s, value: %s', currentNode.id, additionalVarname, session.privateConversationData._vars[varname]);
    }
    return next(results);
  }

  /**
   * Evaluates and moves to the next node in the graph
   *
   * @private
   * @param {builder.Session} session
   * @param {any} args
   * @param {any} next
   * @returns {*}
   *
   * @memberOf GraphDialog
   */
  private setNextStepHandler(session: builder.Session, args, next): any {

    let nextNode: INode = null;

    let currentNode = this.nav.getCurrentNode(session);
    if (currentNode && currentNode.id == this.parser.root.id) {
      this.emit(GraphDialog.CHAT_START, session, {
        root: this.parser.root
      });
    }

    if (currentNode.needValidation) {
      nextNode = currentNode;
      currentNode.needValidation = false;
    } else {
      if (session.dialogData['_nextStep']) {
        nextNode = this.nav.getNextNode(session, session.dialogData['_nextStep']);
        if (nextNode && nextNode.id == session.dialogData['_nextStep']) {
          this.emit(GraphDialog.STEP_OVERRIDE_EVENT, session, {
            from: Object.assign({}, currentNode),
            to: Object.assign({}, nextNode)
          });
        }
      } else {
        nextNode = this.nav.getNextNode(session);
      }
    }
    delete session.dialogData['_nextStep'];
    if (!nextNode || nextNode.id != currentNode.id) {
      this.emit(GraphDialog.STEP_END_EVENT, session, {
        node: Object.assign({}, currentNode)
      });
    }
    if (nextNode) {
      Log(`step handler node: ${nextNode.id}`);
      if (nextNode.id != currentNode.id) {
        this.emit(GraphDialog.STEP_CHANGE_EVENT, session, {
          from: Object.assign({}, currentNode),
          to: Object.assign({}, nextNode)
        });
        this.emit(GraphDialog.STEP_START_EVENT, session, {
          node: Object.assign({}, nextNode)
        });
      }
    }
    else {
      Log('ending dialog');
      this.emit(GraphDialog.CHAT_END_EVENT, session, {
        'root': this.parser.root
      });
      if (session.dialogStack().length > 1) {
        return session.endDialogWithResult(session.dialogData.data);
      } else {
        return session.endConversation();
      }
    }

    return next(args);
  }
}
