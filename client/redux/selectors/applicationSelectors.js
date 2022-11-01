/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import { allowedToReviewApplication } from 'acd/access';
import get from 'lodash/get';
import { DALTypes } from 'enums/DALTypes';
import { getParty, getPartyMembers } from './partySelectors';
import { getScreeningSummary } from './screeningSelectors';
import { hasItemFromList, isEmptyList } from '../../../common/helpers/list-utils';

export const isUserAllowedToReviewApplication = createSelector(
  getParty,
  state => state.auth.user,
  (party, currentUser) => {
    if (!party || !currentUser) return false;
    return allowedToReviewApplication(currentUser, party);
  },
);

export const getApplicantsWithDisclosures = createSelector(getPartyMembers, partyMembers =>
  Array.from(partyMembers.filter(pm => get(pm, 'application.additionalData.disclosures'))),
);

export const isPartyApplicationOnHold = createSelector(getScreeningSummary, screeningSummary => !!screeningSummary.isPartyApplicationOnHold);

export const getScreeningHoldReasons = createSelector(getScreeningSummary, screeningSummary => {
  let isManualHoldType;
  // FIXME legacy code for cases that isHeld is true but it don't have holdReasons
  if (screeningSummary.isPartyApplicationOnHold && isEmptyList(screeningSummary.holdReasons)) {
    isManualHoldType = true;
  } else {
    isManualHoldType = hasItemFromList(screeningSummary.holdReasons, DALTypes.HoldReasonTypes.MANUAL);
  }
  const isInternationalHoldType = hasItemFromList(screeningSummary.holdReasons, DALTypes.HoldReasonTypes.INTERNATIONAL);
  const isGuarantorLinkedHoldType = hasItemFromList(screeningSummary.holdReasons, DALTypes.HoldReasonTypes.RESIDENT_GUARANTOR_LINK);
  return { isManualHoldType, isInternationalHoldType, isGuarantorLinkedHoldType };
});

export const areAllApplicationsCompleted = createSelector(
  (state, props) => props.members,
  members => members.every(member => member.application && member.application.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED),
);

export const getOtherPartiesApplications = createSelector(
  state => state.dataStore.get('otherPartiesApplications'),
  state => state.dataStore.get('applications'),
  (state, props) => getPartyMembers(state, props),
  (state, props) => props.partyId,
  (otherPartiesApplications, applications, partyMembers, partyId) => {
    const partyApplications = applications.filter(app => app.partyId === partyId);
    return otherPartiesApplications.filter(
      opa => !partyApplications.some(a => a.personId === opa.personId) && partyMembers.map(pm => pm.personId).includes(opa.personId),
    );
  },
);
