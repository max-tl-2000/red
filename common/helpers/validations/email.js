/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EMAIL_ADDRESS } from '../../regex';
import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../enums/error-tokens';

// This will be removed when the email validation is done using a api service
// we need to add a second regular expression because the first one excludes some
// cases this one doesn't
const EMAIL_REGEX_VALIDATOR = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-?\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/; // eslint-disable-line no-useless-escape
// inspired by https://github.com/Sembiance/email-validator. MIT license
// inlining it here to make it easier to port back from prod_master to master
export const isEmailValid = (email, strict = true) => {
  if (!email) return false;

  if (email.length > 254) return false;

  let valid = EMAIL_ADDRESS.test(email);

  if (strict) {
    valid = valid && EMAIL_REGEX_VALIDATOR.test(email);
  }

  if (!valid) return false;

  // Further checking of some things regex can't handle
  const parts = email.split('@');
  if (parts[0].length > 64) return false;

  const domainParts = parts[1].split('.');
  if (domainParts.some(part => part.length > 63)) return false;

  return true;
};

export const validateEmail = (email, strict = true) => {
  if (!email) return USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_REQUIRED;
  if (!isEmailValid(email, strict)) return USER_AUTHORIZATION_ERROR_TOKENS.INVALID_EMAIL;
  return '';
};
