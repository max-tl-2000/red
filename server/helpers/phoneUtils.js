/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import config from '../config';
import { formatPhoneNumber, isValidPhoneNumber, formatPhoneToDisplay } from '../../common/helpers/phone/phone-helper';
import { searchPhoneNumbers, buyPhoneNumber, assignPhoneNumber } from '../workers/communication/commProviderIntegration';
import { updateTenantPhoneNumbers, getTenantReservedPhoneNumbers, getTenantData } from '../dal/tenantsRepo';
import { replaceEmptySpaces } from '../../common/helpers/utils';
import sleep from '../../common/helpers/sleep';

import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'phoneUtils' });

export const RESTRICTED_PHONE_NUMBER = 'RESTRICTED';
export const RESTRICTED_PHONE_REPLACEMENT = '1000000000';

// TODO: Refactor the way that formatPhoneNumberForDb is used. This should probably be removed
export const formatPhoneNumberForDb = number => {
  if (number?.substring(0, 4) === '1111') return number;
  /*
  Given '+16197384381' we drop '+' char before saving to db.
  This is the format accepted by the telephony provider and SIP protocol.
  */
  const formatted = formatPhoneNumber(number);
  return formatted && formatted.replace(/^\+/, '');
};

export const isPhoneIndexPlaceholder = phoneNumber => RegExp(config.import.phonePlaceHolder).test(phoneNumber);

export const isPhoneAreaPreferencesPlaceHolder = phoneNumber => RegExp(config.import.phoneAreaPreferencesPlaceHolder).test(phoneNumber);

export const isPhoneAliasToIgnore = phoneNumber => phoneNumber === config.import.phoneAliasToIgnore;

export const getPhoneNumberIndex = phonePlaceholder => phonePlaceholder.match(/\d{1,}/i)[0];

export const isUnformattedPhoneLikeValue = phoneNumber => config.import.phoneNumberValue.test(phoneNumber);

const isPhoneReservedBySameEntity = (tenantPhoneNumber, ownerId, ownerType) =>
  ownerType && ownerId && tenantPhoneNumber.ownerId === ownerId && tenantPhoneNumber.ownerType === ownerType;

const getPhoneNumberByPlaceholder = ({ tenantReservedPhoneNumbers, phonePlaceholder, ownerType, ownerId }) => {
  const phoneNumberIndex = getPhoneNumberIndex(phonePlaceholder);
  const determinedNumber = tenantReservedPhoneNumbers[phoneNumberIndex];
  return determinedNumber && (!determinedNumber.isUsed || isPhoneReservedBySameEntity(determinedNumber, ownerId, ownerType)) ? determinedNumber : '';
};

