/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { updateTeam, getAvailableOrBusyAgentIds, getDispatcherId, getTeamMemberById } from '../../dal/teamsRepo';
import loggerModule from '../../../common/helpers/logger';
import { usersSortOrder, CommTargetType } from './targetUtils';
import { isDuringOfficeHours } from '../teams';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'partyRouting' });

const getNextUserId = (userIds, lastAssignedUserId) => {
  const nextUserIndex = (userIds.indexOf(lastAssignedUserId) + 1) % userIds.length;
  return userIds[nextUserIndex];
};

const getUserIdByStrategy = async (ctx, { strategy, team, avoidAssigningToDispatcher, preferredPartyOwnerId }) => {
  if (strategy === DALTypes.PartyRoutingStrategy.ROUND_ROBIN) {
    if (preferredPartyOwnerId) return preferredPartyOwnerId;
    const includeDispatcher = !avoidAssigningToDispatcher;
    const userIds = (await isDuringOfficeHours(ctx, team)) ? await getAvailableOrBusyAgentIds(ctx, team.id, usersSortOrder, includeDispatcher) : [];

    if (userIds.length) {
      const nextUserId = getNextUserId(userIds, team.metadata.lastAssignedUser);
      await updateTeam(ctx, team.id, { metadata: { lastAssignedUser: nextUserId } });
      return nextUserId;
    }
  }

  // dispatcher strategy and situations not resolved above
  return await getDispatcherId(ctx, team.id);
};

export const getPartyRoutingUserId = async (ctx, { targetContext, team, avoidAssigningToDispatcher, preferredPartyOwnerId }) => {
  logger.trace({ ctx, targetContext, teamData: team, avoidAssigningToDispatcher, preferredPartyOwnerId }, 'getPartyRoutingUserId params');

  switch (targetContext.type) {
    case CommTargetType.PARTY:
    case CommTargetType.TEAM:
    case CommTargetType.PROGRAM: {
      const strategy = team.metadata.partyRoutingStrategy;
      logger.info({ ctx, strategy }, 'Party routing strategy');
      return await getUserIdByStrategy(ctx, { strategy, team, avoidAssigningToDispatcher, preferredPartyOwnerId });
    }
    case CommTargetType.INDIVIDUAL:
      return targetContext.id;
    case CommTargetType.TEAM_MEMBER: {
      const { userId } = await getTeamMemberById(ctx, targetContext.id);
      return userId;
    }
    default:
      return undefined;
  }
};
