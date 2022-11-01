/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import path from 'path';
import config from './config';
import Index from './views/index';
import Privacy from './views/privacy';
import Tos from './views/tos';

import { getAssets } from '../common/server/get-assets';
import logger from '../common/helpers/logger';
import { getTenantConfig } from './helpers/tenantConfig';
import { createServer } from '../common/server/common-server';
import envVal from '../common/helpers/env-val';
import { getDistFolderName } from '../common/server/dist-folders';
import { read } from '../common/helpers/xfs';
import { ignoreBot, noIndexRobotsHeader } from './common/middleware';
import ErrorPage from './views/error';
import { isUnitPricingEnabled } from '../common/helpers/utils';
import { formatError } from '../common/server/format-error';
import { doRender, renderOnlyInLocal, renderPage404, renderCommonPage } from './render-helpers';
import { combine } from '../common/helpers/urlPath';
import { pathExists } from '../common/helpers/paths';

const distFolderName = getDistFolderName();

const registerCommonPaths = (app, pagePaths) => {
  if (!pagePaths) throw new Error('pagePaths not specified');

  app.get(`/${pagePaths.privacy}`, async (req, res, next) => {
    await doRender(Privacy, { req, res, next, props: { cloudEnv: config.cloudEnv } });
  });

  app.get(`/${pagePaths.termsOfService}`, async (req, res, next) => {
    await doRender(Tos, { req, res, next, props: { cloudEnv: config.cloudEnv } });
  });
};

const renderApiDocs = async res => {
  const docsContent = await read('./static/docs/index.html');
  res.send(docsContent);
};

const registerComponentsDemoPath = (app, { isDevelopment } = {}) => {
  app.get('/iframe-test', renderOnlyInLocal, async (req, res, next) => {
    const host = req.get('host');

    logger.debug('serving `/iframe-test` route');

    const { jsAssets, cssAssets } = await getAssets({
      host,
      query: req.query,
      useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
      jsManifests: [path.resolve(`./static/${distFolderName}/vendors-manifest.json`), path.resolve(`./static/${distFolderName}/components-demo-manifest.json`)],
      cssFiles: ['vendors.css', { name: 'iframeTest.css', skipInDev: true }],
      jsFiles: ['vendors.js', { name: 'iframeTest.js', dev: true }],
    });

    const props = {
      jsAssets: [`/config${req.query.min === 'false' ? '?min=false' : ''}`, ...jsAssets],
      cssAssets,
      title: 'Iframe test',
      cloudEnv: config.cloudEnv,
    };

    await doRender(Index, { props, req, res, next });
  });

  app.use('/components-demo', renderOnlyInLocal, async (req, res, next) => {
    const host = req.get('host');

    logger.debug('serving `/components-demo` route');

    const { jsAssets, cssAssets } = await getAssets({
      host,
      query: req.query,
      useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
      jsManifests: [path.resolve(`./static/${distFolderName}/vendors-manifest.json`), path.resolve(`./static/${distFolderName}/components-demo-manifest.json`)],
      cssFiles: ['vendors.css', { name: 'componentsDemo.css', skipInDev: true }],
      jsFiles: ['vendors.js', { name: 'componentsDemo.js', dev: true }],
    });

    const props = {
      jsAssets: [`/config${req.query.min === 'false' ? '?min=false' : ''}`, ...jsAssets],
      cssAssets,
      title: 'Components demo',
      cloudEnv: config.cloudEnv,
    };

    await doRender(Index, { req, res, next, props });
  });
};

const getSisenseValuesForAppData = (cfg, tenantName) => {
  const sisenseConfig = cfg.sisense;
  if (!sisenseConfig) throw new Error('No sisense config provided');

  const sisenseData = {
    sisenseURL: `https://${sisenseConfig.domain}`,
    logoutURL: `https://${sisenseConfig.domain}/api/auth/logout`,
    ssoSecret: sisenseConfig.ssoSecret,
    cookieExpirationDays: sisenseConfig.cookieExpirationDays,
    cookieName: sisenseConfig.cookieName,
    cookieDomain: sisenseConfig.cookieDomain,
  };

  if (isUnitPricingEnabled(tenantName)) {
    const unitPricingRootURL = `https://${sisenseConfig.domain}/app/main#/dashboards`;
    // TODO!!! [adrian] - move this to tenant settings/app settings
    sisenseData.unitPricingURL = tenantName.includes('customerold-sal')
      ? `${unitPricingRootURL}/5c07bf2bca0558200c03d148/`
      : `${unitPricingRootURL}/5bb7aa1d3cf24d041823b9d4/`;
  }

  return sisenseData;
};

