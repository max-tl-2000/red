/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';
import { logger } from '../../../common/client/logger';

export interface IMobxRequestArgs<ResponseType> {
  call: any; // this should be a fn signature
  onResponse?: any; // this should be a fn signature
  onError?: any; // this should be a fn signature
  noClearResponse?: boolean;
  defaultResponse?: ResponseType;
}

export class MobxRequest<ResponseType> {
  fetchId: string = '';

  _requestPromise: any;

  onResponse: any;

  onError: any;

  call: any;

  _lastPayloadSent: any;

  onAbort: any;

  @observable
  state = 'initial';

  @observable.shallow
  _response?: ResponseType;

  defaultResponse?: ResponseType;

  @observable
  error = null;

  requestCount = 0;

  noClearResponse: boolean = false;

  @observable
  downloadProgress = 0;

  @observable
  uploadProgress = 0;

  @action
  resetUploadProgress() {
    this.uploadProgress = 0;
  }

  @action
  resetDownloadProgress() {
    this.downloadProgress = 0;
  }

  @action
  resetProgressReport() {
    this.resetUploadProgress();
    this.resetDownloadProgress();
  }

  @computed
  get uploadComplete() {
    return this.uploadProgress === 100;
  }

  @computed
  get downloadComplete() {
    return this.downloadProgress === 100;
  }

  @action
  reportUploadProgress = args => {
    this.uploadProgress = args.percentage;
  };

  @action
  reportDownloadProgress = args => {
    this.downloadProgress = args.percentage;
  };

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
  setResponse = (response: any) => {
    this._setResult(response, 'success', null);
  };

  @action
  clearResponse = () => {
    this._setResult(undefined, 'initial', null);
  };

  @action
  async setResult(args: any) {
    const { fetchId } = args;
    // ignore request that is not current
    if (this.fetchId !== fetchId) return;

    const executeResponse = action(async (providedArgs: any) => {
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
  _setResult = (response: any, state: string, error: any) => {
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

  @action
  doCall(serviceFn: any, ...args: any[]) {
    return serviceFn(...args);
  }

  @action
  async _handleError(responseError: any, fetchId: any, args: any) {
    const { sender } = responseError;
    if (sender?.status === 0) {
      // ignore abort errors
      this._setResult(null, 'error', undefined);
      return;
    }

    console.error('error requesting data for', this.fetchId, args, responseError);
    const error = sender?.response?.token || sender?.statusText || responseError || 'UNKNOWN_ERROR';
    await this.setResult({ response: null, state: 'error', fetchId, params: args, error });
  }

  @action
  async execCall(...args: any[]) {
    let fetchId;

    try {
      this.requestCount++;

      fetchId = this.fetchId = `${this.requestCount}`;

      this.state = 'fetching';
      this.error = null;

      if (!this.noClearResponse) {
        this._response = {} as ResponseType;
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
        throw new Error(`"call" is expected to be a function. Received ${theCall}`);
      }

      const p = this.doCall(theCall, ...args);

      this.resetProgressReport();

      p.onUploadProgress = this.reportUploadProgress;
      p.onDownloadProgress = this.reportDownloadProgress;

      this._requestPromise = p;
      this._lastPayloadSent = args;

      p?.catch?.(xhrError => {
        this._handleError(xhrError, fetchId, args);
      });
      const response = await p;

      await this.setResult({ response, state: 'success', fetchId, params: args });
    } catch (xhrError) {
      // Log the XhrError object on a failed request for debugging purposes
      logger.error('XhrError', xhrError);
      await this._handleError(xhrError, fetchId, args);
    }
  }

  constructor(opts: IMobxRequestArgs<ResponseType>) {
    const { call, onResponse, onError, noClearResponse = false, defaultResponse } = opts;
    if (!call) {
      throw new Error('"call" parameter should be defined');
    }
    this.call = call;
    this.onResponse = onResponse;
    this.onError = onError;
    this.noClearResponse = noClearResponse;
    this.defaultResponse = defaultResponse;
  }
}
