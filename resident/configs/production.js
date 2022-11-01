/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';
import { isPublicEnv } from '../../common/server/create-config';

const localDomain = 'local.env.reva.tech';
const domain = envVal('DOMAIN', localDomain);
const cloudEnv = process.env.CLOUD_ENV;
const isProdEnv = cloudEnv === 'prod';
const residentHostname = envVal('RESIDENT_HOSTNAME', 'resident');
const isLocalDB = cloudEnv.startsWith('cucumber') || domain === localDomain;

const rpToken = envVal('API_TOKEN', '{your-api-token}');

const residentDomain = `${residentHostname}.${domain}`;
const paymentMethodWebhookPath = '/resident/api/webhooks/paymentMethods';
const paymentMethodCallbackUrl = isPublicEnv(cloudEnv)
  ? `https://${residentDomain}${paymentMethodWebhookPath}`
  : `https://rp.reva.tech${paymentMethodWebhookPath}?env=${cloudEnv}&api-token=${rpToken}`;

const config = {
  domain,
  cloudEnv,
  residentDomain,
  isProdEnv,
  cloudEnvAlias: null,
  isDevelopment: isLocalDB,
  residentHostname,
  registrationUrl: envVal('RESIDENT_REGISTRATION_URL', '/auth/registration'),
  signInPasswordUrl: envVal('RESIDENT_SIGN_IN_PASSWORD_URL', '/auth/signInPassword'),
  expoDevelopmentURL: envVal('EXPO_DEVELOPMENT_URL', '127.0.0.1:19000'),
  expoDevelopmentWebURL: envVal('EXPO_DEVELOPMENT_URL', 'localhost:19006'),
  expoDevelopmentMode: envVal('EXPO_DEVELOPMENT_MODE', false),
  aptexx: {
    testHostname: envVal('APTEXX_TEST_HOSTNAME', 'sandbox.aptx.cm'),
    productionHostname: envVal('APTEXX_HOSTNAME', 'api.aptx.cm'),
    productionApiKey: envVal('APTEXX_KEY', 'MUST_SET_APTEXX_KEY_VIA_ENVIRONMENT'),
    testApiKey: envVal('APTEXX_TEST_KEY', '{your-aptexx-test-api-key}'),
    endpointPath: envVal('APTEXX_ENDPOINT_PATH', '/endpoint/service/api-v1/'),
    aptexxTimeout: envVal('APTEXX_TIMEOUT', 60000),
    paymentMethodCallbackUrl: envVal('APTEXX_PAYMENT_METHOD_CALLBACK_URL', paymentMethodCallbackUrl),
  },
};

module.exports = config;
