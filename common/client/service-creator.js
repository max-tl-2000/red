/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { retryOnFail } from './retry-on-fail';
import { xhrSend } from './sender.ts';
import { deferred } from '../helpers/deferred';

export const combine = (host, path) => {
  host = host.replace(/\/$/, '');
  path = path.replace(/^\//, '');
  return `${host}/${path}`;
};

const getDefaultData = (args = []) => (args.length > 0 ? args[0] : undefined);

const tryCall = async (fn, ...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    const fnName = fn ? fn.name : 'anonymous';
    console.warn(`[ERROR]: error trying to execute fn: "${fnName}".`, err);
    return undefined;
  }
};

const wrapPromise = (p, dfd) => {
  let innerPromise;

  dfd.abort = () => innerPromise?.abort?.();
  dfd.reset = () => innerPromise?.reset?.();

  p.then(res => {
    innerPromise = res.sendPromise;
    innerPromise.onUploadProgress = dfd.onUploadProgress;
    innerPromise.onDownloadProgress = dfd.onDownloadProgress;
    innerPromise.then(dfd.resolve);
    innerPromise.catch(dfd.reject);
  });

  p.catch(dfd.reject);

  return dfd;
};

export const createService = serviceDescriptor =>
  Object.keys(serviceDescriptor).reduce(
    (service, serviceName) => {
      let lastFetchArgs = {};
      async function serviceFn(...args) {
        // clear the args as soon as we enter the function to prevent use stale data
        lastFetchArgs = {};
        // eslint-disable-next-line prefer-const
        let { url, data, headers, ...callDescriptor } = serviceDescriptor[serviceName];

        url = typeof url === 'function' ? await tryCall(url, ...args) : url;
        // if data is a function we pass all the arguments to the function so it creates
        // the payload with all the provided arguments, expecting it to return a single object
        // if the data is not a function then we get the first argument passed to the function as the
        // data payload. If this is an object it will be serialized using json stringify before sending it
        data = typeof data === 'function' ? await tryCall(data, ...args) : getDefaultData(args);
        headers = typeof headers === 'function' ? await tryCall(headers, ...args) : headers;

        const { _headersFn } = this;

        headers = typeof _headersFn === 'function' ? { ...(await tryCall(_headersFn, ...args)), ...headers } : headers;

        const opts = { ...callDescriptor, data, headers };

        lastFetchArgs = {
          url,
          opts,
        };

        const p = xhrSend(url, opts);
        return { sendPromise: p };
      }

      service[serviceName] = function wrappedFn(...args) {
        const dfd = deferred();
        const { _onErrorRetry } = service;
        // by default we will attempt to execute an xhr call twice
        const { onErrorRetry, maxAttempts = 2 } = serviceDescriptor[serviceName];

        const onErrorRetryFn = onErrorRetry || _onErrorRetry;

        if (onErrorRetryFn) {
          if (typeof onErrorRetryFn !== 'function') throw new Error('onErrorRetry must be a function');
          // returning here is important to be able to pass the promise return value tp the caller
          const p = retryOnFail(() => serviceFn.apply(service, args), {
            maxAttempts,
            onFail: (error, retryFn, opts) => onErrorRetryFn(error, retryFn, { ...opts, lastFetchArgs }),
            fnName: serviceName,
          });

          return wrapPromise(p, dfd);
        }

        const p = serviceFn.apply(service, args);

        return wrapPromise(p, dfd);
      };

      return service;
    },
    {
      setHeadersForAllCalls(headers = {}) {
        this._headersFn = typeof headers !== 'function' ? () => headers : headers;
      },
      clearHeadersForAllCalls() {
        this._headersFn = undefined;
      },
    },
  );
