/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../common/helpers/logger';
import { postEntity, partyReassignEndpoint, archivePartyEndpoint } from '../utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';

const isDispatcher = teamMember => teamMember.functionalRoles.includes(FunctionalRoleDefinition.LD.name);

const isSameUserInAnotherLeasingTeam = (reassignableTeamMembers, userId) =>
  reassignableTeamMembers.find(tm => tm.userId === userId && tm.teamModule !== DALTypes.ModuleType.RESIDENT_SERVICES);

const isSameUserInAnotherRSTeam = (reassignableTeamMembers, userId) =>
  reassignableTeamMembers.find(tm => tm.userId === userId && tm.teamModule === DALTypes.ModuleType.RESIDENT_SERVICES);

const isDispatcherInAnotherLeasingTeam = reassignableTeamMembers =>
  reassignableTeamMembers.find(tm => isDispatcher(tm) && tm.teamModule !== DALTypes.ModuleType.RESIDENT_SERVICES);

const isDispatcherInAnotherRSTeam = reassignableTeamMembers =>
  reassignableTeamMembers.find(tm => isDispatcher(tm) && tm.teamModule === DALTypes.ModuleType.RESIDENT_SERVICES);

const computeNewLeaseReassignableTeam = ({
  sameUserInAnotherLeasingTeam,
  sameUserInAnotherRSTeam,
  dispatcherInAnotherLeasingTeam,
  dispatcherInAnotherRSTeam,
}) => {
  if (sameUserInAnotherLeasingTeam) {
    return { teamId: sameUserInAnotherLeasingTeam.teamId, userId: sameUserInAnotherLeasingTeam.userId };
  }
  if (dispatcherInAnotherLeasingTeam) {
    return { teamId: dispatcherInAnotherLeasingTeam.teamId, userId: dispatcherInAnotherLeasingTeam.userId };
  }
  if (sameUserInAnotherRSTeam) {
    return { teamId: sameUserInAnotherRSTeam.teamId, userId: sameUserInAnotherRSTeam.userId };
  }
  if (dispatcherInAnotherRSTeam) {
    return { teamId: dispatcherInAnotherRSTeam.teamId, userId: dispatcherInAnotherRSTeam.userId };
  }

  return { shouldArchive: true, reason: DALTypes.ArchivePartyReasons.PROPERTY_OFFBOARDED };
};

const computeActiveLeaseReassignableTeam = ({
  sameUserInAnotherLeasingTeam,
  sameUserInAnotherRSTeam,
  dispatcherInAnotherLeasingTeam,
  dispatcherInAnotherRSTeam,
}) => {
  if (sameUserInAnotherRSTeam) {
    return { teamId: sameUserInAnotherRSTeam.teamId, userId: sameUserInAnotherRSTeam.userId };
  }
  if (dispatcherInAnotherRSTeam) {
    return { teamId: dispatcherInAnotherRSTeam.teamId, userId: dispatcherInAnotherRSTeam.userId };
  }
  if (sameUserInAnotherLeasingTeam) {
    return { teamId: sameUserInAnotherLeasingTeam.teamId, userId: sameUserInAnotherLeasingTeam.userId };
  }
  if (dispatcherInAnotherLeasingTeam) {
    return { teamId: dispatcherInAnotherLeasingTeam.teamId, userId: dispatcherInAnotherLeasingTeam.userId };
  }

  return { shouldArchive: true, reason: DALTypes.ArchivePartyReasons.PROPERTY_OFFBOARDED };
};

const computeRenewalLeaseReassignableTeam = ({ dispatcherInAnotherLeasingTeam, dispatcherInAnotherRSTeam }) => {
  if (dispatcherInAnotherRSTeam) {
    return { teamId: dispatcherInAnotherRSTeam.teamId, userId: dispatcherInAnotherRSTeam.userId };
  }
  if (dispatcherInAnotherLeasingTeam) {
    return { teamId: dispatcherInAnotherLeasingTeam.teamId, userId: dispatcherInAnotherLeasingTeam.userId };
  }

  return { shouldArchive: true, reason: DALTypes.ArchivePartyReasons.PROPERTY_OFFBOARDED };
};

const computeReassignableTeam = (workflowName, userId, reassignableTeamMembers) => {
  if (!reassignableTeamMembers?.length) {
    return {
      reason: DALTypes.ArchivePartyReasons.PROPERTY_OFFBOARDED,
      shouldArchive: true,
    };
  }

  const sameUserInAnotherLeasingTeam = isSameUserInAnotherLeasingTeam(reassignableTeamMembers, userId);
  const sameUserInAnotherRSTeam = isSameUserInAnotherRSTeam(reassignableTeamMembers, userId);
  const dispatcherInAnotherLeasingTeam = isDispatcherInAnotherLeasingTeam(reassignableTeamMembers);
  const dispatcherInAnotherRSTeam = isDispatcherInAnotherRSTeam(reassignableTeamMembers);

  if (workflowName === DALTypes.WorkflowName.NEW_LEASE) {
    return computeNewLeaseReassignableTeam({
      sameUserInAnotherLeasingTeam,
      sameUserInAnotherRSTeam,
      dispatcherInAnotherLeasingTeam,
      dispatcherInAnotherRSTeam,
    });
  }
  if (workflowName === DALTypes.WorkflowName.RENEWAL) {
    return computeRenewalLeaseReassignableTeam({ dispatcherInAnotherLeasingTeam, dispatcherInAnotherRSTeam });
  }
  return computeActiveLeaseReassignableTeam({
    sameUserInAnotherLeasingTeam,
    sameUserInAnotherRSTeam,
    dispatcherInAnotherLeasingTeam,
    dispatcherInAnotherRSTeam,
  });
};

export const processReassignParty = async (ctx, party, token, isFakeCall) => {
  logger.trace({ ctx, partyId: party.id }, 'processReassignParty - start');
  const reassignPartyEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED);
  if (!reassignPartyEvent) return {};

  const reassignEndpoint = partyReassignEndpoint(party.callBackUrl, party.id);
  const archiveEndpoint = archivePartyEndpoint(party.callBackUrl, party.id);

  const { userId, id: partyId, workflowName } = party;
  const { reassignableTeamMembers } = reassignPartyEvent.metadata;

  const body = computeReassignableTeam(workflowName, userId, reassignableTeamMembers);
  if (isFakeCall) return body;

  const endpoint = body.shouldArchive ? archiveEndpoint : reassignEndpoint;
  const { error } = await postEntity(ctx, body, endpoint, token);

  if (error) {
    logger.error({ ctx, error, partyId }, 'processReassignParty - error');
    return { error };
  }

  logger.trace({ ctx, partyId }, 'processReassignParty - done');

  return {};
};
