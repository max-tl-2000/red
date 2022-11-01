/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { getTeamMembersBy, getTeamsWhereUserIsAgent, getTeamById } from '../dal/teamsRepo';
import * as partyRepo from '../dal/partyRepo';
import { assignParty } from './party';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
const logger = loggerModule.child({ subType: 'partyService' });

const getDispatcher = async (ctx, teamId) => {
  const query = q => q.where('functionalRoles', '@>', `{${FunctionalRoleDefinition.LD.name}}`);
  const [dispatcher] = await getTeamMembersBy(ctx, teamId, query);
  return dispatcher;
};

const shouldUpdatePartyOwner = async (ctx, partyOwnerTeamId, ownerUserId) => {
  const isPartyManualAssign = !!ctx.isManualAssign;
  logger.trace({ ctx, isPartyManualAssign, partyOwnerTeamId, ownerUserId }, 'shouldUpdatePartyOwner');
  const modifiedBy = ctx.authUser && ctx.authUser.id;
  if (!modifiedBy || isPartyManualAssign) return false;

  const team = await getTeamById(ctx, partyOwnerTeamId);
  const dispatcher = (await getDispatcher(ctx, partyOwnerTeamId)) || {};

  if (team.module === DALTypes.ModuleType.RESIDENT_SERVICES) return false;

  const isPartyOwnerDispatcher = dispatcher.userId === ownerUserId;
  const isRequestFromPartyOwner = modifiedBy === ownerUserId;
  if (!isPartyOwnerDispatcher || isRequestFromPartyOwner) return false;

  const teamsWhereUserIsAgent = (await getTeamsWhereUserIsAgent(ctx, modifiedBy)).map(t => t.id);
  const result = teamsWhereUserIsAgent.includes(partyOwnerTeamId);
  logger.trace({ ctx, partyOwnerTeamId, ownerUserId, result }, 'shouldUpdatePartyOwner result');
  return result;
};

const updateCollaborators = async (ctx, party, collaboratorIds) => {
  const { collaborators: existingCollaborators } = party;

  const areAlreadyCollaborators = collaboratorIds.every(pId => existingCollaborators.includes(pId));
  if (!areAlreadyCollaborators) await partyRepo.updatePartyCollaborators(ctx, party.id, collaboratorIds);
};

export const assignPartyOrUpdateCollaborators = async (ctx, partyId, userIds) => {
  const party = await partyRepo.loadPartyById(ctx, partyId);
  const { ownerTeam, userId: ownerUser, teams } = party;
  const shouldUpdateOwner = await shouldUpdatePartyOwner(ctx, ownerTeam, ownerUser);
  const checkConflictingAppointments = false;
  const reassingReason = '';
  shouldUpdateOwner
    ? await assignParty(ctx, party, { userId: ctx.authUser.id }, checkConflictingAppointments, reassingReason)
    : await updateCollaborators(ctx, party, userIds);
  shouldUpdateOwner &&
    (await notify({
      ctx,
      routing: { teams },
      event: eventTypes.OWNER_CHANGED,
      data: { partyId: party.id, name: ctx.authUser.fullName },
    }));
};
