/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  isPhoneIndexPlaceholder,
  isPhoneAliasToIgnore,
  formatPhoneNumberForDb as formatPhoneNumber,
  isPhoneAreaPreferencesPlaceHolder,
  getAreaPreferencesByPlaceholder,
  isPhoneNumberReserved,
  isPhoneNumberAlreadyUsed,
  getPhoneNumberIndex,
  isUnformattedPhoneLikeValue,
} from '../../helpers/phoneUtils';
import { replaceEmptySpaces } from '../../../common/helpers/utils';

const getPhoneQueryErrorMessage = phoneNumber => `Could not determine phone for placeholder ${phoneNumber}.`;

const handlePlaceholderValue = (phonePlaceholder, tenantReservedPhoneNumbers) => {
  const phoneIndex = getPhoneNumberIndex(phonePlaceholder);

  if (phoneIndex >= tenantReservedPhoneNumbers.length) {
    return `Invalid phone placeholder ${phonePlaceholder}. Phone numbers reserved are between index: 0 and ${tenantReservedPhoneNumbers.length - 1}`;
  }

  if (tenantReservedPhoneNumbers[phoneIndex].isUsed) {
    return `The phone number for placeholder ${phonePlaceholder} is already used!`;
  }

  return '';
};

const handlePhoneLikeValue = ({ tenantReservedPhoneNumbers, phoneNumber, ownerType, ownerId }) => {
  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  if (!formattedPhoneNumber) {
    return `The phone number ${phoneNumber} is not valid!`;
  }

  if (!isPhoneNumberReserved(tenantReservedPhoneNumbers, formattedPhoneNumber)) {
    return `The phone number ${phoneNumber} is not reserved for this tenant!`;
  }

  if (isPhoneNumberAlreadyUsed({ tenantReservedPhoneNumbers, phoneNumber: formattedPhoneNumber, ownerType, ownerId })) {
    return `The phone number ${phoneNumber} is already used!`;
  }
  return '';
};

export const getValidationMessagesForPlaceholders = ({ tenantReservedPhoneNumbers, excelPhoneNumber, determinedNumber, ownerType, ownerId }) => {
  const inputPhoneNumber = excelPhoneNumber.trim();

  if (inputPhoneNumber && !determinedNumber && !isPhoneAliasToIgnore(inputPhoneNumber)) {
    if (isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(inputPhoneNumber))) {
      return getPhoneQueryErrorMessage(inputPhoneNumber);
    }

    if (isPhoneIndexPlaceholder(inputPhoneNumber)) {
      return handlePlaceholderValue(inputPhoneNumber, tenantReservedPhoneNumbers);
    }
    if (isUnformattedPhoneLikeValue(inputPhoneNumber)) {
      return handlePhoneLikeValue({ tenantReservedPhoneNumbers, phoneNumber: inputPhoneNumber, ownerType, ownerId });
    }
    return `The value  ${inputPhoneNumber} is invalid!`;
  }
  return '';
};
/* rankings based on phone values
0 - for %ignore% or when no phone is set;
1 - for actual phone number (eg. 12025550190)
2 - for phone index placeholder (eg. %phone[1]%)
50+ - for area code placeholder (eg. for %phone["area_code_preferences": ["628", "410"]]% will be returned 52)
100+ - for area code placeholder and * (eg. %phone["area_code_preferences": ["628", "410", *]]% will be returned 102)
1000 - for %phone["area_code_preferences": [*]]%
*/

export const getPhoneRankForRow = phoneNumber => {
  if (!phoneNumber || isPhoneAliasToIgnore(phoneNumber)) return 0;
  if (isPhoneIndexPlaceholder(phoneNumber)) return 2;
  if (isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(phoneNumber))) {
    const distinctPhonePrefixesForPhone = getAreaPreferencesByPlaceholder(replaceEmptySpaces(phoneNumber));
    if (distinctPhonePrefixesForPhone.length === 1 && distinctPhonePrefixesForPhone[0] === '*') {
      return 1000;
    }

    if (distinctPhonePrefixesForPhone.some(p => p === '*')) {
      return 100 + distinctPhonePrefixesForPhone.length;
    }

    return 50 + distinctPhonePrefixesForPhone.length;
  }

  return 1;
};
