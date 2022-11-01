#!/usr/bin/env node
/* eslint-disable global-require */
require('../common/source-maps-register');

function main() {
  require('@babel/polyfill');
  require('../common/catchUncaughtException');

  const consumer = require('../server/workers/consumer');
  const logger = require('../common/helpers/logger').default;
  const config = require('../server/config').default;
  const { init: initCloudinaryHelpers } = require('../common/helpers/cloudinary');

  logger.info('Starting worker...\n  initializing languages');

  process.on('SIGINT', () => logger.info('Ignore SIGINT process signal'));
  process.on('SIGTERM', () => logger.info('Ignore SIGTERM process signal'));

  consumer
    .initLanguages()
    .then(() => {
      logger.info('Starting consumers');
      // const { t } = require('i18next'); // eslint-disable-line
      // console.log('after', t('APP_TITLE')); // uncomment this to test translations were loaded
      initCloudinaryHelpers({ cloudName: config.cloudinaryCloudName });
      consumer.startConsumers();
      logger.info('Consumers have been started');
    })
    .catch(err => logger.error({ err }, 'Unable to start worker!'));

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
