/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, isObservableArray, action } from 'mobx';
import debounce from 'debouncy';
import clsc from '../../../common/helpers/coalescy';
import typeOf from '../../../common/helpers/type-of';
import { validate as genericValidation } from './Validation';

/**
 * Field class provides abstract the validation of a single field
 */

export default class Field {
  @computed
  get waitForBlur() {
    return this._waitForFirstBlur;
  }

  @observable
  disabled;

  @observable
  _required;

  @computed
  get required() {
    if (this.disabled) return false;
    // if this._required is a function we evaluate it
    // to find if the field needs to be considered required
    return typeof this._required === 'function' ? this._required({ field: this, fields: this.model.fields }) : !!this._required;
  }

  @action
  resetInteractedFlag() {
    this._interacted = false;
  }

  @computed
  get notEmpty() {
    if (this.disabled) return false;
    if (typeof this.value !== 'string') return true;

    if (this.hasValue && this.value.toString().trim() !== '') {
      return true;
    }
    return false;
  }

  @computed
  get hasValue() {
    if (this._hasValue) {
      return this._hasValue(this.value);
    }
    // consider the case where the value is an array
    // we consider it actually has a value if the value is defined
    // and the array is not empy
    if (Array.isArray(this.value)) {
      return this.value.length > 0;
    }
    return !!this.value;
  }

  /**
   * field to store the initial value set on this field
   * */
  _initialValue;

  /**
   * the value of the field
   * */
  @observable
  _value;

  /**
   * whether the user interacted with the field
   * this means if there is any value set on the field
   * either setting it using the `setValue` or using
   * the setter `value`. This is useful to know if
   * the user has interacted with teh form in any way
   */
  @observable
  _interacted;

  /**
   * whether the field was blurred at least once
   * usually validators should only start being applied
   * after the first blur, otherwise they become
   * too invasive. This flag be used to keep track of
   * the fact that the user already blurred of a field
   */
  @observable
  _blurredOnce = false;

  /**
   * the error message associated with this field.
   * This is used to indicate what error happened during
   * the validation process
   */
  @observable
  errorMessage;

  /**
   * whether the validation should be launch after a
   * new value is set in the field. This is usually associated
   * to forms that set the value on the fields after each
   * onChange event
   */
  @observable
  interactive = true;

  /**
   * wheter validation should be skipped
   * this is used to set new original
   * values on the model
   */
  _skipValidation = false;

  /**
   * used to keep track of the original message
   */
  _originalErrorMessage;

  /**
   * whether the field is valid or not
   */
  @computed
  get valid() {
    return !this.errorMessage;
  }

  /**
   * whether the user has interacted or not with the field
   */
  @computed
  get interacted() {
    return this._interacted;
  }

  /**
   * get the value set on the field
   */
  get value() {
    if (isObservableArray(this._value)) {
      return [].slice.call(this._value);
    }
    return this._value;
  }

  @action
  _setValue(val) {
    if (!this._interacted) {
      this._interacted = true;
    }

    if (this._value === val) {
      return;
    }

    this._value = val;

    if (this._skipValidation) {
      return;
    }

    if (this.interactive) {
      this._debouncedValidation();
    } else {
      this.clearValidation();
    }
  }

  /**
   * setter for the value of the field
   */
  set value(val) {
    this._setValue(val);
  }

  /**
   * set the value of the field, optionaly
   * reset the errorMessage and interacted flags
   *
   * @param {any} value
   * @param {Boolean} reset
   *
   */
  @action
  setValue(value, reset) {
    if (reset) {
      this._skipValidation = true;
    }

    this._setValue(value);

    if (reset) {
      this.errorMessage = '';
      this._interacted = false;
      this._skipValidation = false;
    }
  }

  @action
  replaceValue(value, reset) {
    this.setValue(value, reset);
    this._initialValue = value;
  }

  /**
   * Restore the initial value of the field
   */
  @action
  restoreInitialValue() {
    this.setValue(this._initialValue, true);
  }

  /**
   * clear the valid state of the field by
   * removing the errorMessage string. A field is
   * considered valid if the errorMessage is not empty
   */
  @action
  clearValidation() {
    this.errorMessage = '';
  }

  /**
   * mark the field as already blurred so validation can
   * start to be applied to  the field.
   */
  @action
  markBlurredAndValidate = () => {
    if (!this._blurredOnce) {
      this._blurredOnce = true;
    }

    this.validate();
  };

