/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';
import { formatPhoneToDisplay } from './phone/phone-helper';
import { getOnlyDigitsFromPhoneNumber } from './phone-utils';

export const unmarkAsPrimary = item => {
  item.isPrimary = false;
  return item;
};

export const markAsPrimary = item => {
  item.isPrimary = true;
  return item;
};

export const isPrimary = contactInfo => contactInfo.isPrimary;

const cleanUpPhoneNumbers = contactInfos => {
  if (!contactInfos) return [];

  contactInfos = Array.isArray(contactInfos) ? contactInfos : [contactInfos];

  return contactInfos.map(contactInfo => {
    if (contactInfo.type === DALTypes.ContactInfoType.PHONE) {
      return {
        ...contactInfo,
        value: getOnlyDigitsFromPhoneNumber(contactInfo.value),
      };
    }
    return contactInfo;
  });
};

// TODO: this function should be in a common/server folder
export const enhance = (contactInfos, { shouldCleanUpPhoneNumbers = false, additionalContactInfos = [] } = {}, dontChangePrimaryFlag = false) => {
  if (!contactInfos || !Array.isArray(contactInfos) || !Array.isArray(additionalContactInfos)) {
    return {
      all: [],
    };
  }

  if (shouldCleanUpPhoneNumbers) {
    contactInfos = cleanUpPhoneNumbers(contactInfos);
  }

  const allContacts = contactInfos.concat(additionalContactInfos);
  const getDefault = type => {
    const filtered = allContacts.filter(ci => ci.type === type);
    const defaultContactInfo = filtered.find(ci => ci.isPrimary);

    if (defaultContactInfo) return defaultContactInfo;

    const first = filtered[0];
    if (first) {
      return dontChangePrimaryFlag ? first : markAsPrimary(first);
    }

    return {};
  };

  const { id: defaultPhoneId, value: defaultPhone } = getDefault(DALTypes.ContactInfoType.PHONE);
  const { id: defaultEmailId, value: defaultEmail } = getDefault(DALTypes.ContactInfoType.EMAIL);

  const byType = type => contactInfos.filter(ci => ci.type === type);

  const phones = byType(DALTypes.ContactInfoType.PHONE);
  const emails = byType(DALTypes.ContactInfoType.EMAIL);
  const isSpam = contactInfos.some(ci => ci.isSpam);

  return {
    defaultPhone,
    defaultPhoneId,
    defaultEmail,
    defaultEmailId,
    phones,
    emails,
    isSpam,
    all: contactInfos,
  };
};

export const personHasValidSMSNumber = person => person.contactInfo.phones.some(phoneNr => phoneNr.metadata.sms);

export const constructNameForUnknownPerson = phone => phone;

export const isEmailInBlacklist = email => {
  const restrictedMails = [/^no-?reply/]; // For now, match the no-reply emails
  return restrictedMails.some(value => value.test(email));
};

export const setFirstContactInfoAsPrimary = contactInfos => {
  const [primary, ...rest] = contactInfos;
  return primary ? [markAsPrimary(primary), ...rest] : [];
};

export const primaryContactInfoExists = contactInfos => contactInfos && contactInfos.some(ci => ci.isPrimary);

export const contactInfoListContainsValue = (contactInfoList, contactInfo) =>
  contactInfo.type === DALTypes.ContactInfoType.PHONE
    ? (contactInfoList || []).some(e => formatPhoneToDisplay(e.value) === formatPhoneToDisplay(contactInfo.value))
    : (contactInfoList || []).some(e => e.value.toLowerCase() === contactInfo.value.toLowerCase());
