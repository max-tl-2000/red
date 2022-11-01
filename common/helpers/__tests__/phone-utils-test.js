/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { formatPhone } from '../phone-utils';

describe('formatPhone', () => {
  describe('when a normalized US phone number is passed', () => {
    it('should return it in (xxx) xxx-xxxx format', () => {
      const expected = '(800) 800-9897';

      expect(formatPhone('18008009897')).to.equal(expected);
      expect(formatPhone('+18008009897')).to.equal(expected);
    });
  });

  describe('when a formatted US phone number is passed', () => {
    it('should return it unchanged', () => {
      const result = formatPhone('(800) 800-9897');
      expect(result).to.equal('(800) 800-9897');
    });
  });

  describe('if normalized international phone number is passed', () => {
    it('should return it in +xx xxx xxx xxx format', () => {
      const expected = '+40 745 123 123';

      expect(formatPhone('40745123123')).to.equal(expected);
      expect(formatPhone('+40745123123')).to.equal(expected);
      expect(formatPhone('0040745123123')).to.equal(expected);
    });
  });

  describe('if formatted international phone number is passed', () => {
    it('should return it unchanged', () => {
      const result = formatPhone('+40 745 123 123');
      expect(result).to.equal('+40 745 123 123');
    });
  });

  describe('when called twice on the same value', () => {
    it('should not modify the value the second time', () => {
      const formattedNumbers = [formatPhone('40745123123'), formatPhone('18008009897'), formatPhone('+40 745 123 123'), formatPhone('(800) 800-9897')];
      formattedNumbers.map(number => expect(formatPhone(number)).to.equal(number));
    });
  });
});
