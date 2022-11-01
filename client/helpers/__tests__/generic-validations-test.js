/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { VALIDATION_TYPES, validate } from '../Form/Validation';

const DATE_ES_FORMAT = 'DD/MM/YYYY';

describe('Generic Validations', () => {
  it('Unknown Validation', () => {
    expect(validate.bind(validate, undefined, 'UNKNOWN')).to.throw('Unknown Validation');
  });

  describe('Required Validation', () => {
    it('Valid string value', () => {
      const result = validate({ value: 'Some text' }, VALIDATION_TYPES.REQUIRED);

      expect(result.isValid).to.equal(true);
    });

    it('Invalid string value', () => {
      const result = validate({ value: '' }, VALIDATION_TYPES.REQUIRED);

      expect(result.isValid).to.equal(false);
    });

    it('Valid numeric value', () => {
      const result = validate({ value: 12 }, VALIDATION_TYPES.REQUIRED);

      expect(result.isValid).to.equal(true);
    });

    it('Invalid undefined value', () => {
      const result = validate({ value: undefined }, VALIDATION_TYPES.REQUIRED);

      expect(result.isValid).to.equal(false);
    });
  });

  describe('Email Validation', () => {
    it('Valid email value', () => {
      const result = validate({ value: 'test@reva.tech' }, VALIDATION_TYPES.EMAIL);

      expect(result.isValid).to.equal(true);
    });

    it('Invalid email value', () => {
      const result = validate({ value: 'test@' }, VALIDATION_TYPES.EMAIL);

      expect(result.isValid).to.equal(false);
    });
  });

  describe('Date Validation', () => {
    it('Valid date value', () => {
      const result = validate({ value: '11/22/2016' }, VALIDATION_TYPES.DATE);

      expect(result.isValid).to.equal(true);
    });

    it('Invalid date value', () => {
      const result = validate({ value: '02/30/2016' }, VALIDATION_TYPES.DATE);

      expect(result.isValid).to.equal(false);
    });

    it(`Valid date with custom format - ${DATE_ES_FORMAT}`, () => {
      const result = validate({ value: '22/11/2016' }, VALIDATION_TYPES.DATE, {
        args: { format: DATE_ES_FORMAT },
      });

      expect(result.isValid).to.equal(true);
    });
  });

  describe('Phone Validation', () => {
    it('Should return true when valid phone numbers', () => {
      const result = validate({ value: '+14084809389' }, VALIDATION_TYPES.PHONE);

      expect(result.isValid).to.equal(true);
    });

    it('Should return false when invalid phone numbers', () => {
      const result = validate({ value: '+1408480938a' }, VALIDATION_TYPES.PHONE);

      expect(result.isValid).to.equal(false);
    });
  });

  describe('Number Validation', () => {
    it('Should return true when valid number', () => {
      const result = validate({ value: '12345' }, VALIDATION_TYPES.NUMBER);

      expect(result.isValid).to.equal(true);
    });

    it('Should return false when invalid number', () => {
      const result = validate({ value: '12345a' }, VALIDATION_TYPES.NUMBER);

      expect(result.isValid).to.equal(false);
    });
  });
});
