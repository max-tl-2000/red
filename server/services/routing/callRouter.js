/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { updateTeam, getAgentsForPhoneCalls } from '../../dal/teamsRepo';
import loggerModule from '../../../common/helpers/logger';
import { getPartyRoutingUserId } from './partyRouter';
import { usersSortOrder, CallReceiverType, CommTargetType } from './targetUtils';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'partyRouting' });

const getOwnerId = (ctx, team) => getPartyRoutingUserId(ctx, { targetContext: { type: CommTargetType.TEAM }, team });

const getNextUserId = (userIds, team) => {
  let nextUserId;
  if (team.metadata.lastAssignedUser) {
    const prevUserPosition = userIds.indexOf(team.metadata.lastAssignedUser);
    const nextUserIndex = (prevUserPosition + 1) % userIds.length;
    nextUserId = userIds[nextUserIndex];
  } else {
    [nextUserId] = userIds;
  }
  return nextUserId;
};

const getRoutingStrategy = strategyName => {
  switch (strategyName) {
    case DALTypes.CallRoutingStrategy.ROUND_ROBIN:
      // In the first phase the Round Robin algorithm will consist of:
      // 1. retrieve the users from the database ordered by their name (fullName).
      // 2. if we have a lastAssignedUser for the team => look for it in the returned users list, and return the next one.
      // 3. save the next user as the lastAssignedUser in the database.
      return async (ctx, team) => {
        const userIds = await getAgentsForPhoneCalls({ ctx, teamId: team.id, sortOrder: usersSortOrder });
        const nextUserId = getNextUserId(userIds, team);
        if (!nextUserId) return { ids: [], type: CallReceiverType.REVA_USER };
        await updateTeam(ctx, team.id, {
          metadata: {
            lastAssignedUser: nextUserId,
          },
        });
        return { ids: [nextUserId], type: CallReceiverType.REVA_USER };
      };

    case DALTypes.CallRoutingStrategy.CALL_CENTER:
      return (ctx, team) => ({
        ids: [team.id],
        type: CallReceiverType.CALL_CENTER,
      });

    case DALTypes.CallRoutingStrategy.EVERYBODY:
      return async (ctx, team) => ({
        ids: await getAgentsForPhoneCalls({ ctx, teamId: team.id, shouldBeAvailable: false, sortOrder: usersSortOrder }),
        type: CallReceiverType.REVA_USER,
      });

    case DALTypes.CallRoutingStrategy.OWNER:
    default:
      return async (ctx, team) => ({
        ids: [await getOwnerId(ctx, team)],
        type: CallReceiverType.REVA_USER,
      });
  }
};

export const getCallRoutingReceivers = (ctx, team) => {
  const strategy = getRoutingStrategy(team.metadata.callRoutingStrategy);
  logger.info({ ctx, callRoutingStrategy: team.metadata.callRoutingStrategy }, `Call routing strategy: ${team.metadata.callRoutingStrategy}`);

  return strategy(ctx, team);
};
