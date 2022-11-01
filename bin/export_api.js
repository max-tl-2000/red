#!/usr/bin/env node
/* eslint-disable global-require */
require('../common/source-maps-register');

function main() {
  require('@babel/polyfill');
  require('../common/catchUncaughtException');

  const logger = require('../common/helpers/logger').default;

  const config = require('../server/config').default;

  const { exportPort } = config;
  if (!exportPort) {
    logger.fatal('No "exportPort" environment variable has been specified');
    return;
  }

  const apiModule = require('../server/export/api').default;

  const server = apiModule.listen(exportPort, err => {
    if (err) {
      logger.fatal({ err }, `The Export API service failed to start on port ${exportPort}`);
      return;
    }

    logger.info(`The Export API service is running on port ${exportPort}`);
  });

  const { setServerTimeout } = require('../common/server/server-timeout');
  setServerTimeout(server);

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