const getZendeskValuesForAppData = cfg => {
  const zendeskConfig = cfg.zendesk;

  if (!zendeskConfig) throw new Error('No zendesk config provided');

  return {
    domain: zendeskConfig.domain,
    cookieName: zendeskConfig.cookieName,
    cookieDomain: zendeskConfig.cookieDomain,
    cookieExpirationDays: zendeskConfig.cookieExpirationDays,
    urlCreateTicket: zendeskConfig.urlCreateTicket,
    urlHelpCenter: zendeskConfig.urlHelpCenter,
    learnMoreLeaseStartPreceedUnitAvailability: zendeskConfig.learnMoreLeaseStartPreceedUnitAvailability,
    refreshPrivateContentTokenPeriod: zendeskConfig.refreshPrivateContentTokenPeriod,
  };
};

const getAppData = (cfg, { tenantName, tenantSettings, marketRentRange, partySettings, envHostPart }) => {
  const { sisense: { domain: sisenseDomain } = {} } = cfg;
  const appData = {
    smsTemplateNameMap: cfg.smsTemplateNameMap,
    rentapp: cfg.rentapp,
    zendeskConfig: {
      ...getZendeskValuesForAppData(cfg),
    },
    sisenseConfig: {
      ...getSisenseValuesForAppData(cfg, tenantName),
    },
    fullStoryConfig: cfg.fullStory,
    tenantSettings,
    marketRentRange,
    partySettings,
    forbiddenLegalNames: cfg.app.party.forbiddenLegalNames,
    tenantName,
    isPublicEnv: cfg.isPublicEnv,
    isDevelopment: cfg.isDevelopment,
    domainSuffix: cfg.domainSuffix,
    reverseProxyUrl: cfg.reverseProxy.url,
    rpImageToken: cfg.rpImageToken,
    cloudEnv: cfg.cloudEnv,
    cloudinaryCloudName: cfg.cloudinaryCloudName,
    urls: {
      ...cfg.pagePaths,
      reportingSignIn: combine('https', sisenseDomain, '/app/account#/login'),
      rentappSignIn: `https://application.${envHostPart}`,
      walkMeScriptURL: cfg?.walkMe?.scriptURL,
    },
  };

  return appData;
};

const isAPIDomain = hostname => ((hostname && hostname.split('.')[0].toLowerCase()) || '') === 'api';

const parseUserAndPassword = (authHeader = '') => {
  const buffer = Buffer.from(authHeader.split(' ')[1], 'base64');
  const [username, password] = buffer.toString().split(':');

  return { username, password };
};

const validcredentials = header => {
  const { username, password } = parseUserAndPassword(header);
  // temporary solution. Basic auth will be removed so for now
  // we're ok with hardcoded values
  return username === 'admin' && password === '!rev@tech!';
};

const checkForAuth = (req, res) => {
  const { authorization } = req.headers;

  if (!authorization || !validcredentials(authorization)) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure area"');
    res.send('<html><body>Secured area. Credentials required</body></html>');
    return false;
  }

  return true;
};

const registerWidgetTestPath = (app, { isProdEnv } = {}) => {
  if (isProdEnv) return; // do not expose widget in prod environment

  const tokensPerTenant = new Map();

  const getWidgetTestRoute = ({ old } = {}) => async (req, res, next) => {
    try {
      const host = req.get('Host');
      const [possibleTenantName, ...hostParts] = host.split('.');

      let token = tokensPerTenant.get(possibleTenantName);

      if (!token) {
        const { createSelfServeToken } = require('../common/server/token-helper'); // eslint-disable-line global-require
        token = await createSelfServeToken(possibleTenantName, hostParts.join('.'));
        tokensPerTenant.set(possibleTenantName, token);
      }

      const { SelfServe } = require('./views/self-serve'); // eslint-disable-line global-require

      await doRender(SelfServe, { req, props: { old, token, host, cloudEnv: config.cloudEnv }, next, res });
    } catch (err) {
      logger.error({ err }, 'error rendering widgetTest route');
      next(err);
    }
  };

  app.get('/widgetTest', getWidgetTestRoute({ old: true }));

  app.get('/websiteUtilsTest', getWidgetTestRoute());
};

const registerRasaTestPath = (app, { isProdEnv } = {}) => {
  if (isProdEnv) return; // do not expose widget in prod environment

  const getCaiServerHost = (localOnly = false) => {
    if (localOnly) {
      return `http://localhost:${config.caiPort}`;
    }
    return config.domain !== 'localhost' ? `https://cai.${config.domain}` : `https://${config.domain}:${config.caiPort}`;
  };

  const getRasaTestRoute = () => async (req, res, next) => {
    try {
      const host = req.get('Host');
      const { Rasa } = require('./views/rasa'); // eslint-disable-line global-require
      const webChat = {
        socketUrl: getCaiServerHost(),
      };
      await doRender(Rasa, { req, props: { host, cloudEnv: config.cloudEnv, webChat }, next, res });
    } catch (err) {
      logger.error({ err }, 'error rendering cai Test route');
      next(err);
    }
  };

  app.get('/cai', getRasaTestRoute());
};

