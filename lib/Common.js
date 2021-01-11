"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Map = exports.List = void 0;
class List {
    constructor() {
        this.items = [];
    }
    size() {
        return this.items.length;
    }
    add(value) {
        this.items.push(value);
    }
    get(index) {
        return index < this.size() ? this.items[index] : null;
    }
}
exports.List = List;
class Map {
    constructor() {
        this.items = {};
    }
    add(key, value) {
        this.items[key] = value;
    }
    has(key) {
        return key in this.items;
    }
    get(key) {
        return this.items[key];
    }
    keys() {
        return Object.keys(this.items);
    }
    values() {
        return Object.keys(this.items).map(key => this.items[key]);
    }
}
exports.Map = Map;
