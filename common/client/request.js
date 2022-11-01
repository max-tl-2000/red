/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';

export default class Request {
  @observable
  state = 'initial';

  @observable.shallow
  _response;

  defaultResponse = {};

  @observable
  error = null;

  requestCount = 0;

  @computed
  get loading() {
    return this.state === 'fetching';
  }

  @computed
  get success() {
    return this.state === 'success';
  }

  @computed
  get initialOrLoading() {
    const { state, loading } = this;
    return state === 'initial' || loading;
  }

  @action
  async setResult(args) {
    const { fetchId } = args;
    // ignore request that is not current
    if (this.fetchId !== fetchId) return;

    const executeResponse = action(async providedArgs => {
      try {
        await this.onResponse(providedArgs);
      } catch (execError) {
        console.error('executeResponse error: ', execError);
      }
    });

    const providedArgs = { ...args, prevResponse: this._response };

    if (this.onResponse) {
      await executeResponse(providedArgs);
    }

    const { response, state, error } = providedArgs;

    this._setResult(response, state, error);
  }

  @action
  _setResult = (response, state, error) => {
    this._response = response;
    this.state = state;
    this._requestPromise = null;

    if (error) {
      this.error = error;
    }
  };

  @computed
  get response() {
    return this._response || this.defaultResponse;
  }

  /**
   * stores the last payload sent to this request. It stores all the arguments passed to execCall
   */
  @computed
  get lastPayloadSent() {
    return this._lastPayloadSent;
  }

  abort() {
    const { _requestPromise = {} } = this;
    if (_requestPromise.abort) {
      _requestPromise.abort();
    }
  }

  @action
  clearError() {
    this.error = null;
  }

  async doCall(serviceFn, ...args) {
    return serviceFn(...args);
  }

  @action
  async execCall(...args) {
    let fetchId;

    try {
      this.requestCount++;

      fetchId = this.fetchId = `${this.requestCount}`;

      this.state = 'fetching';
      this.error = null;

      if (!this.noClearResponse) {
        this._response = {};
      }

      const { _requestPromise, onAbort } = this;

      if (_requestPromise && _requestPromise.abort) {
        _requestPromise.abort();
        onAbort && onAbort();
      }

      const { call: theCall } = this;

      if (!theCall) {
        throw new Error('"call" method not set');
      }

      if (typeof theCall !== 'function') {
        throw new Error('"call" is expected to be a function. Received', theCall);
      }

      const p = this.doCall(theCall, ...args);

      this._requestPromise = p;
      this._lastPayloadSent = args;

      const response = await p;

      await this.setResult({ response, state: 'success', fetchId, params: args });
    } catch (xhrError) {
      this.onError && this.onError(xhrError);

      if (xhrError.status === 0) {
        // ignore abort errors
        this._setResult(null, 'error', undefined);
        return;
      }

      console.error('error requesting data for', this.fetchId, args, xhrError);
      const error = (xhrError.response || {}).token || (xhrError.resBody || {}).token || xhrError.statusText || xhrError.message || 'UNKNOWN_ERROR';
      await this.setResult({ response: null, state: 'error', fetchId, params: args, error });
    }
  }

  constructor({ call, onResponse, onError, noClearResponse, defaultResponse = {} } = {}) {
    this.call = call;
    this.onResponse = onResponse;
    this.onError = onError;
    this.noClearResponse = noClearResponse;
    this.defaultResponse = defaultResponse;
  }

  static create(...args) {
    return new Request(...args);
  }
}
