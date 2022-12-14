/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, extendObservable, action, toJS } from 'mobx';
import clsc from '../../../common/helpers/coalescy';
import { isString } from '../../../common/helpers/type-of';
import trim from '../../../common/helpers/trim';
import Field from './Field';

/**
 * a helper class to generate a dynamic form
 * provided some keys and validators descriptors
 *
 * @export
 * @class FormModel
 */
export class FormModel {
  // TODO: what would be a better name for this??
  // I'm not convinced, but I guess this is good enough for now
  @computed
  get dataIsReady() {
    return this.interacted && this.requiredAreFilled && this.valid;
  }

  @computed
  get requiredFields() {
    const keys = Object.keys(this.fields);
    return keys.filter(key => this.fields[key].required);
  }

  @computed
  get requiredAreFilled() {
    const keys = Object.keys(this.fields);
    return keys.every(key => {
      const field = this.fields[key];
      if (field.required) {
        return !!field.hasValue;
      }
      return true;
    });
  }

  @computed
  get atLeastOneRequiredIsFilled() {
    return this.requiredFields.some(key => !!this.fields[key].hasValue);
  }

  // the fields of the form
  @observable
  fields = {};

  // whether or not the there is a validation
  // process running
  @observable
  _validating = false;

  // flag to indicate whether the form is valid or not
  // since some of the validators might be async validators
  // this value might be false until the validation process finish
  @computed
  get valid() {
    if (this._validating) {
      return false; // consider the form invalid until the validation process finish
    }
    const keys = Object.keys(this.fields);
    return keys.every(key => {
      const field = this.fields[key];
      return !!field.valid;
    });
  }

  /**
   * whether or not the form has been "interacted", meaning that at
   * least a value has set on any of the fields after the model
   * has been created
   */
  @computed
  get interacted() {
    const keys = this._fieldKeys();
    return keys.some(key => {
      const field = this.fields[key];
      return !!field.interacted;
    });
  }

  /**
   * Restore the initial values set at the creation time of the model
   * */
  @action
  restoreInitialValues() {
    this._eachField(field => field.restoreInitialValue());
  }

  /**
   * Set multiple values to more than one field a time using an object
   * where each key is the name of a field. The value will be set to each
   * field and from that point on the values set are considered the new
   * initial values. Validation and interacted flags are also reset if the second argument is true
   * */
  @action
  updateFrom(obj, reset = true) {
    Object.keys(obj).forEach(key => this.updateField(key, obj[key], reset));
  }

  /**
   * return the value of the field which name is provided. Aditionally a
   * default value can be provided.
   * */
  valueOf(name, defaultValue) {
    return clsc(this._getField(name).value, defaultValue);
  }

  /**
   * return the errorMessage of the field which name is provided.
   * */
  errorOf(name) {
    return this._getField(name).errorMessage;
  }

  /**
   * return the array of errors found. The array is an Array<String>
   * */
  @computed
  get summary() {
    return this._fieldKeys().reduce((seq, key) => {
      const field = this.fields[key];
      if (field.errorMessage) {
        seq.push(field.errorMessage);
      }
      return seq;
    }, []);
  }

  /**
   * Manually perform the form validation
   * */
  @action
  async validate(validateField = true) {
    this.validating = true;

    await Promise.all(
      this._fieldKeys().map(key => {
        const field = this.fields[key];
        return Promise.resolve(field.validate(validateField));
      }),
    );

    this.validating = false;
  }

  /**
   * Update the value of the field identified by the provided name.
   * Optionally if reset is set to true, interacted and
   * errorMessage are cleared in the Field.
   * */
  @action
  updateField(name, value, reset) {
    const theField = this._getField(name);

    theField.setValue(value, reset);
  }

  /**
   * return the data as plain Javascript object (mobx magic removed from the fields)
   * */
  @computed
  get serializedData() {
    const keys = Object.keys(this.fields);
    return toJS(
      keys.reduce((seq, key) => {
        const field = this.fields[key];
        // this is required to make sure forms that use the serializedData object
        // have the values without leading or trailing spaces
        seq[key] = isString(field.value) ? trim(field.value) : field.value;
        return seq;
      }, {}),
    );
  }

  /**
   * Creates an instance of FormModel.
   *
   * @param {Object} [initialState={}]
   * @param {Object} [validators={}]
   *
   * initialState => an object which keys are the names of the fields and the values the initial values for the form.
   * validators => an object which keys are the names of the fields and the values are the descriptors for the validators
   * @example:
   *
   * ```
   * {
   *   fieldName: {
   *     errorMessage: String,
   *     validationType: VALIDATION_TYPES, // REQUIRED, EMAIL, DATE, PHONE or NUMBER.
   *     fn: Function, // custom validator function
   *   }
   * }
   * ```
   */
  constructor(initialState = {}, validators = {}) {
    const keys = Object.keys(initialState);

    keys.forEach(key => {
      extendObservable(this.fields, {
        [key]: new Field(this, initialState[key], validators[key], key),
      });
    });
  }

  _getField(name) {
    const theField = this.fields[name];
    if (!theField) {
      throw new Error(`Field "${name}" not found`);
    }
    return theField;
  }

  _eachField(cb) {
    Object.keys(this.fields).forEach(key => cb(this.fields[key]));
  }

  _fieldKeys() {
    return Object.keys(this.fields);
  }

  @action
  resetInteractedFlag() {
    this._eachField(field => field.resetInteractedFlag());
  }

  @action
  disableFields(fieldKeys = []) {
    fieldKeys.forEach(key => {
      const field = this.fields[key];
      if (!field) {
        throw new Error(`FormModel: Field ${key} not found`);
      }
      field.setDisabled(true);
    });
  }

  @action
  enableFields(fieldKeys = []) {
    fieldKeys.forEach(key => {
      const field = this.fields[key];
      if (!field) {
        throw new Error(`FormModel: Field ${key} not found`);
      }
      field.setDisabled(false);
    });
  }
}

/**
 * return an instance of a FormModel refer to the constructor
 *
 * @param {Object} initialState
 * @param {Object} _validators
 */
export const createModel = (initialState, _validators) => new FormModel(initialState, _validators);
