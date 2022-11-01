/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import trim from 'helpers/trim';
import clsc from 'helpers/coalescy';

export default class MultiTextModel {
  @observable
  _error = '';

  @observable
  value;

  @observable
  id;

  constructor({ value, id, validateFn, defaultError, error }) {
    this.value = value;
    this.id = id;
    this.validateFn = validateFn;
    this.defaultError = defaultError;
    this._error = error;
  }

  @computed
  get valid() {
    return !trim(this._error);
  }

  @computed
  get error() {
    return this._error;
  }

  _doValidate(value, items) {
    // We need a promise that always resolve
    // The error case will be treated as especial
    // case where an error was provided to the resolve
    // method
    return new Promise(resolve => {
      const p = Promise.resolve(this.validateFn(value, items));
      p.then(data => {
        resolve(clsc(data, {}));
      });
      p.catch(err => {
        resolve(clsc(err, {}));
      });
    });
  }

  @action
  async validate(items) {
    if (typeof this.validateFn !== 'function' || !this.value) {
      this.clearError();
      return;
    }

    const res = await this._doValidate(this.value, items);

    // if we specifically said it fail setting a boolean
    if (res === false) {
      this._error = this.defaultError;
      return;
    }

    const error = res.error || res.message;
    // if we provided an error or threw
    // an error inside the async method
    if (error) {
      this._error = error;
      return;
    }

    // no error so clear any previous message
    this.clearError();

    // otherwise we just assumed it was true
  }

  @action
  clearError() {
    this._error = '';
  }

  @action
  updateValue(value) {
    this.value = value;
    this.clearError();
  }

  @computed
  get serialized() {
    return { value: this.value, id: this.id, error: this._error };
  }
}
