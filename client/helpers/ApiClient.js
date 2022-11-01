/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import superagent from 'superagent';
import dispatcher from 'dispatchy';
import extend from 'extend';
import Immutable from 'immutable';
import { deferred } from 'helpers/deferred';

export default class ApiClient {
  constructor() {
    this.counter = 0;
    this.uploadRequestMap = new Immutable.Map({});

    extend(this, dispatcher.create());

    ['get', 'post', 'put', 'patch', 'del'].forEach(method => {
      this[method] = (path, methodArgs) => {
        const { noPrefix, reqId, ...options } = methodArgs || {};
        this.counter++;

        const args = {
          id: `${Date.now()}_${this.counter}`,
          resource: `${method}_${path}`,
          method,
          path,
        };

        this.fire('request:start', args);

        const methodPromise = deferred();
        const resourcePath = noPrefix ? path : this.formatUrl(path);
        const request = superagent[method](resourcePath);

        if (options && options.params) {
          request.query(options.params);
        }

        request.set({ 'X-Request-Id': reqId || v4() });

        if (this.headers) {
          request.set(this.headers);
        }

        if (options && options.headers) {
          request.set(options.headers);
        }

        const date = new Date();
        const localTimeInSeconds = date.getTime() / 1000;
        const isTokenExpired = this.tokenExpirationTime && localTimeInSeconds > this.tokenExpirationTime;

        if (isTokenExpired) {
          this.fire('service:error', { response: {}, err: {}, path: resourcePath, unauthorized: true });
          return Promise.reject(new Error('expired jwt token'));
        }

        if (options && options.data) {
          request.send(options.data);
        }

        request.end((err, res) => {
          if (err) {
            if (!res) {
              // adding this for debugging purposes
              // need to find what is calling this during unit tests
              console.trace('API_CLIENT_ERROR_WITHOUT_RESPONSE:', resourcePath, err);
            }

            const rejectArgs = (res && res.body) || err || {};
            methodPromise.reject({ ...rejectArgs, resBody: res && res.body, status: res && res.status });
            const THRESHOLD_TO_ATTACH_CATCH_HANDLED = 300;

            // setTimeout is needed because we want this to be the last
            // catch to be attached hence it will be the last one to be
            // executed given it the opportunity to read if some catch
            // handler set the __handled flag to true
            setTimeout(() => {
              methodPromise.catch(rArgs => {
                const { __handled, __stopRedirect } = rArgs;

                // will this ever happen? some tests were failing due to this check
                // http://ci.corp.reva.tech/job/Red%20PR%20-%20Unit%20Tests%20and%20Build/12998/consoleFull
                const { status } = res || {};

                const unauthorized = status === 401;
                const forbidden = status === 403;

                // Forbidden and unauthorized will be handled in this task:
                // https://redisrupt.atlassian.net/browse/CPM-9655
                if (__handled && __stopRedirect) return;
                if (__handled && !unauthorized && !forbidden) return;

                this.fire('service:error', { response: res, path: resourcePath, err, unauthorized, forbidden });
              });
            }, THRESHOLD_TO_ATTACH_CATCH_HANDLED);
          } else {
            methodPromise.resolve(res.body);
          }
        });

        methodPromise.then(
          () => this.fire('request:end', args),
          errResponse => this.fire('request:end', { ...args, error: true, errResponse }),
        );
        methodPromise.abort = () => request.abort();

        return methodPromise;
      };
    });
  }

  abortUpload(requestId) {
    if (this.uploadRequestMap.has(requestId)) {
      this.uploadRequestMap.get(requestId).abort();
      this.uploadRequestMap = this.uploadRequestMap.delete(requestId);
    }
  }

  clearHeaders() {
    this.headers = null;
  }

  setExtraHeaders(headers) {
    this.headers = {
      ...this.headers,
      ...headers,
    };
  }

  setHeader(key, value) {
    if (!this.headers) {
      this.headers = {};
    }
    this.headers[key] = value;
  }

  removeHeader(key) {
    if (!this.headers) return;

    delete this.headers[key];
  }

  upload(path, formData, settings) {
    this.counter++;

    const args = {
      id: (settings && settings.requestId) || `${Date.now()}_${this.counter}`,
      resource: `post_${path}`,
      method: 'post',
      path,
    };

    this.fire('request:start', args);
    const uploadPromise = new Promise((resolve, reject) => {
      const request = superagent.post(this.formatUrl(path)).send(formData);

      this.uploadRequestMap = this.uploadRequestMap.set(args.id, request);
      if (this.headers) {
        request.set(this.headers);
      }

      if (settings && settings.reportProgress) {
        request.on('progress', e => {
          this.fire('request:progress', { ...args, percent: e.percent });
        });
      }

      request.end((err, res) => {
        this.uploadRequestMap = this.uploadRequestMap.delete(args.id);
        if (err) {
          reject((res && res.body) || err);
        } else {
          resolve(res.body);
        }
      });
    });

    uploadPromise.then(() => this.fire('request:end', args)).catch(error => this.fire('request:end', { ...args, error }));

    return uploadPromise;
  }

  formatUrl(path) {
    const adjustedPath = path[0] !== '/' ? `/${path}` : path;
    // Prepend `/api` to relative URL, to proxy to API server.
    return `/api${adjustedPath}`;
  }
}