  @action
  _validateAndProcess() {
    if (!Array.isArray(this._validationType) && !this._validationType) {
      return this._validateCustomRules();
    }

    const genericValidations = !Array.isArray(this._validationType) ? [this._validationType] : this._validationType;

    let errorMessage = '';
    // finding the first failed validation:
    // validationType schema: (string or array of validation types)
    // string: validation type, it is a short hand
    // array: [{ type: [validation type], errorMessage: [error message] args: [additional arguments to pass like date format] }]
    const failedValidation = genericValidations.find(validation => {
      const validationIsString = typeOf(validation) === 'string';
      const type = validationIsString ? validation : validation.type;

      const result = genericValidation(this, type, validationIsString ? {} : validation);
      errorMessage = result.errorToken;
      return !result.isValid;
    });

    if (!failedValidation) {
      return this._validateCustomRules();
    }

    return {
      error: clsc(errorMessage, failedValidation.errorMessage, this._originalErrorMessage),
    };
  }

  @action
  _validateCustomRules() {
    return !this._validateFn || this._validateFn(this, this.model.fields);
  }

  @action
  setDisabled(disabled) {
    if (disabled) {
      this.errorMessage = '';
    }
    this.disabled = disabled;
  }

  @action
  _doValidate = async () => await this._validateAndProcess();

  /**
   * validate the field. If force is true the validation will be perform
   * even if the field was not initially interacted or blurred
   *
   * @param {boolean} [force=false]
   */
  @action
  validate(force = false) {
    const required = this.required;

    const shouldSkipValidation = (!required && !this._validateFn && !this._validationType) || this.disabled;

    if (shouldSkipValidation) return;

    if (!force) {
      const userDidntInteractWithTheField = !this._interacted || (this._waitForFirstBlur && !this._blurredOnce);

      if (userDidntInteractWithTheField) {
        // if we're not forcing the validation
        // and we haven't interacted with the field
        // we asume this field pass the validation status
        this.errorMessage = '';
        return;
      }
    }

    if (required) {
      if (!this.hasValue) {
        // we can indicate that the field is required by passing the error message as the value of
        // the required field. If we pass a boolean or a function then the value of the error message
        // can be set in the requiredMessage field of the validator descriptor
        this.errorMessage = typeof this._required === 'string' ? this._required : this._requiredMessage || 'Required';
        return;
      }
      this.errorMessage = '';
    }

    if (required && !this.notEmpty) {
      this.errorMessage = this._notEmptyMessage ? this._notEmptyMessage : 'Required';
      return;
    }

    const res = this._doValidate();

    // eslint-disable-next-line consistent-return
    return new Promise(resolve => {
      res.then(
        res_ => {
          // if the function returned a boolean we assume it is
          // the flag for the valid state
          if (typeof res_ === 'boolean') {
            this.errorMessage = res_ ? '' : this._originalErrorMessage;
            resolve();
            return;
          }

          if (res_ && res_.error) {
            this.errorMessage = res_.error;
            resolve();
            return;
          }

          this.errorMessage = '';
          resolve(); // we use this to chain validators
        },
        (errorArg = {}) => {
          const { error, message } = errorArg;
          this.errorMessage = (error || message || '').trim() || this._originalErrorMessage;
          resolve(); // we use this to chain validators
        },
      );
    });
  }

  constructor(model, value, validatorDescriptor = {}, fieldName) {
    this.model = model;
    this.name = fieldName;
    this._waitForFirstBlur = validatorDescriptor.waitForBlur;
    this._originalErrorMessage = validatorDescriptor.errorMessage;
    this._validationType = validatorDescriptor.validationType || '';
    this._validateFn = validatorDescriptor.fn || (() => Promise.resolve());
    this._debouncedValidation = debounce(this.validate, 300, this);
    this._initialValue = value;
    this._notEmpty = validatorDescriptor.notEmpty;
    this._notEmptyMessage = validatorDescriptor.notEmptyMessage;

    // useful to determine if the field has a value set
    // only used if provided
    this._hasValue = validatorDescriptor.hasValue;

    this._value = value;
    this._required = validatorDescriptor.required;
    this._requiredMessage = validatorDescriptor.requiredMessage;
    this.interactive = clsc(validatorDescriptor.interactive, true);
  }
}
