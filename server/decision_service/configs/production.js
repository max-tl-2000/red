/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { process } from '../../../common/helpers/globals';
import envVal from '../../../common/helpers/env-val';
import { commonConfig } from '../../../common/server-config';

const env = process.env;
const port = envVal('PORT', 3070);

const cloudEnv = env.CLOUD_ENV;
const processName = envVal('RED_PROCESS_NAME', 'decision-service');
const { apiHost, apiPort } = commonConfig;
const publicLeasingAPIUrl = envVal('LEASING_API_URL', `${apiHost}:${apiPort}/public`);
const decisionServiceID = envVal('DECISION_SERVICE_UUID', '{decision-service-uuid-key}');

module.exports = {
  ...commonConfig,
  port,
  cloudEnv,
  processName,
  publicLeasingAPIUrl,
  decisionServiceID,
  logMiddlewareErrors: envVal('LOG_MIDDLEWARE_ERRORS', true),
  rasa: {
    webhookUrl: envVal('RASA_WEBHOOK_URL', '/webhooks/rest/webhook'),
    conversationsUrlPrefix: envVal('RASA_CONVERSATIONS_PREFIX', '/conversations/'),
    newSessionMethod: envVal('RASA_NEW_SESSION_METHOD', '/trigger_intent'),
    domainUrl: envVal('RASA_DOMAIN', 'http://localhost:5005'),
    authToken: envVal('RASA_AUTH_TOKEN', ''),
    intentName: envVal('RASA_INTENT_NAME', 'demo_init'),
  },
};
