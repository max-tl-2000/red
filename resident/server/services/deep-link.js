/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { join } from 'path';
import { getPropertySettingsByPropertyId } from '../dal/property-repo';
import config from '../../config';
import { combinePaths } from '../../../common/server/combine-paths';
import { ServiceError } from '../../../server/common/errors';
import loggerInstance from '../../../common/helpers/logger';

import { addParamsToUrl } from '../../../common/helpers/urlParams';
import { HTML_REPLACE_MATCHER, INVALID_ANDROID_PACKAGE_NAME_CHARACTERS } from '../../../common/regex';
import { withCachedPromise } from '../../../common/helpers/with-cached-promise';
import { read } from '../../../common/helpers/xfs';

const logger = loggerInstance.child({ subType: 'deepLink' });

const getAppData = app => {
  const { scheme } = app || {};

  if (!scheme) {
    throw new ServiceError({ token: 'MISSING_APP_DATA', data: { scheme } });
  }

  const { cloudEnv, isProdEnv, cloudEnvAlias } = config;

  const formattedCloudEnv = (cloudEnvAlias ?? cloudEnv).replace(INVALID_ANDROID_PACKAGE_NAME_CHARACTERS, '');
  const appScheme = isProdEnv ? scheme : `${scheme}-${formattedCloudEnv}`;

  return {
    appScheme,
  };
};

const generateWebUrl = (urlPath, queryParams, webQueryParams) => {
  queryParams = queryParams || {};
  const params = { ...queryParams, ...webQueryParams };

  const { residentDomain, expoDevelopmentMode, expoDevelopmentWebURL } = config;
  if (expoDevelopmentMode && expoDevelopmentWebURL) {
    return addParamsToUrl(`http://${combinePaths(expoDevelopmentWebURL, urlPath)}`, params);
  }
  return addParamsToUrl(`https://${combinePaths(residentDomain, urlPath)}`, params);
};

const readDeepLinkHTML = withCachedPromise(async () => {
  const html = await read(join(__dirname, './resources/deep-link.html'));
  return html;
});

const renderHTML = async (args, metadata = {}) => {
  const text = await readDeepLinkHTML();

  const getValueFromArgs = token => {
    const val = args[token];
    if (!val) {
      logger.trace({ ...metadata, token }, `Missing token ${token}`);
      return '';
    }
    return val;
  };

  return text.replace(HTML_REPLACE_MATCHER, (_, token) => getValueFromArgs(token));
};

export const handleDeepLink = async (ctx, { tenantId, propertyId, path, getApp, queryParams, webQueryParams = {} }) => {
  const { expoDevelopmentMode, expoDevelopmentURL } = config;

  let mobileAppURL = '';
  let appStoreUrl = '';
  let playStoreUrl = '';

  const { settings = {} } = await getPropertySettingsByPropertyId({ ...ctx, tenantId }, propertyId);
  const { rxp } = settings;

  const webUrl = generateWebUrl(path, queryParams, webQueryParams);

  if (rxp?.app?.scheme) {
    const { app } = rxp || {};

    if (getApp) {
      if (!app.appStoreUrl) {
        throw new ServiceError({ token: 'MISSING_PARAM_APP_STORE_URL', status: 400 });
      }
      if (!app.name) {
        throw new ServiceError({ token: 'MISSING_PARAM_APP_NAME', status: 400 });
      }
      appStoreUrl = `&getAppUrl=${encodeURIComponent(app.appStoreUrl)}&appName=${app.name}`;
      playStoreUrl = `&getAppUrl=${encodeURIComponent(app.playStoreUrl)}&appName=${app.name}`;
    }

    const { appScheme } = getAppData(app);

    // To properly interpolate the path inside the app
    // we need to ensure we don't have a trailing slash otherwise the interpolation will be very messy
    path = path.replace(/^\//, '');

    mobileAppURL = expoDevelopmentMode ? combinePaths(`exp://${expoDevelopmentURL}`, `--/${path}`) : `${appScheme}:///${path}`;

    if (queryParams) {
      mobileAppURL = addParamsToUrl(mobileAppURL, queryParams);
    }
  }

  // TODO: should sniffing be done on the server side? that way we can serve the proper template for each env
  // instead of trying to send a single HTML for all cases
  logger.trace({ ctx, propertyId, webUrl, mobileAppURL }, 'handleDeepLink');

  const html = await renderHTML({ webUrl, playStoreUrl, appStoreUrl, mobileAppURL }, { ctx, propertyId });

  return { html };
};
