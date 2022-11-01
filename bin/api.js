#!/usr/bin/env node
require('../common/source-maps-register');

function main() {
  require('@babel/polyfill');
  require('../common/catchUncaughtException');

  const logger = require('../common/helpers/logger').default;
  const { getTimer } = require('../resources/timer');

  const config = require('../server/config').default;

  const stopTimer = getTimer('api', logger);

  const { init: initCloudinaryHelpers } = require('../common/helpers/cloudinary');

  if (!config.apiPort) {
    logger.fatal('No "apiPort" environment variable has been specified');
    return;
  }

  const { processDBEvents, default: app } = require('../server/api/api');

  initCloudinaryHelpers({ cloudName: config.cloudinaryCloudName });

  processDBEvents().catch(rej => {
    logger.fatal({ error: rej }, 'Unable to install DB event listener - process will exit!');
    process.exit(1); // eslint-disable-line
  });

  const server = app.listen(config.apiPort, err => {
    if (err) {
      logger.fatal({ err }, `API failed to start on port ${config.apiPort}`);
      return;
    }

    logger.info(`API is running on port ${config.apiPort}`);
    stopTimer();
  });

  const { setServerTimeout } = require('../common/server/server-timeout');
  setServerTimeout(server);

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
