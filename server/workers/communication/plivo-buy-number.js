/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../common/helpers/logger';
import { buyNumber } from './adapters/plivoServiceAdapter';

const main = async () => {
  const number = process.argv[2];
  await buyNumber(number);
};

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while buying number', e);
    process.exit(1); // eslint-disable-line
  });
