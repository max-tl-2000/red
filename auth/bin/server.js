#!/usr/bin/env node
'use strict';
require('../../common/source-maps-register');

function main() {
  require('../server/server'); // eslint-disable-line global-require
}

main();
