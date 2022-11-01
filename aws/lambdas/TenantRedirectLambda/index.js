/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const https = require('https');

const doRequest = (options, data) => {
  console.log({ options, data }, 'doRequest');
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];

      res.on('data', chunk => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ ...res, responseBody: buffer.toString('base64') });
      });
    });

    req.on('error', err => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const getRedirectedTenantHostname = host => {
  const tenantsMap = {
    'chris-old.staging.env.reva.tech': 'chris-new.staging.env.reva.tech',
  };

  return tenantsMap[host];
};

const getQueryParams = queryStringParameters =>
  Object.keys(queryStringParameters || {})
    .map(pName => `${pName}=${queryStringParameters[pName]}`)
    .join('&');

const getRequestPath = (path, queryStringParameters) => {
  if (!path) return path;

  const queryParameters = getQueryParams(queryStringParameters);
  const hasQueryParams = !!queryParameters;

  const params = hasQueryParams ? `?${queryParameters}` : '';

  return `${path}${params}`;
};

exports.handler = async event => {
  console.log('Tenant redirect - event', JSON.stringify(event, null, 2));

  const { headers, body, path, httpMethod, queryStringParameters } = event || {};
  const { host } = headers;

  const redirectedHostname = getRedirectedTenantHostname(host);

  if (!redirectedHostname) {
    return {
      statusCode: 500,
      isBase64Encoded: false,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        vary: 'Accept-Encoding',
      },
      body: JSON.stringify({ httpStatusCode: 500, error: 'no tenant mapping found', host }),
    };
  }

  const requestPath = getRequestPath(path, queryStringParameters);

  const isApiRequest = reqPath => {
    // /sitemap is included here because returning the body from the lambda instead of a simple redirect causes the lambda to return 502
    // /export/proxy is included here because the token cannot be obtained from localstorage, a simple redirect allows the html page and javascript fn to work correctly
    if (reqPath.includes('/sitemap') || reqPath.includes('/export/proxy')) return false;

    return reqPath.includes('/api');
  };

  if (httpMethod === 'GET' && !isApiRequest(path)) {
    return {
      statusCode: 302,
      headers: {
        ...headers,
        Location: `https://${redirectedHostname}${requestPath}`,
      },
      body,
    };
  }

  const options = {
    host: redirectedHostname,
    port: 443,
    path: requestPath,
    method: httpMethod,
    headers: { ...headers, host: redirectedHostname },
  };

  const res = await doRequest(options, body);

  const { responseBody, ...response } = res;

  console.log('proxy response status code', response.statusCode, response.headers);

  // Note: the lambda will return 502 if the body of the request is close to ~1MB
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: responseBody,
    isBase64Encoded: true,
  };
};

exports.getRedirectedTenantHostname = getRedirectedTenantHostname;
exports.getRequestPath = getRequestPath;
