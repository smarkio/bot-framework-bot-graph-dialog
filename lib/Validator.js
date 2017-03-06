"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vm = require('vm');
var Validator;
(function (Validator) {
    function validate(type, value, configuration) {
        let result = false;
        switch (type) {
            case 'date':
                result = this.validateDate(value, configuration);
                break;
            case 'regex':
                result = this.validateRegex(value, configuration);
                break;
            case 'function':
                result = this.validateFunction(value, configuration);
                break;
            case 'length':
                result = this.validateLength(value, configuration);
                break;
        }
        return result;
    }
    Validator.validate = validate;
    function validateDate(value, configuration) {
        let date = value.resolution.start.getTime();
        if (configuration.min_date) {
            var dateMin = new Date(configuration.min_date).getTime();
            if (date < dateMin)
                return false;
        }
        if (configuration.max_date) {
            var dateMax = new Date(configuration.max_date).getTime();
            if (date > dateMax)
                return false;
        }
        return true;
    }
    Validator.validateDate = validateDate;
    function validateRegex(value, configuration) {
        var regex = new RegExp(configuration.pattern, configuration.flags || '');
        var isValid = regex.test(value);
        return isValid;
    }
    Validator.validateRegex = validateRegex;
    function validateFunction(value, configuration) {
        var isValid = false;
        try {
            let evaluationSandBox = vm.createContext({ value: value });
            isValid = vm.runInContext(configuration.function, evaluationSandBox);
        }
        catch (error) {
            console.log('Error occurred during evaluation of validation function', error, configuration);
        }
        return isValid;
    }
    Validator.validateFunction = validateFunction;
    function validateLength(value, configuration) {
        if (configuration.min > 0 && value.length < configuration.min) {
            return false;
        }
        if (configuration.max > 0 && value.length > configuration.max) {
            return false;
        }
        return true;
    }
    Validator.validateLength = validateLength;
})(Validator = exports.Validator || (exports.Validator = {}));
