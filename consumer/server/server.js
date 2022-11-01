/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import serveStatic from 'serve-static';
import { t } from 'i18next';

import logger from '../../common/helpers/logger';
import { getAssets, getAssetURL } from '../../common/server/get-assets';

import { renderReactTpl } from '../../common/render-react-tpl';
import config from '../config';

import { simulatePayment, cancelPayment } from '../../rentapp/server/api/actions/aptexx';
import { getTenantAndPropertyIds } from './helpers/tenant-config';
import { handleApplyNow } from '../../rentapp/server/api/actions/apply-now';
import { handleApplicationAdditionalInfo } from '../../rentapp/server/api/actions/application-additional-info';
import {
  detectCommonUserHandler,
  propertyLockApplicationHandler,
  replacePartyIdForMergedParties,
  forbiddenOnCorporateParty,
  detectMultipleApplications,
  replacePersonIdForMergedPerson,
  decodeRentappTokenMiddleware,
} from '../../rentapp/server/api/middleware';
import envVal from '../../common/helpers/env-val';
import trim from '../../common/helpers/trim';
import { createServer } from '../../common/server/common-server';
import { consumerSupportedBrowsers as supportedBrowsers } from '../../common/server/browser-detector.ts';
import { getDistFolderName } from '../../common/server/dist-folders';
import { handleAppointmentAction } from './self-serve-routes';
import { formatError } from '../../common/server/format-error';
import { renderCommonPage } from '../../server/render-helpers';
import ErrorPage from '../../server/views/error';
import { getModuleNameFromHostName, registerWebUtilsRoutes } from './register-web-utils-routes';
import { Routes } from '../../rentapp/common/enums/rentapp-types';
import { setupResidentRoutes } from '../../resident/server/api/resident-api';
import { renderRecommendedBrowsersPage } from './helpers/recommended-browsers';
import { noIndexRobotsHeader } from '../../server/common/middleware';

const distFolderName = getDistFolderName();
const ROOMMATES_APP_NAME = 'Roommates';

// TODO This code is temporary and will be removed
const getGoogleAnalyticsId = ({ tenantName, cloudEnv }) => {
  const googleAnalyticsIds = config.roommates.googleAnalytics;
  return (cloudEnv === 'prod' && googleAnalyticsIds[tenantName]) || googleAnalyticsIds.reva;
};

// Extracts tenant name from a URL like
// TODO improve this to do a pattern matching of only the path part
// https://roommates.local.env.reva.tech/maximus/parkmerced
const extractTenantFromRoommatesURL = url => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const parts = url.split('/');
  return parts.length >= 3 ? parts[3] : '';
};

const getRoommatesGoogleAnalyticsId = req => {
  if (req.hostname.toLowerCase().startsWith('roommates')) {
    // TODO: this should be retrieved from the config
    const cloudEnv = envVal('CLOUD_ENV', 'NOT_DEFINED');
    const tenantName = extractTenantFromRoommatesURL(req.get('Referrer'));
    return getGoogleAnalyticsId({ tenantName, cloudEnv });
  }
  return '';
};

const app = new Express();

