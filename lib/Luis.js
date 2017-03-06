"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class LuisModel {
    constructor(name, url) {
        this.name = name;
        this.url = url;
    }
}
exports.LuisModel = LuisModel;
class IntentScore {
    constructor(name, model, score) {
        this.name = name;
        this.model = model;
        this.score = score;
    }
}
exports.IntentScore = IntentScore;
