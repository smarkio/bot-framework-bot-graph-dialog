const vm = require('vm');

export module Validator {

  /**
   * Validates a value against given type rule
   *
   * @param {string} type
   * @param {string} value
   * @param {Object} configuration
   */
  export function validate(type: string, value: string | Date, configuration: any): any {

    let result = false;

    switch (type) {
      // @TODO: maybe enum this..
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

  /**
   *
   * @param value
   * @param configuration
   * @returns {boolean}
   */
  export function validateDate(value: any, configuration: any): boolean {

    let date = value.resolution.start.getTime();

    if (configuration.min_date) {
      var dateMin = new Date(configuration.min_date).getTime();
      if (date < dateMin) return false;
    }

    if (configuration.max_date) {
      var dateMax = new Date(configuration.max_date).getTime();
      if (date > dateMax) return false;
    }

    return true;

  }

  /**
   *
   * @param value
   * @param configuration
   * @returns {boolean}
   */
  export function validateRegex(value: string, configuration: any): boolean {


    var regex = new RegExp(configuration.pattern, configuration.flags || '');
    var isValid = regex.test(value);
    return isValid;

  }

  /**
   *
   * @param value
   * @param configuration
   * @returns {boolean}
   */
  export function validateFunction(value: string, configuration: any): boolean {

    var isValid = false;
    try {
      let evaluationSandBox = vm.createContext({ value: value });
      isValid = vm.runInContext(configuration.function,evaluationSandBox);
    } catch (error) {
      console.log('Error occurred during evaluation of validation function', error, configuration);
    }
    return isValid;

  }

  /**
   *
   * @param value
   * @param configuration
   * @returns {boolean}
   */
  export function validateLength(value: string, configuration: any): boolean {

    if (configuration.min > 0 && value.length < configuration.min) {
      return false;
    }

    if (configuration.max > 0 && value.length > configuration.max) {
      return false;
    }

    return true;

  }

}