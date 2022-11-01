/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import https from 'https';
import { StringDecoder } from 'string_decoder';
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'leaseRequestor' });

/* We are using https module from Nodejs instead of superagent because */
/* the current endpoint does not have a valid SSL certificate and superagent */
/* does not allow bypassing this */
const sendXmlPostRequest = (hostname, requestPath, postData) =>
  new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      path: requestPath,
      method: 'POST',
      rejectUnauthorized: true,
      agent: false,
      timeout: 15000,
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, res => {
      logger.trace(`RESPONSE STATUS: ${res.statusCode}`);
      logger.trace(`RESPONSE HEADERS: ${JSON.stringify(res.headers)}`);

      let body = '';
      const decoder = new StringDecoder('utf8');
      res.on('data', chunk => {
        body += decoder.write(chunk);
      });

      res.on('end', () => {
        body += decoder.end();
        return resolve(body);
      });
    });

    req.on('error', error => {
      logger.error({ error }, 'POST request failed');
      return reject(error);
    });

    // write data to request body
    req.write(postData);
    req.end();
  });

export const requestDocumentSets = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
export const requestEnvelope = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
export const requestCounterSignerToken = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
export const requestSignedDocument = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
export const requestSignerTokens = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
export const requestEnvelopeStatus = ({ hostname, endpointPath, request }) => sendXmlPostRequest(hostname, endpointPath, request);
