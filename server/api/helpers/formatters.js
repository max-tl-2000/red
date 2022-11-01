/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { formatPhoneNumberForDb } from '../../helpers/phoneUtils';
import { getOnlyDigitsFromPhoneNumber } from '../../../common/helpers/phone-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { parsePhone } from '../../../common/helpers/phone/phone-helper';

const preparePhoneNumberToStoreInDb = phone => {
  // E.164 normalized format contains `+` at the beginning. `getOnlyDigitsFromPhoneNumber`
  // will remove it so we can store it on the phone fields in the db
  const parsedPhone = parsePhone(phone);
  const thePhone = parsedPhone.valid ? parsedPhone.normalized : phone;

  return getOnlyDigitsFromPhoneNumber(thePhone);
};

const formatPhone = ci => (ci.type === 'phone' ? { ...ci, value: formatPhoneNumberForDb(ci.value) } : ci);

export function formatPhoneNumbers(contactInfo) {
  if (!contactInfo || !contactInfo.all) return contactInfo;

  return {
    ...contactInfo,
    // TODO: we should use the same logic to prepare the number to be stored in the db
    defaultPhone: formatPhoneNumberForDb(contactInfo.defaultPhone),
    all: contactInfo.all && contactInfo.all.map(formatPhone),
  };
}

const formatPhones = phones =>
  phones.map(phone => {
    if (phone.type === DALTypes.ContactInfoType.PHONE) {
      return {
        ...phone,
        value: preparePhoneNumberToStoreInDb(phone.value),
      };
    }

    return phone;
  });

export const formatPhoneFromContactInfo = contactInfo => {
  if (!contactInfo) return contactInfo;

  return {
    ...contactInfo,
    defaultPhone: preparePhoneNumberToStoreInDb(contactInfo.defaultPhone),
    phones: formatPhones(contactInfo.phones),
    all: formatPhones(contactInfo.all),
  };
};
