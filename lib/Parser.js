"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Node_1 = require("./Node");
const Scenario_1 = require("./Scenario");
const Luis_1 = require("./Luis");
const Common_1 = require("./Common");
const extend = require("extend");
const Promise = require("bluebird");
const crypto = require("crypto");
const Logging_1 = require("./Logging");
class Parser {
    constructor(options) {
        this.options = options;
        this.uniqueNodeId = 1;
        this.root = null;
        this.version = null;
        this.nodes = new Common_1.Map();
        this.models = new Common_1.Map();
        this.handlers = new Common_1.Map();
    }
    init() {
        return new Promise((resolve, reject) => {
            this.options.loadScenario(this.options.scenario)
                .then((graph) => {
                return this.normalizeGraph(graph).then(() => {
                    return resolve();
                }).catch(e => reject(e));
            })
                .catch(e => {
                console.error(`error loading scenario: ${this.options}: ${e.message}`);
                return reject(e);
            });
        });
    }
    getNodeInstanceById(id) {
        let node = this.nodes[id];
        return (node && node._instance);
    }
    normalizeGraph(origGraph) {
        return new Promise((resolve, reject) => {
            var graph = {};
            extend(true, graph, origGraph);
            Logging_1.Log('loading scenario:', graph.id);
            this.updateModels(graph.models);
            this.recursive(graph).then(() => {
                let nodes = this.nodes;
                for (let nodeId in nodes) {
                    let node = nodes[nodeId];
                    let inst = new Node_1.Node(node, node.type);
                    node._instance = inst;
                }
                for (let nodeId in nodes) {
                    let node = nodes[nodeId];
                    let inst = node._instance;
                    if (node._parent)
                        inst.parent = node._parent._instance;
                    if (node._prev)
                        inst.prev = node._prev._instance;
                    if (node._next)
                        inst.next = node._next._instance;
                    (node.steps || []).forEach((step) => {
                        inst.steps.add(step._instance);
                    });
                    (node.scenarios || []).forEach((scenario) => {
                        let scenarioNode = null;
                        if (scenario.nodeId) {
                            scenarioNode = this.nodes[scenario.nodeId]._instance;
                        }
                        let scene = new Scenario_1.Scenario(scenario.condition, scenarioNode);
                        (scenario.steps || []).forEach((step) => {
                            scene.steps.add(step._instance);
                        });
                        inst.scenarios.add(scene);
                    });
                }
                for (let nodeId in nodes) {
                    let node = nodes[nodeId];
                    let inst = node._instance;
                    delete node._visited;
                    delete node._parent;
                    delete node._prev;
                    delete node._next;
                }
                this.root = graph._instance;
                this.version = graph.version || this.calculateHash(JSON.stringify(origGraph));
                return resolve();
            }).catch(e => reject(e));
        });
    }
    initNode(parent, nodes, nodeItem, index) {
        if (nodeItem._visited)
            return Promise.resolve();
        nodeItem._visited = true;
        if (!nodeItem.id) {
            nodeItem.id = '_node_' + (this.uniqueNodeId++);
        }
        if (parent)
            nodeItem._parent = parent;
        if (index > 0)
            nodeItem._prev = nodes[index - 1];
        if (nodes.length > index + 1)
            nodeItem._next = nodes[index + 1];
        if (this.isSubScenario(nodeItem)) {
            Logging_1.Log(`sub-scenario for node: ${nodeItem.id} [embedding sub scenario: ${nodeItem.subScenario}]`);
            return new Promise((resolve, reject) => {
                this.options.loadScenario(nodeItem.subScenario)
                    .then(scenarioObj => {
                    extend(true, nodeItem, scenarioObj);
                    this.updateModels(scenarioObj.models);
                    Logging_1.Log('node:', nodeItem.id, nodeItem._parent && nodeItem._parent.id ? '[parent: ' + nodeItem._parent.id + ']' : '', nodeItem._next && nodeItem._next.id ? '[next: ' + nodeItem._next.id + ']' : '', nodeItem._prev && nodeItem._prev.id ? '[prev: ' + nodeItem._prev.id + ']' : '');
                    return this.recursive(nodeItem).then(() => {
                        return resolve();
                    }).catch(e => reject(e));
                }).catch(e => reject(e));
            });
        }
        else if (nodeItem.type === 'handler') {
            var handler = nodeItem.data.name || '';
            Logging_1.Log(`loading handler for node: ${nodeItem.id} [embedding sub scenario: ${handler}]`);
            if (nodeItem.data.js) {
                var content = nodeItem.data.js;
                if (Array.isArray(content))
                    content = content.join('\n');
                var func = this.getHandlerFunc(content);
                if (!func) {
                    console.error(`error loading handler ${handler}`);
                }
                this.handlers.add(handler, func);
            }
            else {
                return new Promise((resolve, reject) => {
                    this.options.loadHandler(handler)
                        .then(text => {
                        var func = this.getHandlerFunc(text);
                        if (!func) {
                            console.error(`error loading handler ${handler}`);
                            return reject(new Error(`error loading handler ${handler}`));
                        }
                        this.handlers.add(handler, func);
                        Logging_1.Log('node:', nodeItem.id, nodeItem._parent && nodeItem._parent.id ? '[parent: ' + nodeItem._parent.id + ']' : '', nodeItem._next && nodeItem._next.id ? '[next: ' + nodeItem._next.id + ']' : '', nodeItem._prev && nodeItem._prev.id ? '[prev: ' + nodeItem._prev.id + ']' : '', nodeItem.type ? '[type: ' + nodeItem.type + ']' : '', nodeItem.typeName ? '[typeName: ' + nodeItem.type + ']' : '');
                        return this.recursive(nodeItem).then(() => {
                            return resolve();
                        }).catch(e => reject(e));
                    }).catch(e => reject(e));
                });
            }
        }
        Logging_1.Log('node:', nodeItem.id, nodeItem._parent && nodeItem._parent.id ? '[parent: ' + nodeItem._parent.id + ']' : '', nodeItem._next && nodeItem._next.id ? '[next: ' + nodeItem._next.id + ']' : '', nodeItem._prev && nodeItem._prev.id ? '[prev: ' + nodeItem._prev.id + ']' : '', nodeItem.type ? '[type: ' + nodeItem.type + ']' : '', nodeItem.typeName ? '[typeName: ' + nodeItem.type + ']' : '');
        return this.recursive(nodeItem);
    }
    initNodes(parent, nodes) {
        return Promise.all((nodes || []).map((item, index) => this.initNode(parent, nodes, item, index)));
    }
    recursive(node) {
        return new Promise((resolve, reject) => {
            if (!node.id) {
                node.id = '_node_' + (this.uniqueNodeId++);
            }
            this.initNodes(node, node.steps).then(() => {
                var promises = (node.scenarios || []).map(scenario => this.initNodes(node, scenario.steps));
                return Promise.all(promises).then(() => {
                    if (node.type === 'sequence') {
                        return this.initNodes(node, node.steps).then(() => {
                            this.nodes[node.id] = node;
                            return resolve();
                        }).catch(e => reject(e));
                    }
                    else {
                        this.nodes[node.id] = node;
                        return resolve();
                    }
                }).catch(e => reject(e));
            }).catch(e => reject(e));
        });
    }
    isSubScenario(nodeItem) {
        if (!nodeItem.subScenario)
            return false;
        var parent = nodeItem._parent;
        while (parent) {
            if (nodeItem.subScenario === parent.id) {
                console.error('recursive subScenario found: ', nodeItem.subScenario);
                throw new Error('recursive subScenario found ' + nodeItem.subScenario);
            }
            parent = parent._parent;
        }
        return true;
    }
    getHandlerFunc(funcText) {
        let text = `(function(){
                  return function(module) { 
                    ${funcText}
                  }
                  })()
                `;
        var wrapperFunc = eval(text);
        var m = {};
        wrapperFunc(m);
        return typeof m.exports === 'function' ? m.exports : null;
    }
    updateModels(models) {
        (models || []).forEach(model => {
            this.models.add(model.name, new Luis_1.LuisModel(model.name, model.url));
        });
    }
    calculateHash(text) {
        return crypto.createHash('md5').update(text).digest('hex');
    }
}
exports.Parser = Parser;
