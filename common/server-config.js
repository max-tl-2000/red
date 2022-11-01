/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from './helpers/env-val';
import { process } from './helpers/globals';

const getScriptBasedOnTarget = (target = 'test') => {
  const prefix = 'https://cdn.walkme.com/users/{your-walkme-key}';
  if (target === 'prod') return `${prefix}/walkme_{your-walkme-key}_https.js`;
  if (target === 'test') return `${prefix}/test/walkme_{your-walkme-key}_https.js`;

  // target === none or any other value
  return '';
};

// this has been moved here so the pubSubConn does not need to import the workers config
// because that module will create db connections as soon as it is required
const rabbitmqHost = envVal('AMQP_HOST', 'amqp://localhost');
const cloudEnv = process.env.CLOUD_ENV;

const walkMeTarget = envVal('WALK_ME_TARGET', 'test');

const walkMeScriptURL = getScriptBasedOnTarget(walkMeTarget);
const localDomain = 'local.env.reva.tech';
const domain = envVal('DOMAIN', localDomain);

const isProdEnv = cloudEnv === 'prod';
const isLocalEnv = cloudEnv.startsWith('cucumber') || domain === localDomain;

const corticonEnvServer = isLocalEnv ? 'local' : cloudEnv;
const corticonHostname = isProdEnv ? 're.reva.tech' : 're.dev.env.reva.tech';
const corticonServerUrl = envVal('CORTICON_SERVER_URL', `https://${corticonHostname}/${corticonEnvServer}`);

const decisionServiceHostname = envVal('DECISION_API_HOST', 'localhost');
const exportServiceHostname = envVal('EXPORT_API_HOST', 'localhost');
const decisionApiPort = envVal('DECISION_API_PORT', 3070);
const exportPort = envVal('EXPORT_PORT', 3080);

export const commonConfig = {
  rabbitmqHost,
  rabbitmqHeartbeat: envVal('RABBITMQ_HEARTBEAT', 60),

  // server default timeout for requests
  serverDefaultTimeout: Number.parseInt(envVal('REVA_SERVER_DEFAULT_TIMEOUT', 5 * 60 * 1000), 10), // 5 mins

  // default timeout for keepAlive setting
  serverKeepAliveTimeout: Number.parseInt(envVal('REVA_SERVER_DEFAULT_KEEP_ALIVE_TIMEOUT', 62 * 1000), 10), // 62 secons

  // default timeout for sending headers
  serverHeadersTimeout: Number.parseInt(envVal('REVA_SERVER_HEADER_TIMEOUTS', 63 * 1000), 10), // 63
  cloudEnv,
  walkMe: {
    scriptURL: walkMeScriptURL,
  },
  apiHost: envVal('API_HOST', 'localhost'),
  wsHost: envVal('WS_HOST', 'localhost'),
  apiPort: envVal('API_PORT', 3030),
  wsPort: envVal('WS_PORT', 3040),
  caiPort: envVal('CAI_PORT', 5005),
  exportPort,
  decisionApiPort,
  domain,
  isDevelopment: domain === localDomain,
  cloudinaryCloudName: envVal('CLOUDINARY_CLOUD_NAME', 'revat'),
  auth: {
    maxLoginAttempts: 5,
    resetAttemptsTimeout: 10, // minutes to reset the login attempts
    secret: envVal('JWT_SECRET', '{default-jwt-secret}'),
    encryptionKey: envVal('JWT_ENCRYPTION_KEY', '{default-jwt-encryption-key}'),
    longEncryptionKey: envVal('LONG_JWT_ENCRYPTION_KEY', '{default-jwt-encryption-key}'),
    expiresIn: '2', // Used for JWT Token, number of days (excluding current day) to keep the token valid
    algorithm: 'HS256',
    encryptionAlgorithm: 'AES-256-CTR',
    encryptionAlgorithmKeySize: 32,
    encryptionAlgorithmIvSize: 16,
    commonSchema: 'admin',
    anonymousEmailPrefix: 'anon',
  },
  university: {
    isUniversityEnv: envVal('IS_UNIVERSITY_ENV', false),
    secret: envVal('UNIVERSITY_SECRET', '{default-uuid-university-secret}'),
    universityDomain: envVal('UNIVERSITY_DOMAIN', 'local.env.reva.tech'),
  },
  // TODO: check if this really belongs to common
  pagePaths: {
    privacy: 'privacy',
    termsOfService: 'tos',
  },
  // TODO: this is here because fake provider in rentapp needs access to it too...
  // we should isolate this requirement somehow...
  fadvCommon: {
    apiToken: envVal('FADV_API_TOKEN', '{your-fadv-api-token}'),
  },
  googleMaps: {
    apiKey: envVal('GOOGLEMAPS_API_KEY', '{your-googlemaps-api-key}'),
    dstTime: envVal('GOOGLEMAPS_DST_TIME', '1430507654'),
    host: envVal('GOOGLEMAPS_HOST', 'https://maps.googleapis.com'),
    timeout: 10000,
    api: {
      geolocation: envVal('GOOGLEMAPS_API_GELOCATION', '/maps/api/geocode/json'),
      timezone: envVal('GOOGLEMAPS_API_TIMEZONE', '/maps/api/timezone/json'),
    },
  },
  rentapp: {
    encryptionKey: envVal('RENTAPP_ENCRYPTION_KEY', '{your-uuid-rentapp-encryption-key}'),
    oldEncryptionKey: envVal('OLD_RENTAPP_ENCRYPTION_KEY'),
  },
  resident: {
    emailEncryptionKey: envVal('RESIDENT_EMAIL_ENCRYPTION_KEY', '{your-uuid-resident-email-encryption-key}'),
    encryptionKey: envVal('RESIDENT_ENCRYPTION_KEY', '{your-uuid-resident-encryption-key}'),
    emailJwtSecret: envVal('RESIDENT_EMAIL_JWT_SECRET', '{your-uuid-resident-email-jwt-secret}'),
    jwtSecret: envVal('RESIDENT_JWT_SECRET', '{your-uuid-resident-jwt-secret}'),
    deviceApi: envVal('RXP_API_TOKEN', '{your-rxp-api-token}'),
    webhookJwtSecret: envVal('RESIDENT_WEBHOOK_JWT_SECRET', '{your-uuid-resident-webhook-jwt-secret}'),
    webhookEncryptionKey: envVal('RESIDENT_WEBHOOK_ENCRYPTION_KEY', '{your-uuid-resident-webhook-encryption-key}'),
  },
  tenantSettings: {
    encryptionKey: envVal('TENANT_SETTINGS_ENCRYPTION_KEY', '{your-uuid-tenant-settings-encryption-key}'),
  },
  dbProfiling: {
    enabled: envVal('REVA_DB_PROFILING_ENABLED', true),
    longReport: envVal('REVA_DB_PROFILING_LONG_REPORT', false),
    logMissingKnexInCtx: envVal('REVA_DB_PROFILING_LOG_MISSING_KNEX_IN_CTX', false),
  },
  ctxCache: {
    isCtxCacheEnabled: envVal('ENABLE_CONTEXT_CACHE', true),
    shouldLogCtxCache: envVal('SHOULD_LOG_CONTEXT_CACHE', true),
  },
  corticonServerUrl,
  decisionApiUrl: `http://${decisionServiceHostname}:${decisionApiPort}`,
  exportApiUrl: `http://${exportServiceHostname}:${exportPort}`,
};
