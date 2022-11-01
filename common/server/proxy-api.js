/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import httpProxy from 'http-proxy';
import cors from 'cors';
import { X_REQUEST_ID } from '../enums/requestHeaders';

export const initAPIProxy = ({ app, apiPort, logger, apiHost = '127.0.0.1' }) => {
  const proxy = httpProxy.createProxyServer({
    target: `http://${apiHost}:${apiPort}`, // in integration docker machine it complains about trying to use 0.0.0.0
    ws: true,
  });

  // added the error handling to avoid https://github.com/nodejitsu/node-http-proxy/issues/527
  // this is also the fix to https://redisrupt.atlassian.net/browse/CPM-5782
  proxy.on('error', (error, req, res) => {
    logger.error({ error, req, res, ctx: req }, 'proxy error');

    if (!res.headersSent) {
      res.writeHead(500, {
        'content-type': 'application/json',
      });
    }

    const json = {
      error: 'proxy_error',
      reason: error.message,
    };

    res.end(JSON.stringify(json));
  });

  proxy.on('proxyReq', (proxyReq, req, _res) => {
    logger.trace({ ctx: req }, 'proxy - calling api');
    proxyReq.setHeader(X_REQUEST_ID, req.reqId);
  });
  // Proxy to API server
  // Some legacy browsers (IE11, various SmartTVs) choke on 204 that's why we need to use 200
  app.use('/api', cors({ optionsSuccessStatus: 200 }), (req, res) => {
    proxy.web(req, res);
  });
};
