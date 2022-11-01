/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import express from 'express';
import bodyParser from 'body-parser';

import { routeHandler, jwtAuthorizationHandler, notFoundHandler, noIndexRobotsHeader } from '../common/middleware';
import { setLogMiddleware } from '../../common/server/logger-middleware';
import { setDefaultAPIHeaderSecurity } from '../common/securityMiddleware';

import * as actions from './export_actions';

import logger from '../../common/helpers/logger';
import { setRequestMiddleware } from '../../common/server/request-middleware';
import { errorHandler } from '../common/errorMiddleware';

// TODO: factorize common components with other api modules

const app = express();

app.use(noIndexRobotsHeader());
app.use(bodyParser.urlencoded({ extended: false, limit: '10000mb' }));
app.use(bodyParser.json({ limit: '10000mb' }));

setRequestMiddleware({ app });
setLogMiddleware({ app, logger });

setDefaultAPIHeaderSecurity(app);

app.get('/ping', async (req, res) => {
  logger.trace({ ctx: req }, 'ping');
  res.send('ok');
});

const openPaths = [];

const routeMethods = ['get', 'put', 'post', 'patch', 'delete'];
const router = {};

routeMethods.forEach(method => {
  router[method] = app[method].bind(app);
  app[method] = (route, ...routeMiddleware) => {
    if (!routeMiddleware.length) {
      return router[method](route); // probably this is app.get('settingName');
    }

    const [routeAction] = routeMiddleware.splice(routeMiddleware.length - 1, 1);
    if (!routeAction) {
      logger.error({ route }, 'Could not find action for route');
      throw new Error(`Missing action for route ${route}`);
    }
    return router[method](route, ...routeMiddleware, routeHandler(routeAction));
  };
});

app.use(jwtAuthorizationHandler(openPaths));

app.post('/:version/export', actions.handleExport);
app.post('/:version/runExportOneToManys', actions.handleExportOneToManys);

// Fallback route not found handler
app.use('*', notFoundHandler());

// Fallback error handler
app.use(errorHandler());

export default app;
