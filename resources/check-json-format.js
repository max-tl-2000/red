/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import { subtle, ok, error, warn } from './logger';

const exitWithError = () => process.exit(1); // eslint-disable-line

const usage = () => {
  error('Usage: babel-node check-json-format.js [-f] [FILE]...');
  exitWithError();
};

const args = process.argv.slice(2);
let shouldFix = false;

if (args[0] === '-f') {
  subtle('>> Enabling autofix');
  shouldFix = true;
  args.shift();
}

if (!args[0]) {
  usage();
}

let fileToLint = args.shift();

while (fileToLint) {
  subtle(`>> Checking format of ${fileToLint}`);

  const fileContents = fs.readFileSync(fileToLint, 'utf8');
  let obj;
  try {
    obj = JSON.parse(fileContents);
  } catch (err) {
    error(`Unable to parse file: ${err.message}`);
    exitWithError();
  }

  const properFormat = JSON.stringify(obj, null, 2);
  if (fileContents !== properFormat) {
    const msg = `File ${fileToLint} is not formatted properly`;
    warn(`>>${msg}`);
    if (shouldFix) {
      subtle('>> Autofixing as requested');
      fs.writeFileSync(fileToLint, properFormat, 'utf-8');
      ok('>> json file autofixed');
    } else {
      warn(`Please execute: "./bnr lint-json -f ${fileToLint}" to correct.`);
      exitWithError();
    }
  } else {
    ok(`${fileToLint} is formatted correctly`);
  }
  fileToLint = args.shift();
}
