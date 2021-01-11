"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentScorer = void 0;
const request = require("request-promise");
const Promise = require("bluebird");
const _ = require("underscore");
class IntentScorer {
    collectIntents(models, text, threashold = 0) {
        let promises = models.map(model => {
            return this.scoreIntent(model, text, threashold);
        });
        return new Promise(function (resolve, reject) {
            if (!models)
                return reject('Please provide models array');
            if (!text)
                return reject('Please provide text');
            Promise.all(promises)
                .then(intents => {
                var sortedIntents = _.sortBy(_.compact(intents), 'score').reverse();
                resolve(sortedIntents);
            })
                .catch(reject);
        });
    }
    scoreIntent(model, text, threashold = 0) {
        return new Promise(function (resolve, reject) {
            return request(model.url + encodeURIComponent(text))
                .then(result => {
                let json = JSON.parse(result);
                if (!json || !json.intents || !json.intents.length)
                    return resolve();
                if (json.intents[0].score < threashold)
                    return resolve();
                let intent = json.intents[0];
                intent.entities = json.entities;
                intent.model = model.name;
                return resolve(intent);
            })
                .catch(reject);
        });
    }
}
exports.IntentScorer = IntentScorer;
