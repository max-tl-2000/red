/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../../../../common/enums/DALTypes';
import { PROPERTY_SCENARIOS } from './screening-party-data';

const { MemberType, PartyTypes } = DALTypes;

export const getParties = properties => {
  const parties = {
    ALL_REPORTS_REQUIRED: {
      COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES: {
        ID: 0,
        partyData: { partyType: PartyTypes.CORPORATE, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [],
      },
    },
  };

  return parties;
};
