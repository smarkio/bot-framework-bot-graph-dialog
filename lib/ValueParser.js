"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ValueParser;
(function (ValueParser) {
    function time(session, value) {
        value.entity = value.resolution.start.getHours() + ':' +
            ("0" + value.resolution.start.getMinutes()).substr(-2) + ':' +
            ("0" + value.resolution.start.getSeconds()).substr(-2);
        return value;
    }
    ValueParser.time = time;
    function date(session, value) {
        value.entity = value.resolution.start.getFullYear() + '-' +
            ("0" + (1 + value.resolution.start.getMonth())).substr(-2) + '-' +
            ("0" + value.resolution.start.getDate()).substr(-2);
        return value;
    }
    ValueParser.date = date;
    function email(session, value) {
        let result = null;
        if ((session.message.source == 'slack' &&
            (result = /^<mailto:(.*)\|.*>$/.exec(value)) != null) ||
            (session.message.source == 'skype' &&
                (result = /^<a\s+href="mailto:(.+)">.*$/.exec(value)) != null)) {
            return result[1];
        }
        return value;
    }
    ValueParser.email = email;
    function trim(session, value) {
        if (typeof value === "string") {
            return value.trim();
        }
        return value;
    }
    ValueParser.trim = trim;
})(ValueParser = exports.ValueParser || (exports.ValueParser = {}));
class CustomValueParser {
    constructor(name, parse) {
        this.name = name;
        this.parse = parse;
    }
}
exports.CustomValueParser = CustomValueParser;
