/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { formatPhone, formatAsPhoneIfDigitsOnly } from './phone-utils';
import nullish from './nullish';

export const getDisplayName = (person, { usePreferred, ignoreContactInfo } = {}) => {
  if (nullish(person)) return '';

  const { contactInfo = {} } = person;

  const args = [];

  const displayNameFormatted = formatAsPhoneIfDigitsOnly(person.displayName);
  const preferredNameFormatted = person.preferredName;
  const fullNameFormatted = person.fullName;

  const formattedName = usePreferred ? preferredNameFormatted : displayNameFormatted;
  args.push(formattedName, fullNameFormatted);

  if (!ignoreContactInfo) {
    if (contactInfo && contactInfo.defaultEmail) {
      args.push(contactInfo.defaultEmail);
    }

    if (contactInfo && contactInfo.defaultPhone) {
      args.push(formatPhone(contactInfo.defaultPhone));
    }
  }

  return args.find(entry => !!entry) || '';
};

export const getEnhancedPerson = (partyMembers, personId) => {
  const selectedMember = partyMembers.find(pm => pm.personId === personId);
  const enhancedPerson = {
    ...selectedMember.person,
    otherMembers: partyMembers.filter(pm => pm.memberType !== selectedMember.memberType),
    guaranteedBy: selectedMember.guaranteedBy,
    memberType: selectedMember.memberType,
  };
  return { ...selectedMember, person: enhancedPerson };
};
