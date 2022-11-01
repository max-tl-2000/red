/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

require('../catchUncaughtException');
import path from 'path';
import http from 'http';
import compression from 'compression';
import serveStatic from 'serve-static';
import { assert } from 'console';
import { setLogMiddleware } from './logger-middleware';
import { setRequestMiddleware } from './request-middleware';
import { setupWebpackDevServer } from './setup-dev-server';
import i18n from './i18n';
import { resolveWebSocketURL } from './resolve-helper';
import { getBuildVersion } from './notify-version';
import envVal from '../helpers/env-val';

import { initAPIProxy } from './proxy-api';
import { setSecureMiddleware } from './security';

import { setDefaultTZ } from '../helpers/moment-utils';
import { getFaviconLibrary } from '../helpers/favicon-library';
import { setServerTimeout } from './server-timeout';

setDefaultTZ('UTC');

const startDevServerIfNeeded = ({ isDevelopment, webpackConfigPath, baseDir, app, pathToStatic, logger }) => {
  const skipWebpackDevServer = envVal('SKIP_WEBPACK_DEV_SERVER', false);
  const willStartDevServer = isDevelopment && !skipWebpackDevServer;
  logger.info({ willStartDevServer }, 'Maybe starting dev server');
  if (!willStartDevServer) return;

  let webpackConfigs = webpackConfigPath;

  if (!Array.isArray(webpackConfigs)) {
    webpackConfigs = [webpackConfigs];
  }

  assert(baseDir, 'startDevServerIfNeeded: baseDir must be set!');
  assert(baseDir, 'startDevServerIfNeeded: pathToStatic must be set!');

  webpackConfigs = webpackConfigs.map(pathToConfig => {
    const configPath = path.resolve(baseDir, pathToConfig);
    logger.trace({ configPath, baseDir, pathToConfig }, 'requiring webpack cfg');
    return require(configPath); // eslint-disable-line global-require
  });

  logger.info({ webpackConfigNames: webpackConfigs.map(c => c.name), baseDir, pathToStatic }, 'Setting up webpack dev server');
  // in development we set the webpack dev server so watch mode
  // and hot reload work during development
  setupWebpackDevServer(app, {
    webpackConfigs, // the webpack config loaded
    // the path to the static folder from where the assets are served
    contentBase: path.resolve(baseDir, pathToStatic),
  });
};

/**
 * creates a server instance with some base defaults added
 * @param {ExpressApp} app
 * @param {Configuration} opts
 */
