/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import config from './config';
import NotFound from './views/not-found';
import { getAssets } from '../common/server/get-assets';
import { renderReactTpl } from '../common/render-react-tpl';
import logger from '../common/helpers/logger';
import envVal from '../common/helpers/env-val';

import { internalSupportedBrowsers, consumerSupportedBrowsers } from '../common/server/browser-detector.ts';
import { getDistFolderName } from '../common/server/dist-folders';

const distFolderName = getDistFolderName();

const consumerPaths = [/^\/publishedQuote/, /^\/privacy/, /^\/tos/];
const isConsumerPath = urlPath => consumerPaths.some(m => urlPath.match(m));

export const renderTplForLeasing = (route, args = {}) => {
  try {
    return renderReactTpl(route, args);
  } catch (err) {
    logger.error({ err, route, supportedBrowsers: args.supportedBrowsers }, 'Error rendering the view template');
    return '';
  }
};

export const doRender = async (Component, { res, req, props = {}, next } = {}) => {
  try {
    const host = req.get('host');
    const parts = host.split('.');
    const tenantName = parts.shift();

    props = {
      envHostPart: parts.join('.'),
      tenantName,
      ...props,
    };

    const supportedBrowsers = isConsumerPath(req.url) ? consumerSupportedBrowsers : internalSupportedBrowsers;

    const content = await renderTplForLeasing(Component, { req, props, supportedBrowsers, next });
    if (!content) {
      next(Error(`No content for route ${req.url}`));
      return;
    }
    res.send(content);
  } catch (error) {
    next(error);
  }
};

export const renderCommonPage = async (Component, { res, req, props, next }) => {
  const { translator } = req.i18n || {};

  const host = req.get('host');
  const { isDevelopment, pagePaths } = config;
  const { getResource, useSelfHostedAssets, assetsHostname } = await getAssets({
    host,
    query: req.query,
    includeDefault: false,
    useDevMode: isDevelopment && !envVal('SKIP_WEBPACK_DEV_SERVER', false),
    jsManifests: [
      path.join(__dirname, `../static/${distFolderName}/vendors-manifest.json`),
      path.join(__dirname, `../static/${distFolderName}/pages-manifest.json`),
    ],
  });

  const minFlag = req.query.min === 'false' ? '?min=false' : '';
  const jsAssets = [`/config${minFlag}`];

  const { sisense: { domain: sisenseDomain } = {} } = config;

  props = {
    host,
    t: translator ? translator.translate.bind(translator) : key => key,
    jsAssets,
    useSelfHostedAssets,
    assetsHostname,
    pagePaths,
    getResource,
    sisenseDomain,
    cloudEnv: config.cloudEnv,
    ...props,
  };

  await doRender(Component, { res, req, next, props });
};

export const renderPage404 = async args => {
  await renderCommonPage(NotFound, args);
};

export const renderOnlyInLocal = async (req, res, next) => {
  const host = req.get('host');

  const isEnvOrLocal = host.match(/\.localhost\./) || host.match(/\.env\./);

  if (!isEnvOrLocal) {
    await renderPage404({ req, res, next });
    return;
  }

  next();
};
