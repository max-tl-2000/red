/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import envVal from '../../common/helpers/env-val';

const databaseHost = envVal('DATABASE_HOST', 'localhost');

module.exports = {
  app: {
    name: 'Core Property Management - Dev',
  },
  mail: {
    emailDomain: 'local.envmail.reva.tech',
  },
  dbProfiling: {
    longReport: envVal('REVA_DB_PROFILING_LONG_REPORT', false),
    logMissingKnexInCtx: envVal('REVA_DB_PROFILING_LOG_MISSING_KNEX_IN_CTX', false),
  },
  knexConfig: {
    connection: {
      host: databaseHost,
      database: 'reva_core',
      user: 'revauser',
      password: envVal('DATABASE_PASSWORD', 'revauser'),
      adminUser: 'revaadmin',
      adminPassword: envVal('DATABASE_ADMINPASSWORD', 'revaadmin'),
      replicationUser: 'revareplication',
      replicationPassword: envVal('DATABASE_REPLICATIONPASSWORD', 'revareplication'),
      role: 'revauser_role',
      charset: 'utf8',
    },
    pool: {
      min: 2,
      max: 50,
    },
    asyncStackTraces: true,
  },
  knexConfigReadOnly: {
    connection: {
      host: envVal('DATABASE_RO_HOST', 'localhost'),
    },
    asyncStackTraces: true,
  },
  aws: {
    accessKeyId: envVal('AWS_ACCESS_KEY_ID', '{your_aws_access_key_id}'),
    secretAccessKey: envVal('AWS_SECRET_ACCESS_KEY', '{your_aws_access_key}+Vz4qqJ6PM'),
    s3AssetsBucket: envVal('AWS_S3_ASSETS_BUCKET', '{your-bucket-prefix}-local-assets'),
    s3PrivateBucket: envVal('AWS_S3_PRIVATE_BUCKET', '{your-bucket-prefix}-local-private'),
    s3ShortenerBucket: envVal('AWS_S3_SHORTENER_BUCKET', '{your-bucket-prefix}-local-urlshortener'),
    s3EncryptionKeyId: envVal('AWS_S3_ENCRYPTION_KEY_ID', '{your-bucket-encryption-key}'),
    efsRootFolder: envVal('EFS_ROOT_FOLDER', path.resolve('uploads', `${process.env.CLOUD_ENV}`, 'tenants')),
  },
  urlShortener: {
    cdn_prefix: envVal('URL_SHORTENER_PREFIX', '{your-cloudfront-domain}'),
  },
  fullStory: {
    org: envVal('FULLSTORY_ORG', ''),
  },
  telephony: {
    queuedOwnedCallersPriority: 10, // seconds
  },
};
