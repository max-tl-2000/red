/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sa from 'superagent';
import binaryParser from 'superagent-binary-parser';

import fs from 'fs';

const setRequestFields = (fields = [], saRequest) => {
  fields?.forEach(({ name, value, isFile }) => {
    if (isFile) {
      saRequest.attach(name, value);
      return;
    }

    saRequest.field(name, value);
  });
};

const download = fileStream =>
  new Promise((resolve, reject) => {
    fileStream
      .on('finish', () => {
        resolve();
      })
      .on('error', err => {
        reject(err);
      });
  });

const response = (httpResponse, alwaysReturnText) =>
  new Promise((resolve, reject) => {
    httpResponse.end((err, res) => {
      const { body, text } = res || {};
      if (err) {
        reject(err);
        return;
      }
      if (alwaysReturnText) {
        resolve(res.text);
        return;
      }
      resolve(body, text);
    });
  });

/**
 * request wrapper (because the promise api of superagent does not parse the json output)
 * alwaysReturnText option is needed because in the case of XML, the body comes back as an empty object
 * and not parsed XML
 */
export const request = (
  url,
  {
    method = 'get',
    timeout = 30000,
    type = 'json',
    query = '',
    data,
    headers,
    buffer = false,
    auth = null,
    alwaysReturnText = false,
    fields = [],
    filePath = '',
  } = {},
) => {
  const saRequest = sa[method](url);
  headers && saRequest.set(headers);
  type && saRequest.type(type);
  query && saRequest.query(query);
  timeout && saRequest.timeout(timeout);
  if (type === 'raw' && !buffer) {
    throw new Error('must set buffer when using raw type');
  }
  buffer && saRequest.buffer(true);
  type === 'raw' && saRequest.parse(binaryParser);
  auth && saRequest.auth(auth.user, auth.pass);
  setRequestFields(fields, saRequest);

  let res = saRequest;
  res = saRequest.send(data);

  if (filePath) {
    const fileStream = fs.createWriteStream(filePath);
    res.pipe(fileStream);
    return download(fileStream);
  }

  return response(res, alwaysReturnText);
};

// helpers for the most common cases

export const callService = (url, method = 'get', timeout) => request(url, { method, timeout });
