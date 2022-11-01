/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { when, and } from '../../test-helpers';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('rand', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  when('Math.random() returns 0', () => {
    and('min is 1 and max is 20', () => {
      it('should return the min value', () => {
        mockModules({
          '../../globals/math': {
            Math: {
              floor: Math.floor,
              random: jest.fn(() => 0),
            },
          },
        });

        const rand = require('../rand').default;

        const min = 1;
        const max = 20;
        const result = rand(min, max);

        expect(result).toEqual(min);
      });
    });
  });

  when('Math.random() returns 1', () => {
    and('min is 1 and max is 20', () => {
      it('should return the max value', () => {
        mockModules({
          '../../globals/math': {
            Math: {
              floor: Math.floor,
              random: jest.fn(() => 1),
            },
          },
        });

        const min = 1;
        const max = 20;
        const rand = require('../rand').default;

        const result = rand(min, max);

        expect(result).toEqual(max);
      });
    });
  });

  when('one argument is provided', () => {
    it('should returns a number between 0 and the argument', () => {
      const max = 10;
      const rand = require('../rand').default;
      const result = rand(max);

      expect(result <= 10).toEqual(true);
    });
  });

  when('two arguments (min, max) are provided', () => {
    it('should return a number >= min && <= max', () => {
      const max = 55;
      const min = 1;

      const rand = require('../rand').default;
      const result = rand(min, max);

      expect(result >= min).toEqual(true);
      expect(result <= max).toEqual(true);
    });
  });

  when('the min > max, (yes this kind of things happens!)', () => {
    it('should return a number between min and max', () => {
      const max = 1;
      const min = 5;
      const rand = require('../rand').default;
      const result = rand(min, max);

      expect(result <= min).toEqual(true);
      expect(result >= max).toEqual(true);
    });
  });
});
