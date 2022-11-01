/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from '../../test-helpers';
import { isEmailValid } from '../validations/email';
import { isPhoneValid } from '../validations/phone';
import { isSSNValid } from '../validations/ssn';

describe('email', () => {
  [
    { mail: 'xxx@xxx.xxx', valid: true },
    { mail: 'xxx@xxx.x', valid: false },
    { mail: '@xxx.xxx', valid: false },
    { mail: 'x@xxx.xxxx', valid: true },
    { mail: 'x+x+@reva.tech', valid: true },
    { mail: 'x$&@xxx.xx', valid: false },
    { mail: 'x@x.xx', valid: true },
    { mail: 'x123@x987.xx', valid: true },
    { mail: 'xxxx@x-x_xx.x_x-xx.xx', valid: false },
    { mail: 'x123@x987.7x', valid: false },
    { mail: 'x xx@xxx.xxx', valid: false },
  ].map(({ mail, valid }) =>
    it(`'${mail}' should${valid ? '' : ' not'} be valid`, () => {
      expect(isEmailValid(mail)).to.equal(valid);
    }),
  );
});

describe('phone', () => {
  [
    { phone: '555-5555', valid: true },
    { phone: '(800) 800-1234', valid: true },
    { phone: '202-555-0171', valid: true },
    { phone: '+1-202-555-0171', valid: true },
    { phone: '+12025550171', valid: true },
    { phone: '12025550171', valid: true },
    { phone: 'qwerty', valid: false },
    { phone: '$4342%', valid: false },
  ].map(({ phone, valid }) =>
    it(`'${phone}' should${valid ? '' : ' not'} be valid`, () => {
      expect(isPhoneValid(phone)).to.equal(valid);
    }),
  );
});

describe('ssn', () => {
  [
    { ssn: '555-5555', strictValidation: false, valid: false },
    { ssn: '444-44-4444', strictValidation: false, valid: true },
    { ssn: '444-44-XXXX', strictValidation: true, valid: false },
    { ssn: '444-44-XXXX', strictValidation: false, valid: true },
    { ssn: '', strictValidation: false, valid: true },
    { ssn: null, strictValidation: true, valid: true },
  ].forEach(({ ssn, strictValidation, valid }) =>
    it(`'${ssn}' should${valid ? '' : ' not'} be valid with striction mode ${strictValidation}`, () => {
      expect(isSSNValid(ssn, strictValidation)).to.equal(valid);
    }),
  );
});
