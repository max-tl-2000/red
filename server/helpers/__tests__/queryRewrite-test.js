/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { phoneSanitize } from '../searchUtils';

describe('phoneSanitize excuted', () => {
  describe('using differents format', () => {
    it('4152311122', () => {
      expect(phoneSanitize('4152311122')).to.be.equal('4152311122');
      expect(phoneSanitize('14152311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+14152311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 4152311122')).to.be.equal('14152311122');
    });

    it('415 2311122', () => {
      expect(phoneSanitize('415 2311122')).to.be.equal('4152311122');
      expect(phoneSanitize('1415 2311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1415 2311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 415 2311122')).to.be.equal('14152311122');
    });

    it('415 231 1122', () => {
      expect(phoneSanitize('415 231 1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1415 231 1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1415 231 1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 415 231 1122')).to.be.equal('14152311122');
    });

    it('(415) 231-1122', () => {
      expect(phoneSanitize('(415) 231-1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1(415) 231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1(415) 231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 (415) 231-1122')).to.be.equal('14152311122');
    });

    it('(415) 2311122', () => {
      expect(phoneSanitize('(415) 2311122')).to.be.equal('4152311122');
      expect(phoneSanitize('1(415) 2311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1(415) 2311122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 (415) 2311122')).to.be.equal('14152311122');
    });

    it('(415) 231 1122', () => {
      expect(phoneSanitize('(415) 231 1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1(415) 231 1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1(415) 231 1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 (415) 231 1122')).to.be.equal('14152311122');
    });

    it('415.231.1122', () => {
      expect(phoneSanitize('415.231.1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1415.231.1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1415.231.1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 415.231.1122')).to.be.equal('14152311122');
    });

    it('415 231-1122', () => {
      expect(phoneSanitize('415 231-1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1415 231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1415 231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 415 231-1122')).to.be.equal('14152311122');
    });

    it('415-231-1122', () => {
      expect(phoneSanitize('415-231-1122')).to.be.equal('4152311122');
      expect(phoneSanitize('1415-231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1415-231-1122')).to.be.equal('14152311122');
      expect(phoneSanitize('+1 415-231-1122')).to.be.equal('14152311122');
    });
  });
});
