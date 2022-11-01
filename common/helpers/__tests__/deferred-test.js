/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, assert } from '../../test-helpers';
import { deferred } from '../deferred';

describe('deferred', () => {
  it('should fail if the promise is not resolved before timeout', async () => {
    const dfd = deferred({ timeout: 1000 });
    try {
      await dfd;
    } catch (err) {
      expect(err.reason).to.equal('timeout (1000) reached on "anonymous deferred"');
    }
  });

  it('should not fail if a timeout is not provided', async () => {
    const dfd = deferred();
    try {
      setTimeout(dfd.resolve, 1500);
      await dfd;
      assert.ok('No errors at this point');
    } catch (err) {
      throw err; // should never be executed
    }
  });

  it('should fail if resolve is attempted after timeout', async () => {
    const dfd = deferred({ timeout: 1000 });
    try {
      setTimeout(dfd.resolve, 1500);
      await dfd;
      assert.ok('No errors at this point');
    } catch (err) {
      expect(err.reason).to.equal('timeout (1000) reached on "anonymous deferred"');
    }
  });

  it('should fail if resolve is attempted after timeout', async () => {
    const dfd = deferred({ timeout: 1000, id: 'deferred id' });
    try {
      setTimeout(dfd.resolve, 1500);
      await dfd;
      assert.ok('No errors at this point');
    } catch (err) {
      expect(err.reason).to.equal('timeout (1000) reached on "deferred id"');
    }
  });
});
