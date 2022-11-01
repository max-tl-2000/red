/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { getDisplayName } from '../../common/helpers/person-helper';

export const infoToDisplayOnPerson = guest => {
  if (!guest || !guest.person) return '';

  const { person } = guest;
  return getDisplayName(person);
};

export function orderedGuestNames(guestsList) {
  const residents = guestsList.filter(r => r.memberType === DALTypes.MemberType.RESIDENT);
  const cosign = guestsList.filter(c => c.memberType !== DALTypes.MemberType.RESIDENT);

  const listOrdering = list =>
    list
      .map(guest => infoToDisplayOnPerson(guest))
      .sort()
      .reduce((prev, curr) => `${prev} ${curr},`, '');

  return (listOrdering(residents) + listOrdering(cosign)).slice(0, -1);
}
