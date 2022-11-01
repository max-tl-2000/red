/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { assert } from 'chai';
import { overrider } from '../../test-helpers';
import * as globals from '../globals';

describe('attempt', () => {
  let attempt;
  let ov;
  const throwError = () => {
    throw new Error('test error');
  };
  const returnSomething = () => 'something';

  beforeEach(() => {
    ov = overrider.create(globals);

    ov.override('setTimeout', fn => fn && fn());

    attempt = require('../attempt').attempt; // eslint-disable-line
  });

  it('should fail after all attempts', async () => {
    try {
      await attempt({
        func: throwError,
        attempts: 3,
      });
      assert.fail();
    } catch (error) {
      assert.equal(error.message, 'Number of call attempts exceeded 3');
    }
  });

  it('should return successfully after call', async () => {
    try {
      const result = await attempt({
        func: returnSomething,
        attempts: 3,
      });
      assert.equal(result, 'something');
    } catch (error) {
      assert.fail(error);
    }
  });
});
