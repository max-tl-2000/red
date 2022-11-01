/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import { attempt } from './attempt';
import { request } from './httpUtils';
import logger from './logger';

const MAX_ATTEMPTS = 3;
export const PARSE_EXCEPTION = 'ParseException';

const parseXMLFromResponse = async res => {
  try {
    return await xml2js(res);
  } catch (e) {
    throw { msg: PARSE_EXCEPTION, data: sanitizedResponse }; // eslint-disable-line
  }
};

// posts an XML string to url
export const postXML = (url, xmlData = '', options) =>
  request(url, {
    method: 'post',
    type: 'text/xml',
    data: xmlData,
    buffer: true,
    alwaysReturnText: true,
    ...options,
  }).then(parseXMLFromResponse);

export const postXMLWithRetries = async (url, payload, options, retries = MAX_ATTEMPTS) => {
  const retryCondition = e => e && e.msg !== PARSE_EXCEPTION;
  return attempt({
    func: () => postXML(url, payload, options),
    attempts: retries,
    autoExec: true,
    onAttemptFail: ({ retry, error }) => {
      if (!retryCondition(error)) throw error;
      // error.response.error contains information from the original request
      const errorObj = {
        originalError: error,
        msg: error?.msg,
        message: error?.message,
        status: error?.status,
        error: error?.response?.error,
      };
      logger.error({ errorObj, retry }, 'error on retry postXML');
    },
  });
};
