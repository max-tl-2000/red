/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from './trim';
import { isValidPhoneNumber, formatPhoneToDisplay } from './phone/phone-helper';

export const RESTRICTED_PHONE_NUMBER = 'RESTRICTED';
export const ANONYMOUS_PHONE_NUMBER = 'ANONYMOUS';

export function validatePhone(phoneNumber) {
  const valid = isValidPhoneNumber(phoneNumber);

  return {
    valid,
    reason: 'VALID_PHONE_REQUIRED',
  };
}

export const formatPhone = phoneNumber => {
  if (!phoneNumber) return '';

  return formatPhoneToDisplay(phoneNumber);
};

export const formatAsPhoneIfDigitsOnly = phoneNumber => {
  phoneNumber = trim(phoneNumber);
  if (phoneNumber.match(/^\d+$/)) {
    return formatPhone(phoneNumber);
  }
  return phoneNumber;
};

export const getOnlyDigitsFromPhoneNumber = (phoneNumber = '') => {
  // this check should be done outside of this function by the caller of it when it needs it
  if (phoneNumber?.toUpperCase() === RESTRICTED_PHONE_NUMBER || phoneNumber?.toUpperCase() === ANONYMOUS_PHONE_NUMBER) return phoneNumber;

  return phoneNumber.replace(/\D/g, '');
};

export const looksLikeAPhoneNumber = phoneNumber => /^\d+$/.test(phoneNumber);