export const getAreaPreferencesByPlaceholder = phonePlaceholder =>
  phonePlaceholder.match(config.import.phoneAreaPreferencesPlaceHolder)[1].replace(/"/g, '').split(',');

const doesPhoneMatchPattern = (prefix, phoneNumber) => prefix === '*' || phoneNumber.substring(1, prefix.length + 1) === prefix;

const isPhoneAlreadyAssigned = (phone, tenantPhoneNumbers) => tenantPhoneNumbers.some(tp => tp.phoneNumber === phone);

const getPhoneNumberFromPlivo = async (ctx, pattern) => {
  let foundPhone;
  const noOfRetries = 3;
  let retryCount = 0;
  const tenantNumbersForSave = await getTenantReservedPhoneNumbers(ctx);
  while (retryCount < noOfRetries && !foundPhone) {
    const missingNumbers = await searchPhoneNumbers(ctx, {
      maxResults: 1,
      pattern: pattern === '*' ? '' : pattern,
    });

    if (missingNumbers.length > 0) {
      if (!isPhoneAlreadyAssigned(missingNumbers[0].id, tenantNumbersForSave)) {
        foundPhone = missingNumbers[0].id;
        await buyPhoneNumber(ctx, foundPhone);
        await assignPhoneNumber(ctx, foundPhone);
        const tenant = await getTenantData(ctx);
        const updatedTenantPhoneNumbers = [...tenantNumbersForSave, { phoneNumber: foundPhone }];
        await updateTenantPhoneNumbers(ctx, tenant, updatedTenantPhoneNumbers);
      } else {
        logger.trace(
          { ctx, phoneNumber: missingNumbers[0].id },
          'Phone number has already been bought. Waiting for 3 seconds and repeating the search for a new number',
        );

        await sleep(3000);
      }
    }
    retryCount += 1;
  }
  return foundPhone;
};

const getPhoneFromListForPattern = async (ctx, phonePlaceholder, tenantReservedPhoneNumbers) => {
  const prefixesForPhones = getAreaPreferencesByPlaceholder(replaceEmptySpaces(phonePlaceholder));

  let foundPhone;
  const freeTenantNumbers = tenantReservedPhoneNumbers.filter(p => !p.isUsed);
  await mapSeries(prefixesForPhones, async pf => {
    if (!foundPhone) {
      const freeTenantNumbersWithPrefix = freeTenantNumbers.filter(tp => doesPhoneMatchPattern(pf, tp.phoneNumber));

      if (freeTenantNumbersWithPrefix.length > 0) {
        foundPhone = freeTenantNumbersWithPrefix[0].phoneNumber;
      } else {
        foundPhone = await getPhoneNumberFromPlivo(ctx, pf);
      }
    }
  });

  return foundPhone;
};
export const isPhoneNumberReserved = (tenantReservedPhoneNumbers, phoneNumber) => tenantReservedPhoneNumbers.some(phone => phone.phoneNumber === phoneNumber);

export const isPhoneNumberAlreadyUsed = ({ tenantReservedPhoneNumbers, phoneNumber, ownerType, ownerId }) =>
  tenantReservedPhoneNumbers.some(phone => phone.phoneNumber === phoneNumber && phone.isUsed && !isPhoneReservedBySameEntity(phone, ownerId, ownerType));

const handlePlaceholderValue = ({ tenantReservedPhoneNumbers, phonePlaceholder, ownerType, ownerId }) => {
  const phoneNumberObject = getPhoneNumberByPlaceholder({ tenantReservedPhoneNumbers, phonePlaceholder, ownerType, ownerId });
  if (!phoneNumberObject) return '';
  logger.debug(`replacing placeholder ${phonePlaceholder} with ${phoneNumberObject.phoneNumber}`);
  return formatPhoneNumberForDb(phoneNumberObject.phoneNumber);
};

const handlePhoneLikeValue = ({ tenantReservedPhoneNumbers, phoneNumber, ownerType, ownerId, isDisplayOnly = false }) => {
  const formattedPhoneNumber = formatPhoneNumberForDb(phoneNumber);

  if (isDisplayOnly) {
    return formattedPhoneNumber;
  }
  if (
    !isPhoneNumberReserved(tenantReservedPhoneNumbers, formattedPhoneNumber) ||
    isPhoneNumberAlreadyUsed({ tenantReservedPhoneNumbers, phoneNumber: formattedPhoneNumber, ownerType, ownerId })
  ) {
    return '';
  }
  return formattedPhoneNumber;
};

const handleAreaCodePlaceholderValue = async (ctx, excelPhoneNumber, tenantReservedPhoneNumbers) => {
  const foundPhone = await getPhoneFromListForPattern(ctx, excelPhoneNumber, tenantReservedPhoneNumbers);

  if (!foundPhone) return '';

  logger.debug(`replacing area preference placeholder ${excelPhoneNumber} with ${foundPhone}`);
  return formatPhoneNumberForDb(foundPhone);
};

export const getPhoneNumber = async ({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber, ownerType, ownerId, isDisplayOnly = false }) => {
  if (!excelPhoneNumber) return '';
  if (isPhoneAliasToIgnore(excelPhoneNumber)) return excelPhoneNumber;

  const inputPhoneNumber = replaceEmptySpaces(excelPhoneNumber.toString());
  const isPhoneIndex = isPhoneIndexPlaceholder(inputPhoneNumber);
  const isPhoneAreaPreferences = isPhoneAreaPreferencesPlaceHolder(inputPhoneNumber);
  const isPhoneLikeValue = isUnformattedPhoneLikeValue(inputPhoneNumber);

  if (isPhoneIndex) {
    return handlePlaceholderValue({ tenantReservedPhoneNumbers, phonePlaceholder: inputPhoneNumber, ownerType, ownerId });
  }

  if (isPhoneAreaPreferences) {
    return await handleAreaCodePlaceholderValue(ctx, inputPhoneNumber, tenantReservedPhoneNumbers);
  }

  if (isPhoneLikeValue) {
    return handlePhoneLikeValue({ tenantReservedPhoneNumbers, phoneNumber: inputPhoneNumber, ownerType, ownerId, isDisplayOnly });
  }
  return '';
};

export { formatPhoneNumber, isValidPhoneNumber, formatPhoneToDisplay };

export const isInvalidFrom = callData =>
  callData?.From && !isValidPhoneNumber(callData.From) && callData?.CallerName && isValidPhoneNumber(callData.CallerName);
