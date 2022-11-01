#!/usr/bin/env node
/* eslint-disable global-require */
require('../common/source-maps-register');

function main() {
  require('../server/server');

  const { initProfiler } = require('../common/server/profiler/main');
  initProfiler();
}

main();
