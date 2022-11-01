#!/usr/bin/env node
/* eslint-disable global-require */
require('../common/source-maps-register');

function main() {
  require('@babel/polyfill');
  require('../common/catchUncaughtException');
  require('../server/socket/socketServer').runServer();

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
