/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import { decryptWithKey } from '../../common/server/crypto-helper';

const argv = minimist(process.argv.slice(2));
const { token, key } = argv;

const main = async () => {
  if (!token) {
    throw new Error('Missing token');
  }
  if (!key) {
    throw new Error('Missing key');
  }
  console.log(decryptWithKey(token, key));
};

main().catch(err => console.error('[ERROR]:', err));
