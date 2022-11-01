/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isObject } from '../helpers/type-of';
import { deferred } from '../helpers/deferred';
import { combineWithParams } from './serialize';
import tryParse from '../helpers/try-parse';
import nullish from '../helpers/nullish';

interface IReportProgressArgs {
  loaded: number;
  total: number;
  percentage: number;
}

interface IReportProgressFn {
  (args: IReportProgressArgs): void;
}

interface ISender<T> extends Promise<T> {
  abort(): void;
  send(): void;

  onDownloadProgress: IReportProgressFn;
  onUploadProgress: IReportProgressFn;

  reset(): void;
}

type xhrMethods = 'GET' | 'POST' | 'PATCH' | 'POST' | 'HEAD';

interface IHash {
  [key: string]: string;
}

interface ICreateSenderOptions<K> {
  method: xhrMethods;
  data?: K;
  user?: string;
  password: string;
  mimeType: string;
  headers?: IHash;
  responseType: string;
  crossDomain: boolean;
  autoSend: boolean;
  dataAsQueryParams: boolean;
  rawData: boolean;
  onResponse(res: any, sender: any): void;
}

const parseAsJSONIfNeeded = response => {
  if (typeof response === 'string') {
    response = tryParse(response, { response });
  }

  return response;
};

export function xhrSend<K, T>(url: string, options: ICreateSenderOptions<K>): ISender<T> {
  const defaults = {
    method: 'GET',
    async: true,
    data: undefined,
    responseType: 'json',
    autoSend: true,
  };

  const opts = {
    ...defaults,
    ...options,
  };

  const { data, method, user, password, mimeType, headers, crossDomain, onResponse, rawData, autoSend, dataAsQueryParams, responseType } = opts;

  let dataToSend;

  if (rawData) {
    dataToSend = data;
  } else if (isObject(data)) {
    if (dataAsQueryParams) {
      url = combineWithParams(url, data);
    } else {
      dataToSend = JSON.stringify(data);
    }
  }

  const dfd = deferred();

  if (!url) {
    throw new Error('URL is required');
  }

  const xhr = new XMLHttpRequest();

  xhr.open(method, url, true, user, password);

  if (mimeType && xhr.overrideMimeType) {
    xhr.overrideMimeType(mimeType);
  }

  const headersToSet = headers || {};

  if (!crossDomain && !headersToSet['X-Requested-With']) {
    headersToSet['X-Requested-With'] = 'XMLHttpRequest';
  }

  if (!headersToSet['Content-Type'] && !rawData) {
    headersToSet['Content-Type'] = 'application/json';
  }

  Object.keys(headersToSet).forEach(key => {
    xhr.setRequestHeader(key, headersToSet[key]);
  });

  xhr.responseType = responseType as XMLHttpRequestResponseType;

  dfd.resolver = async sender => {
    let res = parseAsJSONIfNeeded(sender.response);
    if (onResponse) {
      res = await onResponse(res, sender);
    }
    dfd.resolve(res);
  };

  xhr.onload = () => {
    const { status } = xhr;
    if ((status >= 200 && status < 300) || status === 304) {
      dfd.resolver(xhr);
      return;
    }
    const errorMessage = xhr.response?.token || `Invalid xhr.status: ${xhr.status}`;
    dfd.reject({ sender: xhr, error: new Error(errorMessage) });
  };

  xhr.onerror = e => dfd.reject({ error: e, sender: xhr });

  dfd.abort = () => {
    try {
      xhr && xhr.abort && xhr.abort();
    } catch (err) {
      console.warn('error aborting xhr request', err);
    }
  };

  dfd.send = () => xhr.send(dataToSend);

  dfd.reset = () => {
    dfd.onDownloadProgress = dfd.onUploadProgress = undefined;
  };

  xhr.onprogress = e => {
    if (nullish(e.lengthComputable) || !dfd.onDownloadProgress) return;
    dfd.onDownloadProgress({
      loaded: e.loaded,
      total: e.total,
      percentage: (e.loaded / e.total) * 100,
      sender: xhr,
    });
  };

  if (xhr.upload) {
    xhr.upload.onprogress = e => {
      if (nullish(e.lengthComputable) || !dfd.onUploadProgress) return;
      dfd.onUploadProgress({
        loaded: e.loaded,
        total: e.total,
        percentage: (e.loaded / e.total) * 100,
        sender: xhr,
      });
    };
  }

  autoSend && dfd.send();

  return dfd;
}
