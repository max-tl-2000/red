#!/usr/bin/env node
/* eslint-disable no-process-exit */

const validate = require('../server/api/validate-apidoc').default;
const warnOnly = process.argv.indexOf('--warn-only') > -1;

validate(warnOnly)
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    process.exit(1);
    console.error('validate-apidoc-error', error);
  });
