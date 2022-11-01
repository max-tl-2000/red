/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import config from '../config';
import { getAssets } from '../../common/server/get-assets';
import logger from '../../common/helpers/logger';
import envVal from '../../common/helpers/env-val';
import { renderReactTpl } from '../../common/render-react-tpl';
import Index from '../views/index';
import { decodeJWTToken } from '../../common/server/jwt-helpers';
import { createServer } from '../../common/server/common-server';
import { redirectIfUserHasPassword, redirectToSourceApp, detectMultipleApplications } from './api/middleware';
import { consumerSupportedBrowsers as supportedBrowsers } from '../../common/server/browser-detector.ts';
import { setLogMiddleware } from '../../common/server/logger-middleware';

import {
  login,
  checkCommonUserIsRegistered,
  createCommonUser,
  commonUserChangePassword,
  changeCommonUserPassword,
  inviteCommonUser,
  registerCommonUser,
  requestResetPasswordCommonUser,
  requestTemporalResetPassword,
  sendResetPasswordEmail,
} from './api/actions/common-user';

import { getDistFolderName } from '../../common/server/dist-folders';
import { formatError } from '../../common/server/format-error';
import { renderCommonPage } from '../../server/render-helpers';
import ErrorPage from '../../server/views/error';
import { noIndexRobotsHeader } from '../../server/common/middleware';

const distFolderName = getDistFolderName();

const respondWithError = (res, err) => {
  res.status(err.status || 500).send(formatError(err, { isProdEnv: config.isProdEnv, logger }));
};

const handleErrors = method => async (req, res, next) => {
  try {
    await method(req, res, next);
  } catch (err) {
    logger.error({ ctx: req, error: err }, 'authRoutes error');
    respondWithError(res, err);
  }
};

const checkRefererMiddleware = (req, res, next) => {
  const { referer } = req.headers;

  if (referer) {
    const rxpFirebaseStagingUrl = 'rxp-web-staging.web.app';

    if (config.isDevelopment || referer.includes('reva.tech') || referer.includes(rxpFirebaseStagingUrl)) {
      next();
      return;
    }
    respondWithError(res, { token: 'FORBIDDEN_REFERER', status: 403 });
  }

  if (req.headers['rxp-api-token'] === config.resident.deviceApi) {
    next();
    return;
  }
  respondWithError(res, { token: 'FORBIDDEN_REFERER', status: 403 });
};

// TODO: these should be moved to api probably under the api/auth/ namespace
const addAuthRoutes = app => {
  app.post('/login', checkRefererMiddleware, handleErrors(login));
  app.get('/commonUser/check/:userId', handleErrors(checkCommonUserIsRegistered));
  app.post('/commonUser', handleErrors(createCommonUser));
  app.post('/commonUser/invite', handleErrors(inviteCommonUser));
  app.post('/commonUserChangePassword/', handleErrors(commonUserChangePassword));
  app.post('/commonUser/changePassword/', checkRefererMiddleware, handleErrors(changeCommonUserPassword));
  app.post('/commonUser/register', handleErrors(registerCommonUser));
  app.post('/commonUser/requestResetPassword', handleErrors(requestResetPasswordCommonUser));
  app.post('/commonUser/sendResetPassword', checkRefererMiddleware, handleErrors(sendResetPasswordEmail));
  app.post('/commonUser/requestTemporalResetPassword', handleErrors(requestTemporalResetPassword));
};

const getIndexContent = async req => {
  logger.debug('serving index content');
  const { isDevelopment } = config;
  const { jsAssets, cssAssets, getStaticResource } = await getAssets({
    host: req.host,
    query: req.query,
    useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
    jsManifests: [
      path.join(__dirname, `../../static/${distFolderName}/polyfills-manifest.json`),
      path.join(__dirname, `../../static/${distFolderName}/vendors-manifest.json`),
      path.join(__dirname, `../static/${distFolderName}/main-manifest.json`),
    ],
    cssFiles: ['vendors.css', { name: 'auth.css', skipInDev: true, local: true }],
    jsFiles: ['vendors.js', { name: 'auth.js', dev: true, local: true }],
  });

  const { translator } = req.i18n;
  const token = req.query && req.query.token && (await decodeJWTToken(req.query.token));

  const props = {
    jsAssets: [getStaticResource('polyfills.js'), `/config${req.query.min === 'false' ? '?min=false' : ''}`, ...jsAssets],
    cssAssets,
    title: translator.translate('REGISTRATION_TITLE'),
    // TODO: we don't need the entire auth token being decoded here
    token: token ? JSON.stringify(token) : null,
    cloudEnv: config.cloudEnv,
  };

  if (req.path === '/confirm') {
    try {
      const confirmToken = req.query?.confirmToken && (await decodeJWTToken(req.query.confirmToken));
      props.appData = JSON.stringify({ confirmToken });
    } catch (error) {
      logger.error({ ctx: req, error }, 'Error while decoding confirm token');
    }
  }

  return renderReactTpl(Index, { props, req, supportedBrowsers });
};

const sendIndexContent = async (req, res, next) => {
  try {
    const result = await getIndexContent(req);
    res.send(result);
  } catch (error) {
    next(error);
  }
};

const addIndexRoute = app => {
  app.get('/registration', redirectIfUserHasPassword, sendIndexContent);

  app.get('/redirect/:rentappToken', detectMultipleApplications, redirectToSourceApp, sendIndexContent);

  app.use(sendIndexContent);
};

const main = async () => {
  const app = new Express();

  app.use(noIndexRobotsHeader());

  // TODO: check what is the origin from calls that come from the native apps
  app.use(cors({ optionsSuccessStatus: 200 }));

  app.use(bodyParser.json());
  setLogMiddleware({ app, logger });

  const server = await createServer(app, {
    serviceName: 'Auth',
    logger,
    baseDir: __dirname,
    pathToFavicons: path.resolve(__dirname, '../../resources/favicons'),
    config,
    webpackConfigPath: '../webpack/webpack-config', // relative to baseDir
    pathToStatic: '../static/', // relative to baseDir
    errorHandler: async (err, req, res, next) => {
      const { isProdEnv } = config;
      const serverError = formatError(err, { isProdEnv, logger });

      if (isProdEnv) {
        res.status(err.status || 500);
        await renderCommonPage(ErrorPage, { res, props: { serverError }, req, next });
      } else {
        res
          .status(err.status || 500)
          .json(serverError)
          .send();
      }
    },
  });

  addAuthRoutes(app);
  addIndexRoute(app);

  server.start();
};

main().catch(reason => logger.error({ reason }, 'Error loading auth'));
