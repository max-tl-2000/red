/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { formatPhoneNumber, parsePhone } from '../phone-helper';

describe('Given a call to formatPhoneNumber function', () => {
  const notPossibleNumber = '1982893789';
  const numberWithLetters = '888452105A';
  const numberWithSymbols = '888452105@';
  const invalid = '';

  it('should return empty for empty input', () => {
    const res = formatPhoneNumber(' ');
    expect(res).to.equal(invalid);
  });

  it('it should return empty for invalid phone number', () => {
    const res = formatPhoneNumber(notPossibleNumber);
    expect(res).to.equal(invalid);
  });

  it('it should return empty for letters in input', () => {
    const res = formatPhoneNumber(numberWithLetters);
    expect(res).to.equal(invalid);
  });

  it('it should return empty for symbols in input', () => {
    const res = formatPhoneNumber(numberWithSymbols);
    expect(res).to.equal(invalid);
  });
});

describe('when input is a valid phone number', () => {
  describe('with no country code', () => {
    it('should return the number normalized, and defaulted to US', () => {
      const res = formatPhoneNumber('888-452-1505');
      expect(res).to.equal('+18884521505');
    });
  });

  describe('prefixed with US country code', () => {
    it('should return the number normalized, with correct country', () => {
      const res = formatPhoneNumber('1 888-452-1501');
      expect(res).to.equal('+18884521501');
    });
  });

  describe('prefixed with + and US country code', () => {
    it('should return the number normalized, with correct country', () => {
      const res = formatPhoneNumber('+1 888-452-1501');
      expect(res).to.equal('+18884521501');
    });
  });

  describe('prefixed with 00 and US country code', () => {
    it('should return the number normalized, with correct country', () => {
      const res = formatPhoneNumber('001 888-452-1501');
      expect(res).to.equal('+18884521501');
    });
  });

  describe('prefixed with + and a non-US country code', () => {
    it('should return the number normalized, with correct country', () => {
      const res = formatPhoneNumber('+40745518262');
      expect(res).to.equal('+40745518262');
    });
  });

  describe('prefixed with a non-US country code, without +', () => {
    it('should return the number normalized, with correct country', () => {
      const res = formatPhoneNumber('40745518262');
      expect(res).to.equal('+40745518262');
    });
  });

  describe('prefixed with 00 and a non-US counrty code', () => {
    it('should return the number normailzed, with correct country', () => {
      const res = formatPhoneNumber('0040745518262');
      expect(res).to.equal('+40745518262');
    });
  });

  describe('from a country outside US but which matches a US number without the 1 prefix', () => {
    it('should return the number normailzed, with country set to US', () => {
      const res = formatPhoneNumber('8884521505');
      expect(res).to.equal('+18884521505');
    });
  });
});

describe('when parsePhone is called', () => {
  [
    {
      input: '+12232129433',
      valid: true,
    },
    {
      input: '12232129433',
      valid: true,
    },
    {
      input: '2232129433',
      valid: true,
    },
    {
      input: '+1 888-452-1501',
      valid: true,
    },
    {
      input: '888-452-1505',
      valid: true,
    },
    {
      input: '001 888-452-1501',
      valid: true,
    },
    {
      input: '1982893789',
      valid: false,
    },
    {
      input: '3262675163',
      valid: true,
    },
  ].forEach(({ input, valid }) => {
    describe(`given these ${input} value`, () => {
      it(`should return ${valid} as valid value`, () => {
        expect((parsePhone(input) || {}).valid).to.equal(valid);
      });
    });
  });
});