export const createServer = async (app, opts = {}) => {
  const {
    // path to favicons
    pathToFavicons,

    // the serviceName, used to identify this server instance
    serviceName,

    // the logger instance to use to produce log entries
    logger,

    // the baseDir used to resolve the rest of the provided paths
    // by convention this usually will be __dirname of the consumer
    // of this module
    baseDir,

    // the configuration object for this server instance
    // this is passed as parameter so each service can load
    // their own configuration
    config = {},

    // flag to check if we need to create a proxy to api using the `/api` route
    enableAPIProxy = false,

    // the path to the webpackConfig that the dev server will use
    // this path is relative to baseDir
    webpackConfigPath,

    // the path to the static folder where the generated assets are served from
    // this path is relative to baseDir
    pathToStatic,

    // function used to add custom headers to static assets
    setHeadersForStaticContent,

    // some projects need to have the url for the websocket as part of the `/config` route
    // when this is true the `__appData` global object will have an entry called
    // `socketConfig.url` that will contain the url to the socket server correctly resolved
    includeWSURLInConfigResponse = false,

    // the field from the configuration that contains the port to use. By default is `serverPort`
    // leasing uses `port`. TODO check if this option could be removed by making
    // leasing to also use `serverPort` like rentapp, resexp and consumer
    serverPortField = 'serverPort',

    // the error handler for 500 pages
    errorHandler,

    needMiddleware = true,
  } = opts;

  if (needMiddleware) {
    // this will add the reqId to every request
    setRequestMiddleware({ app });

    // this will force all request that come to the server to be redirected to https
    setSecureMiddleware({ app, logger });

    // this will configure the logger middleware for requests
    // this will log incoming requests and outgoing responses
    logger && setLogMiddleware({ app, logger });
  }
  // this will load the translations and configure the translation middleware
  await i18n.init(app, {
    namespaceDir: path.resolve(baseDir, '../trans/en'),
    debug: config.i18nDebug,
    logger,
    loadPath: path.resolve(baseDir, '../trans/{{lng}}/{{ns}}.yml'),
  });

  const { apiPort, wsPort, isDevelopment } = config;
  // leasing config uses port instead of serverPort
  // so that's why we need `serverPortField` to be a config option
  const serverPort = config[serverPortField];

  startDevServerIfNeeded({
    isDevelopment,
    webpackConfigPath,
    baseDir,
    app,
    pathToStatic,
    logger,
  });

  app.use(compression());

  const setHeaders = (res, path_) => {
    // this is needed to be able to load webfonts from
    // static.reva.tech in development.
    // and to be able to capture errors that happen in the client code
    // from scripts served from static.reva.tech
    if (path_.match(/libs\/font\//) || path_.match(/\.js$/) || path_.match(/\.css$/)) {
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

    setHeadersForStaticContent && setHeadersForStaticContent(res, path_);
  };

  app.use(serveStatic(path.join(baseDir, '../static'), { setHeaders }));

  if (!pathToFavicons) {
    throw new Error('pathToFavicons is required. It should point to the folder where the favicons are stored');
  }

  const { library } = getFaviconLibrary(config);
  app.use(serveStatic(path.join(pathToFavicons, library), { setHeaders }));

  // this endpoint is used to reload the translations
  // it can be called from the developer console by calling
  // window.__reloadTrans();
  app.get('/trans/:lang', async (req, res) => {
    const trans = await i18n.reload(req.params.lang);
    res.json(trans);
  });

  // returns the socketConfig if enabled, otherwise empty string
  const getSocketConfig = (req, enabled) => {
    if (!enabled) return ''; //
    const url = resolveWebSocketURL(req.get('Host'), req.get('X-Forwarded-Proto'), wsPort);
    return JSON.stringify({ url });
  };

  app.post('/buildVersion', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ buildVersion: `${getBuildVersion()}` }));
  });

  app.get('/config', (req, res) => {
    const lng = req.locale;
    const { i18n: i18nInstance = {} } = req;
    const resources = i18nInstance?.translator?.resourceStore?.data || {};
    res.setHeader('Content-Type', 'application/javascript');

    const options = i18nInstance.options;
    const i18nOptions = JSON.stringify({
      lng,
      resources: {
        [lng]: {
          ...resources[lng],
        },
      },
      ns: options.ns,
      defaultNS: options.defaultNS,
      interpolation: options.interpolation,
    });

    const socketConfigJSON = getSocketConfig(req, includeWSURLInConfigResponse);
    const socketConfigSerialized = socketConfigJSON ? `appData.socketConfig = ${socketConfigJSON};` : '';
    const buildVersion = getBuildVersion();
    const isMin = req.query.min === 'false';
    const { apiKey = '' } = config.googleMaps || {};

    // TODO: minimize this in PROD
    res.send(
      `
      (function () {
        var appData = window.__appData = (window.__appData || {});
        appData.i18nOptions = ${i18nOptions};
        appData.buildVersion = "${buildVersion}";
        appData.cloudinaryCloudName = "${config.cloudinaryCloudName}";
        appData.placesAPIKey ="${apiKey}";
        appData.cloudEnv = "${process.env.CLOUD_ENV}";
        ${socketConfigSerialized}
        window.__RED_PROD_MODE__ = ${isMin ? '"development"' : `"${process.env.NODE_ENV}"`}
        window.__REDUX_DEV_TOOLS__ = ${isMin}
      }());
    `.trim(),
    );
  });

  // this endpoint is used by the health check and is added to all the services
  app.get('/ping', async (req, res) => res.send('ok'));

  // creates the `/api` proxy in this server instance
  enableAPIProxy && initAPIProxy({ app, apiPort, logger }); // missing logger was causing issue reported by Darius about proxy-api issue

  return {
    // starts the server. This should be called at the end
    // after all configurations, routes and middlewares are
    // attached to the provided express app instance
    start() {
      // register the error route at the end to ensure it is the last one
      app.use((error, req, res, next) => {
        logger.error({ error, ctx: req }, `${serviceName} error processing request`);
        if (errorHandler) {
          errorHandler(error, req, res, next);
          return;
        }
        next(error);
      });

      const server = new http.Server(app);

      setServerTimeout(server);

      server.listen(serverPort, error => {
        if (error) {
          logger.error({ error }, `${serviceName} listener caught error`);
          return;
        }
        logger.info(`✅ ${serviceName} is running at port ${serverPort}`);
      });

      return server;
    },
  };
};
