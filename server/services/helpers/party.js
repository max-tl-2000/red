/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';
import { partyStatesOrder, partyWorkFlowNameOrder } from '../../helpers/party';
import { toMoment } from '../../../common/helpers/moment-utils';
import { isCorporateLeaseType as isCorporateLeaseTypeService } from '../party';
import { getCachedEntity } from '../../helpers/cacheHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPrimaryExternalInfoByParty } from '../../dal/exportRepo';
import { getTeamsForUsers } from '../../dal/teamsRepo';
import { loadPartyById, updatePartyTeams as updatePartyTeamsDb } from '../../dal/partyRepo';
import { isDateAfterDate } from '../../../common/helpers/date-utils';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'partyHelpers' });

const PartyMergeSortCriteria = {
  Appointment: 1,
  Payment: 2,
  ActiveLeaseOrRenewal: 10,
};

const computePartyMergeScore = partyInfo => {
  let partyMergeScore = 0;

  const payments = partyInfo.applicationPayments?.personApplications.filter(
    pA =>
      pA.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED &&
      partyInfo.applicationPayments.applicationInvoices.some(aI => aI.personApplicationId === pA.id),
  ).length;
  payments && (partyMergeScore += PartyMergeSortCriteria.Payment);

  partyInfo.tasks?.find(task => task.name === DALTypes.TaskNames.APPOINTMENT && task.state === DALTypes.TaskStates.COMPLETED) &&
    (partyMergeScore += PartyMergeSortCriteria.Appointment);

  partyMergeScore += partyStatesOrder.indexOf(partyInfo.party.state);

  partyMergeScore +=
    partyInfo.party?.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE || partyInfo.party?.workflowName === DALTypes.WorkflowName.RENEWAL
      ? PartyMergeSortCriteria.ActiveLeaseOrRenewal
      : 0;

  return partyMergeScore;
};

// 1. If one party has a payment and the other does not, always choose that party (regardless of state or updated_at)
// For example, a Prospect with a tour and a Prospect with a completed application, always choose the latter (regardless of the party updated_at)
// 2. If both parties have payments, then choose the more advanced party, and if they are of the same state, choose the one with the later updated_at
// 3. Otherwise, if one party has a completed appointment, and one does not, always choose the party with the completed appointment (regardless of state or updated_at)
// 4. If both parties have appointments, then choose the more advanced party, and if they are of the same state, choose the one with the later updated_at.
// 5. If one of the parties is an activeLease or a renewal type of party, always pick that one (regardless of any other criteria)
const partyMergeComparator = (firstParty, secondParty) => {
  const firstPartyScore = computePartyMergeScore(firstParty);
  const secondPartyScore = computePartyMergeScore(secondParty);

  if (firstPartyScore === secondPartyScore) {
    return isDateAfterDate(secondParty.party.updated_at, firstParty.party.updated_at, 'milliseconds') ? 1 : -1;
  }

  return secondPartyScore - firstPartyScore;
};

export const sortPartiesForMerge = parties => parties.sort(partyMergeComparator);

export const sortPartiesByWorkFlowName = parties => sortBy(parties, party => partyWorkFlowNameOrder.indexOf(party.workflowName));

export const getNameForExportedLease = async (ctx, lease) => {
  const { id: leaseId, baselineData, partyId } = lease;
  const externalInfo = await getPrimaryExternalInfoByParty(ctx, partyId);
  const { externalId } = externalInfo || {};
  const { publishedLease, timezone } = baselineData || {};
  const { leaseStartDate } = publishedLease;
  const formatedDate = toMoment(leaseStartDate, { timezone }).format('YYYY-MM-DD');
  const unitName = baselineData.quote.unitFullQualifiedName;
  const externalIdFormatted = externalId ? `${externalId}_` : '';

  const uploadFileName = `${externalIdFormatted}${unitName}_${formatedDate}_${leaseId}.pdf`.replace(' ', '_').replace(/\//g, '-');

  return uploadFileName;
};

export const isCorporateLeaseType = async (ctx, partyId) => {
  const cachedIsCorporateLeaseType = getCachedEntity(ctx, { type: 'isCorporateLeaseType', id: partyId });
  return cachedIsCorporateLeaseType !== null ? cachedIsCorporateLeaseType : await isCorporateLeaseTypeService(ctx, partyId);
};

export const getCompanyName = async (ctx, isCorporateParty, partyMembers) => {
  const [pointOfContact] = (isCorporateParty && partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT)) || [];
  return pointOfContact?.displayName || '';
};

export const updatePartyTeams = async (ctx, data) => {
  const { partyId, userIds: newPartyCollaboratorIds, manuallySelectedTeamId } = data;
  const { teams: currentPartyTeams } = await loadPartyById(ctx, partyId);
  const newCollaboratorsTeams = manuallySelectedTeamId
    ? [manuallySelectedTeamId]
    : (await getTeamsForUsers(ctx, newPartyCollaboratorIds, { excludeInactiveTeams: false })).map(t => t.id);

  const existingCollaboratorsTeams = currentPartyTeams.filter(id => newCollaboratorsTeams.includes(id));
  logger.trace({ ctx, partyId, newPartyCollaboratorIds, currentPartyTeams, newCollaboratorsTeams, existingCollaboratorsTeams }, 'updatePartyTeams - data');

  return existingCollaboratorsTeams.length ? currentPartyTeams : await updatePartyTeamsDb(ctx, partyId, newCollaboratorsTeams);
};