const main = async () => {
  const server = await createServer(app, {
    serviceName: 'Consumer',
    logger,
    baseDir: __dirname,
    pathToFavicons: path.resolve(__dirname, '../../resources/favicons'),
    config,
    webpackConfigPath: '../webpack/webpack-config',
    pathToStatic: '../static/',
    includeWSURLInConfigResponse: true,
    errorHandler: async (err, req, res, next) => {
      const { isProdEnv } = config;
      const serverError = formatError(err, { isProdEnv, logger });
      res.status(500);
      await renderCommonPage(ErrorPage, { res, props: { serverError }, req, next });
    },
  });

  app.use(noIndexRobotsHeader());

  setupResidentRoutes(app);

  registerWebUtilsRoutes(app, config);

  const { isDevelopment } = config;

  app.use(serveStatic(path.join(__dirname, '../fake-payment-pages')));

  app.use(serveStatic(path.join(__dirname, '../recommended-browsers')));

  // TODO: move this into rentapp?
  app.get('/applyNow/:rentappToken', handleApplyNow);

  app.get('/recommendedBrowsers', async (req, res) => {
    const mainMessage = t('LOOKING_FOR_BEST_EXPERIENCE');
    const message = t('BROWSERS_RECOMMENDATION_MESSAGE');

    const content = await renderRecommendedBrowsersPage({
      mainMessage,
      message,
    });

    res.set({ 'Content-Type': 'text/html' });
    res.send(content);
  });

  /*
    The next code was suggested by Roy, the issue was about the routing of an API called from the iframe form,
    we can't used the tenant name and/or the environment config, so we created this routes in order to simulate the Aptexx
    and paymentCallback APIs. Theres also a problem using the body parser from here, that's why we used directly in the posts routes.
    TODO: Move this routes to a separate module.
  */
  /* Aptexx Simulation Routes Start */
  const formParser = bodyParser.urlencoded({ extended: true });
  const aptexxRouter = Express.Router(); // eslint-disable-line new-cap

  aptexxRouter.post('/simulatePayment', formParser, async (req, res) => res.send(await simulatePayment(req)));
  aptexxRouter.post('/cancelPayment', formParser, async (req, res) => res.send(await cancelPayment(req)));
  app.use('/aptexx', aptexxRouter);

  /* Aptexx Simulation Routes End */

  const isErrorResponse = errorToken =>
    errorToken === 'INVALID_TENANT' || errorToken === 'INVALID_PROPERTY' || errorToken === 'INVALID_PROPERTY_FOR_GIVEN_TENANT';

  const getPropertyConfig = async pathValues => {
    let propertyConfig = {};

    try {
      propertyConfig = await getTenantAndPropertyIds(pathValues);
    } catch (error) {
      if (error.status === 400 && isErrorResponse(error.response.body.token)) {
        logger.warn({ error }, 'Invalid tenant or property name');
      } else {
        logger.warn({ error }, 'Could not retrieve tenant and property');
      }
    }

    return propertyConfig;
  };

  const selfServeRouter = Express.Router(); // eslint-disable-line new-cap

  selfServeRouter.get('/:action/:appointmentToken', handleAppointmentAction);
  app.use('/appointment', selfServeRouter);

  const getIndexContentForModule = async (module, req) => {
    const moduleNameUpper = module[0].toUpperCase() + module.substring(1);

    const { jsAssets, cssAssets, getStaticResource } = await getAssets({
      host: req.host,
      query: req.query,
      useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
      jsManifests: [
        path.join(__dirname, `../../static/${distFolderName}/polyfills-manifest.json`),
        path.join(__dirname, `../../static/${distFolderName}/vendors-manifest.json`),
        path.join(__dirname, `../static/${distFolderName}/main-manifest.json`),
      ],
      cssFiles: ['vendors.css', { name: `main${moduleNameUpper}.css`, skipInDev: true, local: true }],
      jsFiles: ['vendors.js', { name: `main${moduleNameUpper}.js`, dev: true, local: true }],
    });

    const pagePaths = JSON.stringify(config.pagePaths);

    let appData = {
      pagePaths,
      origin: req.query.origin,
      fullStoryConfig: config.fullStory,
      cloudinaryCloudName: config.cloudinaryCloudName,
      domainSuffix: config.domainSuffix,
      isPublicEnv: config.isPublicEnv,
      isDevelopment,
      reverseProxyUrl: config.reverseProxyUrl,
      rpImageToken: config.rpImageToken,
      cloudEnv: config.cloudEnv,
      buildVersion: config.buildVersion,
      isCI: config.isCI,
      urls: {
        walkMeScriptURL: config?.walkMe?.scriptURL,
      },
    };

    // the review screening page has a middleware that will decode the agent auth token
    // and inject it into the request. If we found it then we pass this info as part of
    // the appData so we can start the walkMe script with that info
    const { _decodedToken } = req;
    if (_decodedToken) {
      const { userEmail: email, userId: id } = _decodedToken;
      if (email && id) {
        appData = {
          ...appData,
          agentInfo: {
            email,
            id,
          },
        };
      }
    }
    // Applies only for roommates application since it's the one that has
    // tenant and property as part of the url
    // roommates.reva.tech/{tenantName}/{propertyName}
    if (moduleNameUpper === ROOMMATES_APP_NAME) {
      const propertyConfig = await getPropertyConfig(req.path);
      const propertyGoogleAnalyticsId = trim(getRoommatesGoogleAnalyticsId(req));
      appData = { ...appData, propertyConfig, propertyGoogleAnalyticsId };

      jsAssets.push(getAssetURL('/libs/googleanalytics/roommates-ga_1494301536.js', req.host));
    }

    const { translator } = req.i18n || {};
    const tpl = require(`../../${module}/views/index`); // eslint-disable-line global-require
    const moduleIndex = tpl.default ? tpl.default : tpl;

    const props = {
      appData: JSON.stringify(appData),
      jsAssets: [getStaticResource('polyfills.js'), `/config${req.query.min === 'false' ? '?min=false' : ''}`, ...jsAssets],
      cssAssets,
      title: translator ? translator.translate(`${module.toUpperCase()}_TITLE`) : '',
      cloudEnv: config.cloudEnv,
    };

    const indexContent = renderReactTpl(moduleIndex, {
      props,
      req,
      supportedBrowsers,
    });
    return indexContent;
  };

  const sendIndexContent = async (req, res) => res.send(await getIndexContentForModule('rentapp', req));

  app.get('/applicationAdditionalInfo/:rentappToken', replacePersonIdForMergedPerson(Routes.additionalInfo), handleApplicationAdditionalInfo, sendIndexContent);

  app.get(
    '/welcome/:rentappToken',
    forbiddenOnCorporateParty,
    replacePartyIdForMergedParties,
    propertyLockApplicationHandler,
    replacePersonIdForMergedPerson(Routes.welcome),
    detectMultipleApplications,
    detectCommonUserHandler,
    sendIndexContent,
  );

  app.get('/partyApplications/:partyId/review/:rentappToken?', decodeRentappTokenMiddleware, sendIndexContent);

  app.get('/notFound', sendIndexContent);

  app.use(async (req, res) => {
    logger.debug('serving index content');

    // TODO: remove this hard-coding
    const HOSTNAME_TO_MODULE = {
      application: 'rentapp',
      roommates: 'roommates',
    };

    const moduleName = getModuleNameFromHostName(req.hostname);

    const theModule = HOSTNAME_TO_MODULE[moduleName] || 'rentapp'; // default to rentapp if host not found in hash

    res.send(await getIndexContentForModule(theModule, req));
  });

  server.start();
};

main().catch(reason => logger.error({ reason }, 'Error starting Consumer service'));

export default app;
