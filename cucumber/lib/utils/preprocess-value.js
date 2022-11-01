/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from '../../../common/helpers/trim';
import { addAlias } from './addAlias';
import genShortId from './gen-short-id';
import config from '../../config';

const preprocessValue = (val, testId) => {
  if (typeof val === 'object') {
    // this will also handle null
    throw new TypeError('Value should be a string');
  }
  val = trim(val);

  if (!val) {
    return val;
  }

  const commandRegex = /__(.*)\((.*)\)/;
  const match = val.match(commandRegex);

  if (!match) {
    return val;
  }

  const [
    input, // eslint-disable-line
    command,
    args,
  ] = match;

  if (command === 'randomEmail') {
    const uniqueId = genShortId();
    return addAlias(args, uniqueId);
  }
  if (command === 'testEmail') {
    return addAlias(args, testId);
  }
  if (command === 'checkIfLocal') {
    const isNotLocalRun = /^cucumber/i.test(config.cloudEnv);
    const email = isNotLocalRun ? args : `${config.cloudEnv}@reva.tech`;
    return addAlias(email, testId);
  }
  throw new Error(`Unknown command ${command}`);
};

export default preprocessValue;
