#!/usr/bin/env node
/* eslint-disable global-require */
require('../common/source-maps-register');

function main() {
  require('@babel/polyfill');
  require('../common/catchUncaughtException');

  const logger = require('../common/helpers/logger').default;

  const config = require('../server/decision_service/config').default;

  const { port: decisionApiPort } = config;
  if (!decisionApiPort) {
    logger.fatal('No "decisionApiPort" environment variable has been specified');
    return;
  }

  const apiModule = require('../server/decision_service/api').default;

  const server = apiModule.listen(decisionApiPort, err => {
    if (err) {
      logger.fatal({ err }, `Decision API failed to start on port ${decisionApiPort}`);
      return;
    }

    logger.info(`Decision API is running on port ${decisionApiPort}`);
  });

  const { setServerTimeout } = require('../common/server/server-timeout');
  setServerTimeout(server);

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
