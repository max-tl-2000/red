/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, when } from '../../test-helpers';
import { size } from '../object-utils.js';

describe('object size', () => {
  when('object is a number:', () => {
    it('should return 8 bytes', async () => {
      expect(size(1)).to.equal(8);
    });
  });
  when('object is a string:', () => {
    it('should return two times its length in bytes', async () => {
      const aString = 'string';
      expect(size(aString)).to.equal(aString.length * 2);
    });
  });
  when('object is undefined:', () => {
    it('should return 0 bytes', async () => {
      expect(size(undefined)).to.equal(0);
    });
  });
  when('object is a boolean:', () => {
    it('should return 4 bytes', async () => {
      expect(size(true)).to.equal(4);
    });
  });
  when('is an object', () => {
    it('should return the sum of its parts types in bytes', async () => {
      const testObj = {
        numberProperty: 1,
        booleanProperty: true,
        stringProperty: 'string',
        undefinedProperty: undefined,
        objectProperty: {
          numProperty: 1,
        },
      };
      expect(size(testObj)).to.equal(202);
    });
  });
});
