/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';

export const areAllGuarantorsLinkedToMembers = (partyMembers = []) => {
  const guarantors = partyMembers.filter(partyMember => partyMember.memberType === DALTypes.MemberType.GUARANTOR);
  return guarantors.every(guarantor => partyMembers.some(partyMember => partyMember.guaranteedBy === guarantor.id));
};
