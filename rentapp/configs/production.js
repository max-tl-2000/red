/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';
import { commonConfig } from '../../common/server-config';

const cloudEnv = process.env.CLOUD_ENV;
const domainEnv = process.env.DOMAIN;
const cloudEnvIsProd = cloudEnv === 'prod' || /staging.*$/.test(cloudEnv);

const hostnameForEnv = (baseHostname, isAptexxCallback = false) => {
  if (cloudEnvIsProd) {
    if (!domainEnv) throw new Error('DOMAIN must be set in prod environments!');
    return `${baseHostname}.${domainEnv}`;
  }

  if (isAptexxCallback) return 'rp.reva.tech';

  return domainEnv ? `${baseHostname}.${domainEnv}` : `${baseHostname}.local.env.reva.tech`;
};

const aptexxCallbackHostname = hostnameForEnv('application', true);
const rpApiToken = envVal('API_TOKEN', '{your-reverse-proxy-api-token}');

// These are parameters that are attached to the URL that Aptexx sends payment notifications to.
// They ONLY contain information needed to route from the rp to the target environment.
// The rest of the information is included in the body of the notification from Aptexx
const paymentCallbackParams = cloudEnvIsProd ? '' : `env=${cloudEnv}&api-token=${rpApiToken}&tenant=application`;
const applicationDomain = hostnameForEnv('application');
const applicationBaseUrl = `https://${applicationDomain}`;

// TODO: remove this when we have real accounts set up!
const useOverrideSandboxTargetIds = !cloudEnvIsProd;

const config = {
  ...commonConfig,
  serverPort: envVal('RENTAPP_PORT', 3500),
  apiPort: envVal('API_PORT', 3030),
  i18nDebug: envVal('I18N_DEBUG', false),
  payment: {
    callback: {
      baseUrl: envVal('PAYMENT_CALLBACK_BASE_URL', `https://${aptexxCallbackHostname}/api/webhooks/paymentNotification`),
      urlParams: paymentCallbackParams,
    },
    tokenExpires: '2 days', // use long strings
    applicationDomain,
  },
  aptexx: {
    testHostname: 'sandbox.aptx.cm',
    productionHostname: 'api.aptx.cm',
    productionApiKey: envVal('APTEXX_KEY', 'MUST_SET_APTEXX_KEY_VIA_ENVIRONMENT'),
    testApiKey: '{your-aptexx-test-api-key}',
    endpointPath: '/endpoint/service/api-v1/',
    useOverrideSandboxTargetIds: envVal('OVERRIDE_SANDBOX_TARGET_IDS', useOverrideSandboxTargetIds),
    targetAccountName: envVal('TARGET_ACCOUNT_NAME', 'Test 1'),
    successUrl: envVal('PAYMENT_SUCCESS_URL', `${applicationBaseUrl}/payment-success.html`),
    cancelUrl: envVal('PAYMENT_CANCEL_URL', `${applicationBaseUrl}/payment-cancel.html`),
  },
  fadv: {
    testUrl: 'https://qa.xmlportal.residentdata.com/residentscreening/xmlPostRequest',
    ctUrl: 'https://ct.xmlportal.residentdata.com/residentscreening/xmlPostRequest',
    uatUrl: 'https://uat.xmlportal.residentdata.com/residentscreening/xmlPostRequest',
    productionUrl: 'https://xmlportal.residentdata.com/residentscreening/xmlPostRequest',
    xmlRequestTemplate: 'fadv-request-template.xml',
    fakeResponseEndpoint: `${applicationBaseUrl}/api/webhooks/screeningResponse`,
    screeningValidationInterval: {
      minTime: 12, // hours
      maxTime: 48, // hours
    },
    pollScreeningUnreceivedResponsesInterval: {
      minTime: 0, // hours
      maxTime: 48, // hours
    },
    longRunningScreeningRequestsInterval: {
      minTime: 10, // minutes
      maxTime: 20, // minutes
    },
    newRequestThreshold: envVal('FADV_NEW_REQUEST_THRESHOLD', 5),
    apiRequestTimeout: envVal('FADV_API_REQUEST_TIMEOUT', 1), // minutes
    rentData: {
      rent: 1000,
      leaseTermMonths: 12,
      deposit: 0,
    },
    minOrphanedScreeningResponseAge: 1, // minutes
  },
  usps: {
    baseUrl: envVal('USPS_BASE_URL', 'https://secure.shippingapis.com'),
    endpointPath: envVal('USPS_ENDPOINT_PATH', 'ShippingAPI.dll'),
    userId: envVal('USPS_USER_ID', 'your_usps_user_id'),
    addressInformationEnabled: envVal('USPS_ADDRESS_INFORMATION_ENABLED', false),
    addressStandardizationXmlRequestTemplate: 'usps-address-standardization-request-template.xml',
    cityStateLookupXmlRequestTemplate: 'usps-city-state-lookup-request-template.xml',
  },
};

module.exports = config;
