/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, overrider, when, and } from 'test-helpers';
import * as globals from '../../../common/helpers/globals';
import cfg from '../cfg';

describe('cfg', () => {
  let ov;

  // create it before each test
  beforeEach(() => {
    ov = overrider.create(globals);
    // we don't need to worry about restoring window
    // as the overrider will restore the original window variable
    // on the global afterEach handler
    ov.override('window', {
      __appData: {},
    });
  });

  when('looking for the value of an existing key in the __appData object', () => {
    it('should return the value of the key', () => {
      const expected = '1232';

      globals.window.__appData.someValue = expected;

      expect(cfg('someValue')).to.equal(expected);
    });

    and('the key looks like `some.deep.key`', () => {
      it('should return the value of the key', () => {
        const expected = 'expected key';

        const pData = globals.window.__appData || {};

        pData.some = {
          deep: {
            key: expected,
          },
        };

        expect(cfg('some.deep.key')).to.equal(expected);
      });
    });
  });

  when('looking for the value of a key not in the __appData object', () => {
    and('no default value was provided', () => {
      it('should return undefined', () => {
        expect(cfg('some.non.existing.key')).to.equal(undefined);
      });
    });

    and('a default value was provided', () => {
      it('should return the default value', () => {
        const defValue = 'default value';
        expect(cfg('some.non.existing.key', defValue)).to.equal(defValue);
      });
    });
  });
});
