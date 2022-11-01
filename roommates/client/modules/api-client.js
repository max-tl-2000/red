/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import superagent from 'superagent';
import extend from 'extend';
import dispatcher from 'dispatchy';
import { deferred } from '../../../common/helpers/deferred';

const formatUrl = path => {
  const adjustedPath = path[0] !== '/' ? `/${path}` : path;
  // Prepend `/api` to relative URL, to proxy to API server.
  return `/api${adjustedPath}`;
};

const apiClient = {
  clearHeaders() {
    this.headers = null;
  },
  setExtraHeaders(headers) {
    this.headers = {
      ...this.headers,
      ...headers,
    };
  },
};

['get', 'post', 'put', 'patch', 'del'].reduce((acc, method) => {
  acc[method] = (path, options) => {
    const requestPromise = deferred();

    const request = superagent[method](formatUrl(path));

    if (options && options.params) {
      request.query(options.params);
    }

    if (acc.headers) {
      request.set(acc.headers);
    }

    if (options && options.data) {
      request.send(options.data);
    }

    request.end((err, res) => {
      if (err) {
        const rejectVal = (res && res.body) || err;
        // global error handler to handle authenticaction issues
        acc.fire('request:error', rejectVal);

        requestPromise.reject(rejectVal);
      } else {
        requestPromise.resolve(res.body);
      }
    });

    requestPromise.abort = () => {
      // todo check if we need to
      // also reject the promise with
      // reason: 'user cancelled' or 'aborted'
      request.abort();
    };

    return requestPromise;
  };

  return acc;
}, apiClient);

extend(apiClient, dispatcher.create());

export { apiClient };
