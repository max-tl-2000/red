/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import logger from '../../../common/helpers/logger';

export const deepEqual = (received, expected) => {
  try {
    expect(received).to.deep.equal(expected);
  } catch (error) {
    logger.error({ error, received, expected }, 'Array comparison failed');
    throw error; // just forward the error
  }
};
