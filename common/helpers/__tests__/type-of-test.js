/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, when } from '../../test-helpers';
import typeOf from '../type-of.js';

describe('typeOf', () => {
  when('a boolean is provided', () => {
    it('should return `boolean`', () => {
      expect(typeOf(true)).to.equal('boolean', 'the type is `boolean`');
    });
  });

  when('a number is provided', () => {
    it('should return `number`', () => {
      expect(typeOf(1)).to.equal('number', 'the type is `number`');
    });
  });

  when('a string is provided', () => {
    it('should return `string`', () => {
      expect(typeOf('some string')).to.equal('string', 'the type is `string`');
    });
  });

  when('a function is provided', () => {
    it('should return `function`', () => {
      expect(typeOf(Function.prototype)).to.equal('function', 'the type is `function`');
    });
  });

  when('an array is provided', () => {
    it('should return `array`', () => {
      expect(typeOf([])).to.equal('array', 'the type is `array`');
    });
  });

  when('a Date is provided', () => {
    it('should return `date`', () => {
      expect(typeOf(new Date())).to.equal('date', 'the type is `date`');
    });
  });

  when('a RegExp is provided', () => {
    it('should return `regexp`', () => {
      expect(typeOf(new RegExp('some'))).to.equal('regexp', 'the type is `regexp`');
    });
  });

  when('an object is provided', () => {
    it('should return `object`', () => {
      expect(typeOf({})).to.equal('object', 'the type is `object`');
    });
  });

  when('undefined is provided', () => {
    it('should return `undefined`', () => {
      expect(typeOf(undefined)).to.equal('undefined', 'the type is `undefined`');
    });
  });

  when('null is provided', () => {
    it('should return `null`', () => {
      expect(typeOf(null)).to.equal('null', 'the type is `null`');
    });
  });
});