const registerIndexPath = (app, { isDevelopment } = {}) => {
  app.use(ignoreBot, async (req, res, next) => {
    if (isAPIDomain(req.hostname)) {
      if (!checkForAuth(req, res)) {
        return;
      }
      await renderApiDocs(res);
      return;
    }

    logger.trace('serving index content');

    const host = req.get('Host');
    let response;

    try {
      response = await getTenantConfig(host);
    } catch (error) {
      if (error.status === 400 && error.response.body.token === 'INVALID_TENANT') {
        logger.warn({ error }, 'Invalid tenant');
        res.status(404);
        await renderPage404({ req, res, next });
        return;
      }
      next(error);
      return;
    }

    if (!response) {
      next(new Error('No tenantConfig received'));
      return;
    }

    const doesPathExist = await pathExists(req.path);
    if (!doesPathExist) {
      logger.warn({ path: req.path }, 'path not found');
      res.status(404);
      await renderPage404({ req, res, next });
      return;
    }

    const parts = host.split('.');
    parts.shift();

    const envHostPart = parts.join('.');
    const appData = getAppData(config, { ...response, envHostPart });

    const { jsAssets, cssAssets, getStaticResource } = await getAssets({
      host,
      query: req.query,
      useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
      jsManifests: [
        path.join(__dirname, `../static/${distFolderName}/vendors-leasing-manifest.json`),
        path.join(__dirname, `../static/${distFolderName}/vendors-manifest.json`),
        path.join(__dirname, `../static/${distFolderName}/polyfills-manifest.json`),
        path.join(__dirname, `../static/${distFolderName}/main-manifest.json`),
      ],
      cssFiles: ['vendors.css', { name: 'main.css', skipInDev: true }],
      jsFiles: [
        // The following line should be uncommented to use our copy of plivo sdk,
        // and the line '//cdn.plivo.com/sdk/browser/v2/plivo.min.js' 10-15 lines below should be commented out.
        // { name: 'libs/plivo/plivo_20180815.js', dev: false, skipResolver: true },
        'vendors.js',
        'vendorsLeasing.js',
        { name: 'main.js', dev: true },
      ],
    });

    const { translator } = req.i18n || {};

    const props = {
      appData,
      jsAssets: [
        getStaticResource('polyfills.js'),
        { src: '//cdn.plivo.com/sdk/browser/v2/plivo.min.js', crossOrigin: undefined },
        `/config${req.query.min === 'false' ? '?min=false' : ''}`,
        ...jsAssets,
      ],
      cssAssets,
      title: translator ? translator.translate('APP_TITLE') : '',
      cloudEnv: config.cloudEnv,
    };

    await doRender(Index, { props, req, res, next });
  });
};

const main = async () => {
  const app = new Express();

  app.use(noIndexRobotsHeader());

  const { isDevelopment, isProdEnv } = config;
  const includeComponentsDemo = envVal('INCLUDE_COMPONENTS_DEMO', true);

  const webpackConfigPath = ['../webpack/webpack-config', '../webpack/webpack-pages'];

  if (includeComponentsDemo) {
    webpackConfigPath.push('../webpack/webpack-components-demo');
  }

  const server = await createServer(app, {
    serviceName: 'Leasing',
    logger,
    baseDir: __dirname,
    pathToFavicons: path.resolve(__dirname, '../resources/favicons'),
    config,
    webpackConfigPath,
    pathToStatic: '../static/',
    setHeadersForStaticContent: (res, assetPath) => {
      if (assetPath.match(/thirdparty\//)) {
        res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
      }
    },
    includeWSURLInConfigResponse: true,
    serverPortField: 'port',
    errorHandler: async (err, req, res, next) => {
      const serverError = formatError(err, { isProdEnv, logger });
      res.status(500);
      await renderCommonPage(ErrorPage, { res, props: { serverError }, req, next });
    },
  });

  registerWidgetTestPath(app, { isProdEnv });
  registerRasaTestPath(app, { isProdEnv });
  registerCommonPaths(app, config.pagePaths);
  includeComponentsDemo && registerComponentsDemoPath(app, { isDevelopment });
  registerIndexPath(app, { isDevelopment });

  server.start();
};

main().catch(reason => logger.error({ reason }, 'Error starting leasing server'));
