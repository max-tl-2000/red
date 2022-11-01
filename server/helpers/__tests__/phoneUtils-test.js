/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { formatPhoneNumber, formatPhoneNumberForDb } from '../phoneUtils';
import { getOnlyDigitsFromPhoneNumber } from '../../../common/helpers/phone-utils';

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

describe('Given a call to getOnlyDigitsFromPhoneNumber function', () => {
  const phoneNumber = '1982893789';
  const phoneNumberWithBlankSpaces = '88845  2105';
  const phoneNumberWithSymbols = '8 88452105@  ';

  it('should return phone number without blank spaces and special characters', () => {
    const res1 = getOnlyDigitsFromPhoneNumber(phoneNumber);
    const res2 = getOnlyDigitsFromPhoneNumber(phoneNumberWithBlankSpaces);
    const res3 = getOnlyDigitsFromPhoneNumber(phoneNumberWithSymbols);

    expect(res1).to.equal('1982893789');
    expect(res2).to.equal('888452105');
    expect(res3).to.equal('888452105');
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

describe('Given a call to formatPhoneNumberForDb function', () => {
  it('when value is valid it should return 11-15 digits, no extra chars', () => {
    expect(formatPhoneNumberForDb('1 619-738-4381')).to.equal('16197384381'); // US, hyphens and spaces
    expect(formatPhoneNumberForDb('+1 619-738-4381')).to.equal('16197384381'); // US, plus, hyphens and spaces
    expect(formatPhoneNumberForDb('+16197384381')).to.equal('16197384381'); // US, plus
    expect(formatPhoneNumberForDb('+40743084949')).to.equal('40743084949'); // RO, plus
    expect(formatPhoneNumberForDb('40743084949')).to.equal('40743084949'); // RO, no plus
    expect(formatPhoneNumberForDb('0040743084949')).to.equal('40743084949'); // RO, 00
    expect(formatPhoneNumberForDb('+44 20 7925 0918')).to.equal('442079250918'); // UK, +, spaces
    expect(formatPhoneNumberForDb('0044 20 7925 0918')).to.equal('442079250918'); // UK, 00, spaces
    expect(formatPhoneNumberForDb('619-738-4381')).to.equal('16197384381'); // Unknown country, hyphens -> result is US
  });
});
