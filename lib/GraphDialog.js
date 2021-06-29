"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDialog = void 0;
const Parser_1 = require("./Parser");
const Navigator_1 = require("./Navigator");
const Node_1 = require("./Node");
const IntentScorer_1 = require("./IntentScorer");
const Common_1 = require("./Common");
const builder = require("botbuilder");
const Validator_1 = require("./Validator");
const ValueParser_1 = require("./ValueParser");
const events = require("events");
const Logging_1 = require("./Logging");
const utils = require("./Utils");
var uuid = require('uuid');
class GraphDialog extends events.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.validateCurrentNode = false;
        this.parser = null;
        this.blockGraphDialogs = [];
        if (!options.bot)
            throw new Error('please provide the bot object');
        this.intentScorer = new IntentScorer_1.IntentScorer();
        options.customTypeHandlers = options.customTypeHandlers || new Array();
        options.customValueParsers = options.customValueParsers || new Array();
        this.internalPath = null;
        this.customTypeHandlers = new Common_1.Map();
        for (let i = 0; i < options.customTypeHandlers.length; i++) {
            let handler = options.customTypeHandlers[i];
            this.customTypeHandlers.add(handler.name, handler);
        }
        this.customValueParsers = new Common_1.Map();
        for (let i = 0; i < options.customValueParsers.length; i++) {
            let handler = options.customValueParsers[i];
            this.customValueParsers.add(handler.name, handler);
        }
    }
    getDialogVersion() {
        return this.parser ? this.parser.version : null;
    }
    getDialogId() {
        return this.parser ? this.parser.root.id : null;
    }
    getGoals() {
        return (this.parser && this.parser.root.data.goals) ? this.parser.root.data.goals : null;
    }
    getGobalRules() {
        return (this.parser && this.parser.root.data.globalRules) ? this.parser.root.data.globalRules : null;
    }
    getScenarioId() {
        return this.options.scenario;
    }
    getBlockScenarioId(block) {
        if (this.options.scenario.indexOf('/block/') >= 0) {
            return `${this.getParentScenearioId()}/block/${block}`;
        }
        else {
            return `${this.getParentScenearioId()}_${this.getDialogVersion()}/block/${block}`;
        }
    }
    getParentScenearioId() {
        return this.options.scenario.replace(/\/block\/.+$/, '');
    }
    getBlockGraphDialogs() {
        return this.blockGraphDialogs;
    }
    init() {
        return new Promise((resolve, reject) => {
            this.parser = new Parser_1.Parser(this.options);
            this.parser.init().then((graph) => {
                Logging_1.Log('parser is ready');
                this.nav = new Navigator_1.Navigator(this.parser);
                let scenario = this.getScenarioId();
                if (scenario.indexOf('/block/') >= 0) {
                    this.internalPath = `/${this.getScenarioId()}_int`;
                }
                else {
                    this.internalPath = `/${this.getScenarioId()}_${this.getDialogVersion()}`;
                }
                this.setBotDialog();
                this.checkOrCreateCustomDialogs();
                var that = this;
                if (graph.hasOwnProperty('blocks') && Array.isArray(graph.blocks) && graph.blocks.length) {
                    let sharedData = graph.sharedData || {};
                    let promises = [];
                    for (let i = 0; i < graph.blocks.length; i++) {
                        let block = graph.blocks[i];
                        block.sharedData = sharedData;
                        let options = {
                            bot: this.options.bot,
                            customTypeHandlers: this.options.customTypeHandlers,
                            customValueParsers: this.options.customValueParsers,
                            scenario: this.getBlockScenarioId(block.id),
                            loadScenario: () => {
                                return new Promise((resolve) => {
                                    resolve(block);
                                });
                            }
                        };
                        promises.push(new GraphDialog(options).init());
                    }
                    return Promise.all(promises).then((blockGraphDialogs) => {
                        for (let i = 0; i < blockGraphDialogs.length; i++) {
                            let blockGraphDialog = blockGraphDialogs[i];
                            blockGraphDialog.on(GraphDialog.CHAT_END_EVENT, function (session, args) {
                                that.emit(GraphDialog.CHAT_END_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.STEP_START_EVENT, function (session, args) {
                                that.emit(GraphDialog.STEP_START_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.STEP_END_EVENT, function (session, args) {
                                that.emit(GraphDialog.STEP_END_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.STEP_CHANGE_EVENT, function (session, args) {
                                that.emit(GraphDialog.STEP_CHANGE_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.STEP_OVERRIDE_EVENT, function (session, args) {
                                that.emit(GraphDialog.STEP_OVERRIDE_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.STEP_VALIDATION_FAILED_EVENT, function (session, args) {
                                that.emit(GraphDialog.STEP_VALIDATION_FAILED_EVENT, session, args);
                            });
                            blockGraphDialog.on(GraphDialog.VARIABLE_SET_EVENT, function (session, args) {
                                that.emit(GraphDialog.VARIABLE_SET_EVENT, session, args);
                            });
                        }
                        this.blockGraphDialogs = blockGraphDialogs;
                        resolve(that);
                    });
                }
                return resolve(this);
            }).catch(e => reject(e));
        });
    }
    static fromScenario(options = {}) {
        let graphDialog = new GraphDialog(options);
        return graphDialog.init();
    }
    reload() {
        return this.init();
    }
    reloadSession(session) {
        if (session.hasOwnProperty('dialogData') && session.dialogData) {
            delete session.dialogData._currentNodeId;
        }
    }
    restartDialog(session) {
        session.privateConversationData = {};
        Logging_1.Log('calling loop function after restarting dialog');
        let dialogIndex = -1;
        let callstack = session.sessionState.callstack || [];
        for (let i = callstack.length - 1; i >= 0; i--) {
            let item = callstack[i];
            let path = item.id.split('*:')[1];
            if (path === this.internalPath) {
                dialogIndex = i;
                break;
            }
        }
        ;
        session.cancelDialog(dialogIndex, this.internalPath);
    }
    getDialog() {
        Logging_1.Log('get dialog');
        return (session, results, next) => {
            Logging_1.Log('calling loop function for the first time');
            session.beginDialog(this.internalPath);
        };
    }
    setBotDialog() {
        Logging_1.Log('Setting bot dialog', this.internalPath);
        this.options.bot.dialog(this.internalPath, [
            (session, args, next) => {
                Logging_1.Log('before processing');
                session.privateConversationData._vars = session.privateConversationData._vars || {};
                session.privateConversationData._last_interaction = new Date().getTime();
                if (args && args.hasOwnProperty('_currentNodeId')) {
                    session.dialogData.data = args.data || {};
                    session.dialogData._currentNodeId = args._currentNodeId;
                }
                else {
                    session.dialogData.data = args || {};
                }
                if (this.options.onBeforeProcessingStep)
                    return this.options.onBeforeProcessingStep.call(this, session, args, next);
                else
                    return next();
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
                else
                    return next();
            },
            (session, args, next) => {
                return this.setNextStepHandler(session, args, next);
            },
            (session, args, next) => {
                Logging_1.Log('calling loop function');
                if (typeof session.runGlobalRules == "function") {
                    session.runGlobalRules(session).catch((err) => {
                        if (typeof session.rescheduleGlobalRules == "function") {
                            session.rescheduleGlobalRules(session);
                        }
                        session.replaceDialog(this.internalPath, { data: Object.assign(Object.assign({}, session.dialogData.data), args), _currentNodeId: session.dialogData._currentNodeId });
                    });
                }
                else {
                    if (typeof session.rescheduleGlobalRules == "function") {
                        session.rescheduleGlobalRules(session);
                    }
                    session.replaceDialog(this.internalPath, { data: Object.assign(Object.assign({}, session.dialogData.data), args), _currentNodeId: session.dialogData._currentNodeId });
                }
            }
        ], true);
    }
    checkOrCreateCustomDialogs() {
        if (!this.options.bot.dialog('carouselPrompt')) {
            this.options.bot.dialog('carouselPrompt', [
                (session, args, next) => {
                    if (!session.dialogData.config) {
                        session.dialogData.data = args.data;
                        session.dialogData.config = args.config;
                        let cards = args.config.cards || [];
                        let responses = {};
                        for (let i = 0; i < cards.length; i++) {
                            let card = cards[i];
                            let button = card.data.buttons[0];
                            responses[button.value.trim().toLowerCase()] = { id: card.id, value: button.value };
                            responses[`${i + 1}`] = { id: card.id, value: button.value };
                        }
                        session.dialogData.config.responses = responses;
                        session.send(this.generateCarouselMessage(builder, session, args.config));
                    }
                    else {
                        next();
                    }
                },
                (session, args, next) => {
                    let response = session.message.text.trim().toLowerCase();
                    if (typeof session.dialogData.config.responses != "undefined") {
                        if (typeof session.dialogData.config.responses[response] != "undefined") {
                            for (let card of session.dialogData.config.cards) {
                                if (card.id == session.dialogData.config.responses[response].id) {
                                    var copyOfCard = Object.assign({}, card);
                                    copyOfCard.data.buttons = [];
                                    session.send(this.generateHeroCardMessage(builder, session, card));
                                    session.endDialogWithResult({ 'response': session.dialogData.config.responses[response].value });
                                    return;
                                }
                            }
                            session.send(this.generateCarouselMessage(builder, session, session.dialogData.config));
                            return;
                        }
                        else if (typeof session.dialogData.config.messages != "undefined" && typeof session.dialogData.config.messages['invalid_option']) {
                            session.send(utils.replaceVariables(session.dialogData.config.messages['invalid_option'], session));
                        }
                    }
                }
            ]);
        }
    }
    stepInteractionHandler(session, results, next) {
        if (session.dialogData.__repeat) {
            next(results);
            return;
        }
        session.privateConversationData._lastMessage = session.message && session.message.text;
        let currentNode = this.nav.getCurrentNode(session);
        let skipAfterError = false;
        if (currentNode && currentNode.skipAfterError) {
            skipAfterError = true;
            currentNode.skipAfterError = false;
        }
        Logging_1.Log(`perform action: ${currentNode.id}, ${currentNode.type}`);
        switch (currentNode.type) {
            case Node_1.NodeType.text:
                if (Array.isArray(currentNode.data.text)) {
                    for (let message of currentNode.data.text) {
                        Logging_1.Log(`sending text for node ${currentNode.id}, text: \'${message}\'`);
                        session.send(utils.replaceVariables(message, session));
                    }
                }
                else {
                    var text = currentNode.data.text;
                    Logging_1.Log(`sending text for node ${currentNode.id}, text: \'${text}\'`);
                    session.send(utils.replaceVariables(text, session));
                }
                return next();
            case Node_1.NodeType.prompt:
                Logging_1.Log(`builder.ListStyle.button: ${builder.ListStyle["button"]}`);
                var promptType = currentNode.data.type || 'text';
                builder.Prompts[promptType](session, skipAfterError ? {} : utils.replaceVariables(currentNode.data.text, session), currentNode.data.options, {
                    listStyle: currentNode.data.config && currentNode.data.config.listStyle && builder.ListStyle[currentNode.data.config.listStyle] || builder.ListStyle.button
                });
                break;
            case Node_1.NodeType.score:
                var botModels = currentNode.data.models.map(model => this.nav.models.get(model));
                var score_text = session.dialogData.data[currentNode.data.source] || session.privateConversationData._lastMessage;
                Logging_1.Log(`LUIS scoring for node: ${currentNode.id}, text: \'${score_text}\' LUIS models: ${botModels}`);
                this.intentScorer.collectIntents(botModels, score_text, currentNode.data.threashold)
                    .then(intents => {
                    if (intents && intents.length) {
                        this.stepResultCollectionHandler(session, { response: intents[0] }, next);
                    }
                }, function (err) {
                    throw error;
                });
                break;
            case Node_1.NodeType.handler:
                var handlerName = currentNode.data.name;
                let handler = this.nav.handlers.get(handlerName);
                Logging_1.Log('calling handler: ', currentNode.id, handlerName);
                handler(session, next, currentNode.data);
                break;
            case Node_1.NodeType.sequence:
                return next();
            case Node_1.NodeType.end:
                Logging_1.Log('ending dialog, node:', currentNode.id);
                session.send(currentNode.data.text || 'Bye bye!');
                session.endConversation();
                break;
            case Node_1.NodeType.heroCard:
                session.send(this.generateHeroCardMessage(builder, session, currentNode));
                return next();
            case Node_1.NodeType.carousel:
                session.beginDialog('carouselPrompt', {
                    data: session.dialogData.data,
                    config: currentNode.data
                });
                break;
            default:
                let customHandler = this.customTypeHandlers.get(currentNode.typeName);
                if (customHandler) {
                    Logging_1.Log(`invoking custom node type handler: ${currentNode.typeName}`);
                    return customHandler.execute(session, next, currentNode.data, this);
                }
                var msg = 'Node type ' + currentNode.typeName + ' is not recognized';
                console.error(msg);
                var error = new Error(msg);
                console.error(error);
                throw error;
        }
    }
    generateHeroCard(builder, session, data) {
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
        if ("undefined" != typeof data.images && "undefined" != typeof data.images[0] && data.images.length > 0) {
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
    generateHeroCardMessage(builder, session, node) {
        var hero = this.generateHeroCard(builder, session, node.data);
        return new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([hero]);
    }
    generateCarouselMessage(builder, session, data) {
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
    stepValidationHandler(session, results, next) {
        Logging_1.Log('Validation phase');
        if (session.dialogData.__repeat) {
            Logging_1.Log('Found repeat action value, ignoring phase');
            next(results);
            return;
        }
        let currentNode = this.nav.getCurrentNode(session);
        let varname = currentNode.varname;
        if (!(results.response && varname))
            return next(results);
        if ("undefined" != typeof currentNode.data.validation &&
            currentNode.data.validation instanceof Array) {
            for (let element of currentNode.data.validation) {
                var isValid = Validator_1.Validator.validate(element.type, results.response, element.setup);
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
    stepValueParserHandler(session, results, next) {
        if (session.dialogData.__repeat) {
            Logging_1.Log('Found repeat action value, ignoring phase');
            return next(results);
        }
        let currentNode = this.nav.getCurrentNode(session);
        let varname = currentNode.varname;
        if (!(results.response && varname))
            return next(results);
        if ("undefined" != typeof currentNode.data.valueParser) {
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
                        results.response = ValueParser_1.ValueParser[valueParser](session, results.response, currentNode);
                    }
                }
                catch (e) {
                    Logging_1.ErrorLog('Value Parser phase', e);
                }
            }
        }
        return next(results);
    }
    stepResultCollectionHandler(session, results, next) {
        Logging_1.DebugLog('Result phase', results);
        if (session.dialogData.__repeat) {
            Logging_1.Log('Found repeat action value, ignoring phase');
            return next(results);
        }
        let currentNode = this.nav.getCurrentNode(session);
        let varname = currentNode.varname;
        if (results.assignments instanceof Object) {
            for (let key in results.assignments) {
                if (results.assignments.hasOwnProperty(key)) {
                    session.privateConversationData._vars[key] = results.assignments[key];
                    Logging_1.Log('assigning request for node: %s, variable: %s, value: %s', currentNode.id, key, session.privateConversationData._vars[key]);
                }
            }
        }
        if (results.nextStepId) {
            session.dialogData['_nextStep'] = results.nextStepId;
        }
        if (!(results.response && varname)) {
            return next(results);
        }
        let value = null;
        switch (currentNode.type) {
            case Node_1.NodeType.prompt:
                switch (currentNode.data.type) {
                    case 'choice':
                        value = currentNode.data.options[Object.keys(currentNode.data.options)[results.response.index]];
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
        Logging_1.Log('collecting response for node: %s, variable: %s, value: %s', currentNode.id, varname, session.privateConversationData._vars[varname]);
        for (let additionalVarname of currentNode.additionalVarnames) {
            session.privateConversationData._vars[additionalVarname] = session.privateConversationData._vars[varname];
            Logging_1.Log('collecting response for node: %s, variable: %s, value: %s', currentNode.id, additionalVarname, session.privateConversationData._vars[varname]);
        }
        return next(results);
    }
    setNextStepHandler(session, args, next) {
        let nextNode = null;
        let currentNode = this.nav.getCurrentNode(session);
        if (currentNode && currentNode.id == this.parser.root.id) {
            this.emit(GraphDialog.CHAT_START, session, {
                root: this.parser.root
            });
        }
        if (session.dialogData.__repeat) {
            nextNode = currentNode;
            delete session.dialogData.__repeat;
        }
        else if (currentNode.needValidation) {
            nextNode = currentNode;
            currentNode.needValidation = false;
        }
        else {
            if (session.dialogData['_nextStep']) {
                nextNode = this.nav.getNextNode(session, session.dialogData['_nextStep']);
                if (nextNode && nextNode.id == session.dialogData['_nextStep']) {
                    this.emit(GraphDialog.STEP_OVERRIDE_EVENT, session, {
                        from: Object.assign({}, currentNode),
                        to: Object.assign({}, nextNode)
                    });
                }
            }
            else {
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
            Logging_1.Log(`step handler node: ${nextNode.id}`);
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
            Logging_1.Log('ending dialog');
            this.emit(GraphDialog.CHAT_END_EVENT, session, {
                'root': this.parser.root
            });
            if (session.dialogStack().length > 1) {
                return session.endDialogWithResult(session.dialogData.data);
            }
            else {
                return session.endConversation();
            }
        }
        return next(args);
    }
}
exports.GraphDialog = GraphDialog;
GraphDialog.STEP_START_EVENT = 'step_start';
GraphDialog.STEP_END_EVENT = 'step_end';
GraphDialog.STEP_CHANGE_EVENT = 'step_change';
GraphDialog.STEP_OVERRIDE_EVENT = 'step_override';
GraphDialog.STEP_VALIDATION_FAILED_EVENT = 'step_validation_failed';
GraphDialog.CHAT_START = 'chat_start_event';
GraphDialog.CHAT_END_EVENT = 'chat_end_event';
GraphDialog.VARIABLE_SET_EVENT = 'chat_variable_set';
