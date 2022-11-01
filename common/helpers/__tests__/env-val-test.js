/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, when, and, overrider } from '../../test-helpers';
import * as globals from '../globals';
import envVal from '../env-val';

describe('env-val', () => {
  let ov;
  when('the value we look in env is a string', () => {
    it('should parse it as a string', () => {
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: 'Is a string',
        },
      });

      const result = envVal('THE_KEY_TO_FIND');
      const expected = 'Is a string';

      expect(result).to.equal(expected);
    });
  });

  when('the value we look in env looks like a number', () => {
    it('should parse it as a number', () => {
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: '3',
        },
      });

      const result = envVal('THE_KEY_TO_FIND');
      const expected = 3;

      expect(result).to.deep.equal(expected);
    });
  });

  when('the value we look in env looks like a JSON object', () => {
    it('should parse it as an object', () => {
      const expected = {
        a: {
          object: {
            with: {
              key1: '1',
              key2: [],
              key3: 3,
              key4: true,
            },
          },
        },
      };
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: JSON.stringify(expected),
        },
      });

      const result = envVal('THE_KEY_TO_FIND');

      expect(result).to.deep.equal(expected);
    });
  });

  when('the value we look in env looks like a boolean', () => {
    it('should parse it as a boolean', () => {
      const expected = true;
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: JSON.stringify(expected),
        },
      });

      const result = envVal('THE_KEY_TO_FIND');

      expect(result).to.deep.equal(expected);
    });
  });

  when('the value we look in env is not found', () => {
    it('should return undefined', () => {
      const expected = undefined;
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: JSON.stringify(expected),
        },
      });

      const result = envVal('THE_KEY_TO_FIND');

      expect(result).to.deep.equal(expected);
    });

    and('we provide a default value', () => {
      it('should return the default value', () => {
        const expected = 'some default value';
        ov = overrider.create(globals);
        ov.override('process', {
          env: {},
        });

        const result = envVal('THE_KEY_TO_FIND', expected);

        expect(result).to.deep.equal(expected);
      });
    });
  });

  when('the value we look is not a valid JSON object', () => {
    it('should return the value as a string', () => {
      const expected = '{someInvalid: 1 JSON';

      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          THE_KEY_TO_FIND: expected,
        },
      });

      const result = envVal('THE_KEY_TO_FIND');

      expect(result).to.deep.equal(expected);
    });
  });
});
