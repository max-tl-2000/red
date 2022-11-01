/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { removeToken } from './strings';
import { obscureUrl, OBSCURE_VALUE } from './logger-utils';
import { X_REQUEST_ID, X_SOCKET_ID } from '../enums/requestHeaders';

const excludedPaths = ['/ping', '/health'];

const privateUrlProperties = ['referer', 'referrer'];

const removeTokensFromHeaders = headers =>
  privateUrlProperties.forEach(prop => {
    if (headers[prop]) headers[prop] = removeToken(headers[prop]);
  });

const privateProperties = ['authorization', 'token', 'x-api-token'];

const obscureTokensFromUrlParams = req => {
  if (req.url) req.url = obscureUrl(req.url);
  if (req.originalUrl) req.originalUrl = obscureUrl(req.originalUrl);
};

const obscureTokensFromQueryObj = ({ query }, obscureQueryParams) => {
  obscureQueryParams.forEach(param => {
    if (query[param]) {
      query[param] = OBSCURE_VALUE;
    }
  });
};

export default function loggerMiddleware(options) {
  options = options || {};
  let logger = options.logger;

  if (!logger) {
    throw new Error('`logger` is required');
  }

  let obscureHeaders = options.obscureHeaders;
  const obscureBody = options.obscureBody;
  const requestStart = options.requestStart || true;

  const verbose = options.verbose || false;

  if (obscureHeaders && obscureHeaders.length) {
    obscureHeaders = obscureHeaders.map(name => name.toLowerCase());
  } else {
    obscureHeaders = [];
  }

  obscureHeaders = [...obscureHeaders, ...privateProperties];

  const serializerForRequestObject = req => {
    const requestToLog = { ...req };
    obscureTokensFromUrlParams(requestToLog);
    obscureTokensFromQueryObj(requestToLog, obscureBody);

    const obj = {
      method: requestToLog.method,
      url: requestToLog.originalUrl || requestToLog.url,
      headers: { ...requestToLog.headers },
      query: requestToLog.query,
      // This was "connection" instead of "socket", but "connection"
      // was deprecated in Node 14.
      remoteAddress: requestToLog.socket?.remoteAddress,
      remotePort: requestToLog.socket?.remotePort,
      reqId: requestToLog.reqId,
    };
    if (obscureHeaders && obj.headers) {
      removeTokensFromHeaders(obj.headers);

      const headersToIgnore = obscureHeaders.reduce((acc, header) => {
        acc[header] = true;
        return acc;
      }, {});

      const headers = Object.keys(obj.headers).reduce((acc, name) => {
        if (!headersToIgnore[name]) {
          acc[name] = obj.headers[name];
        }
        return acc;
      }, {});

      obj.headers = headers;
    }

    obj.obscureBody = obscureBody; // this will be used by the logger to known which fields to hide

    return obj;
  };

  logger = logger.child({
    subType: 'access-log',
    serializers: {
      req: serializerForRequestObject,
      res: (logger.serializers && logger.serializers.res) || logger.constructor.stdSerializers.res,
    },
  });

  const isLoggableRequest = req => !excludedPaths.some(path => req.url.includes(path));

  return (req, res, next) => {
    if (!isLoggableRequest(req)) return next();

    const reqId = req.reqId || req.get(X_REQUEST_ID);
    const socketId = req.get(X_SOCKET_ID);
    const referrer = req.get('referrer');
    const clientIp = req.headers['x-forwarded-for'];
    const url = req.url;

    const start = Date.now();

    const childLoggerProps = { ctx: req, reqId, socketId, referrer, clientIp };

    req.log = res.log = logger.child(childLoggerProps, true);

    if (requestStart || verbose) {
      const reqStartData = { req, url };

      if (verbose) {
        reqStartData.res = res;
      }

      req.log.trace(reqStartData, 'request start');
    }

    res.on('finish', () => {
      const reqFinishData = {
        res,
        url,
        duration: Date.now() - start,
      };

      if (!requestStart || verbose) {
        reqFinishData.req = req;
      }

      let method = 'trace';

      if (res.statusCode >= 400) {
        const shouldUseInfo = [401, 403, 412, 498].includes(res.statusCode);
        method = shouldUseInfo ? 'info' : 'error';
      }

      res.log[method](reqFinishData, 'request finish');
    });

    res.on('close', () => {
      const endData = {
        duration: Date.now() - start,
        req,
        res,
      };

      res.log.warn(endData, 'request socket closed');
    });

    return next();
  };
}
