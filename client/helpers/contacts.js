/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { formatPhoneNumber } from 'helpers/strings';
import { isEmailInBlacklist } from '../../common/helpers/contactInfoUtils';
import { isEmailValid } from '../../common/helpers/validations';

export const createPhoneContactGroupsFromPartyMembers = pms => {
  const createContact = pm => phone => ({
    id: newUUID(),
    personId: pm.personId,
    partyId: pm.partyId,
    memberType: pm.memberType,
    fullName: pm.person.fullName,
    phone: formatPhoneNumber(phone.value),
    isPrimary: phone.isPrimary,
    unformattedPhone: phone.value,
    hasPhoneNumber: !!phone.value,
    disabled: !phone.value,
  });

  const getPhones = ({ person }) => (person.contactInfo.phones.length ? person.contactInfo.phones : [{ value: '' }]);

  const contacts = pms.reduce((acc, pm) => [...acc, ...getPhones(pm).map(createContact(pm))], []);

  const groupedContacts = contacts.reduce((acc, c) => {
    acc[c.memberType] = {
      id: `${c.memberType}s`,
      text: `${c.memberType}s`,
      items: [...((acc[c.memberType] && acc[c.memberType].items) || []), c],
    };
    return acc;
  }, {});

  return Object.values(groupedContacts);
};

export const isNoReplyEmail = email => /^no-?reply/.test(email);
export const isEmailValidAndNotBlacklisted = email => isEmailValid(email) && !isEmailInBlacklist(email) && !isNoReplyEmail(email);

export const arePersonsContactInfoValid = persons => persons.every(p => p.contactInfo.emails.some(e => isEmailValidAndNotBlacklisted(e.value)));

export const isFullNameAContactInfo = person => {
  const contactInfos = person.contactInfo?.all || person.contactInfo;
  return contactInfos ? contactInfos.some(contact => contact.value === person.fullName) : false;
};
