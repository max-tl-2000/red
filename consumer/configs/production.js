/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';
import { commonConfig } from '../../common/server-config';

// TODO: move these into a rentapp-specific key!
const cloudEnv = process.env.CLOUD_ENV;
const aptexxCallbackHostname = cloudEnv === 'prod' ? 'application.reva.tech' : 'rp.reva.tech';
const rpApiToken = envVal('API_TOKEN', '{your-api-token}');
const aptexxCallbackParams = cloudEnv === 'prod' ? '' : `env=${cloudEnv}&api-token=${rpApiToken}&tenant=application`;
const isCI = process.env.CI === 'true';
const localDomain = 'local.env.reva.tech';
const domain = envVal('DOMAIN', localDomain);

const config = {
  ...commonConfig,
  isCI,
  rpImageToken: envVal('RP_IMAGE_TOKEN', '{your-reverse-proxy-image-token}'),
  cloudEnv,
  domain,
  reverseProxyUrl: 'https://rp.reva.tech',
  serverPort: envVal('CONSUMER_PORT', 4000),
  i18nDebug: envVal('I18N_DEBUG', false),
  roommates: {
    googleAnalytics: {
      reva: '{your-ga-tracking0number}',
    },
  },
  // TODO: move these into a rentapp-specific key!
  aptexx: {
    testHostname: envVal('APTEXX_HOSTNAME', 'test-api.aptx.cm'),
    productionHostname: envVal('APTEXX_HOSTNAME', 'api.aptx.cm'),
    protocol: envVal('APTEXX_PROTOCOL', 'https://'),
    endpointPath: envVal('APTEXX_ENDPOINT', '/endpoint/service/api-v1/'),
    apiKey: envVal('APTEXX_KEY', '{your-aptexx-key}'),
    targetId: envVal('APTEXX_TARGET_ID', 12007954),
    contentType: envVal('APTEXX_CONTENT_TYPE', 'application/json'),
    callback: {
      baseUrl: envVal('PAYMENT_CALLBACK_BASE_URL', `https://${aptexxCallbackHostname}/api/webhooks/fakeApplicationPayment?`),
      urlParams: aptexxCallbackParams,
    },
    successUrl: envVal('PAYMENT_SUCCESS_URL', 'https://application.reva.tech/static/success'),
    cancelUrl: envVal('PAYMENT_CANCEL_URL', 'https://application.reva.tech/static/cancel'),
  },
  fullStory: {
    refreshPeriod: 600000,
    debugMode: false,
    host: 'fullstory.com',
    org: envVal('FULLSTORY_ORG', ''),
    namespace: 'FS',
    includeAllConsumer: envVal('FULLSTORY_INCLUDE_CONSUMER', false),
  },
  webUtils: {
    authToken: envVal('WEBUTILS_TOKEN','{token-created-from-admin-console}'),
    tenantHost: envVal('WEBUTILS_TENANT_HOST', 'https://cucumber.local.env.reva.tech'),
    googleMapsToken: envVal('WEBUTILS_GOOGLE_MAPS_TOKEN', '{your-google-maps-token}'),
    googleTagManagerId: envVal('WEBUTILS_GOOGLE_TAG_MANAGER_ID', '{your-gtm-id}'),
  },
};

module.exports = config;
