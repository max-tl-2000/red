/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import intersection from 'lodash/intersection';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import { getUserStatusByUserId, saveUserStatusWrapUpCallTimeoutId, saveUserStatusLoginTimeoutId } from '../../dal/usersRepo';
import { getTeamById, getAvailableAgentsForPhoneCalls, getTeamsForUsers, getTeamMemberByTeamAndUser } from '../../dal/teamsRepo';
import * as commsRepo from '../../dal/communicationRepo';
import { getQueuedCalls } from '../../dal/callQueueRepo';
import { updateStatusForUsers, loadUsersByIds } from '../users';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import loggerModule from '../../../common/helpers/logger';
import { getTelephonyOps } from './providerApiOperations';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import * as endpoints from './endpoints';
import config from '../../config';

const logger = loggerModule.child({ subType: 'telephony-userAvailability' });

const filterUsersInLiveCalls = async (ctx, userIds, currentEndingCallId) => {
  const { auth } = await getTelephonyConfigs(ctx);
  const liveCallsData = await getTelephonyOps().getLiveCalls(auth);
  const liveCallIds = liveCallsData.map(callData => callData.id);

  // the current ending call that this function reacts to is still
  // live at this point from provider's pov -> we must diregard it
  const exceptCurrentEndingCall = liveCallIds.filter(id => id !== currentEndingCallId);
  logger.trace({ ctx, liveCalls: exceptCurrentEndingCall }, 'live calls except current ending call');

  const usersInCalls = (await commsRepo.loadCallsByCallIds(ctx, exceptCurrentEndingCall)).map(c => c.userId).filter(id => !!id);
  logger.trace({ ctx, usersInCalls }, 'users being assigned to calls');

  const getCalledAgents = ({ firedCallsToAgents }) =>
    Object.keys(firedCallsToAgents).filter(userId => intersection(firedCallsToAgents[userId], exceptCurrentEndingCall).length);
  const usersBeingCalledForQueue = flatten((await getQueuedCalls(ctx)).map(getCalledAgents));
  logger.trace({ ctx, usersBeingCalledForQueue }, 'users being called for queue');
  const liveCallsUserIds = new Set([...usersInCalls, ...usersBeingCalledForQueue]);

  return partition(userIds, id => liveCallsUserIds.has(id));
};

export const markUsersAvailable = async (ctx, userIds, currentEndingCallId) => {
  logger.info({ ctx, userIds, currentEndingCallId }, 'markUsersAvailable');

  if (!userIds.length) return;
  const [inLiveCalls, notInLiveCalls] = await filterUsersInLiveCalls(ctx, userIds, currentEndingCallId);

  if (inLiveCalls.length) {
    logger.trace({ ctx, inLiveCalls }, 'users involved in live calls - not marking them available');
  }

  const busyUsers = (await loadUsersByIds(ctx, notInLiveCalls)).filter(u => u.metadata.status === DALTypes.UserStatus.BUSY);

  if (busyUsers.length) {
    logger.trace({ ctx, busyUsers: busyUsers.map(({ id, fullName }) => ({ id, fullName })) }, 'marking users involved in call as available');
    await updateStatusForUsers(
      ctx,
      busyUsers.map(u => u.id),
      DALTypes.UserStatus.AVAILABLE,
    );
  } else {
    logger.trace(
      {
        ctx,
        usersToMarkAvailable: userIds,
        currentEndingCallId,
        usersInLiveCalls: inLiveCalls,
      },
      'No eligible users for status update',
    );
  }
};

let testScheduler; // scheduler will only be used in testing envs

const scheduleForLater = (...args) => {
  if (testScheduler?.scheduleForLater) {
    return testScheduler?.scheduleForLater(...args);
  }

  return setTimeout(...args);
};

export const setScheduler = _scheduler => {
  if (!_scheduler?.scheduleForLater) {
    throw new TypeError('scheduler instance must provide a `scheduleForLater` function');
  }
  testScheduler = _scheduler;
};

export const clearScheduler = () => {
  testScheduler = null;
};

const wrapUpCall = async (ctx, userId, teamId, callId) => {
  logger.info({ ctx, userId, teamId }, 'wrapUpCall');
  if (!userId) return;

  const team = await getTeamById(ctx, teamId);
  const { notAvailableSetAt } = await getUserStatusByUserId(ctx, userId);
  const userSetManuallyAsNotAvailable = !!notAvailableSetAt;

  const markUser = async newCtx => {
    const innerCtx = newCtx || ctx;

    userSetManuallyAsNotAvailable
      ? await updateStatusForUsers(innerCtx, [userId], DALTypes.UserStatus.NOT_AVAILABLE)
      : await markUsersAvailable(innerCtx, [userId], callId);
  };

  const delaySeconds = (team.metadata.call || {}).wrapUpDelayAfterCallEnds;

  if (!userSetManuallyAsNotAvailable && delaySeconds) {
    const wrapUpCallTimeoutId = newId();
    await saveUserStatusWrapUpCallTimeoutId(ctx, userId, wrapUpCallTimeoutId);

    scheduleForLater(async () => {
      try {
        logger.info({ ctx, userId, teamId }, 'wrap up time expired, attempting to set user available');
        const { trx, ...timeoutCtx } = ctx;
        const userStatus = await getUserStatusByUserId(timeoutCtx, userId);
        if (userStatus.wrapUpCallTimeoutId === wrapUpCallTimeoutId) await markUser(timeoutCtx);
      } catch (error) {
        logger.error({ ctx, userId, teamId, callId, error }, 'wrapUpCall error while making user available');
      }
    }, delaySeconds * 1000);

    notify({
      ctx,
      event: eventTypes.START_WRAPUP_CALL,
      data: { wrapUpTime: delaySeconds },
      routing: { users: [userId] },
    });
  } else {
    await markUser();
  }
};

export const markUsersInvolvedInCallAsAvailable = async (ctx, comm) => {
  const involvedUserIds = Object.keys(comm.message.receiversEndpointsByUserId || {}).filter(id => !!id && id !== comm.userId);

  await markUsersAvailable(ctx, involvedUserIds, comm.messageId);
  await wrapUpCall(ctx, comm.userId, comm.teams[0], comm.messageId);
};

// don't call if:
// 1) user is not AVAILABLE
// 2) none of the user SIP endpoints are online
// 3) user doesn't have any ringPhones
export const canUserBeCalled = async (ctx, user) => {
  const onlineEndpoints = await endpoints.getOnlineSipEndpoints(ctx, user);
  const canBeCalled = user.metadata.status === DALTypes.UserStatus.AVAILABLE && (onlineEndpoints.length || user.ringPhones?.length);

  logger.trace({ ctx, userName: user.fullName, canBeCalled: !!canBeCalled }, 'determined if user can be called');

  return canBeCalled;
};

export const getOnlineAgentsForPhoneCallsByTeamId = async (ctx, teamId) => {
  const availableAgents = await getAvailableAgentsForPhoneCalls(ctx, teamId);
  const availableAgentsWithStatus = await mapSeries(availableAgents, async agent => {
    const isOnline = !!agent?.ringPhones.length || !!(await endpoints.getOnlineSipEndpoints(ctx, agent)).length;
    return {
      ...agent,
      isOnline,
    };
  });

  const onlineAgents = availableAgentsWithStatus.filter(agent => agent.isOnline);

  return onlineAgents;
};

export const setAvailabilityDelayAtLogin = async (ctx, user) => {
  const teams = await getTeamsForUsers(ctx, [user.id], { excludeInactiveTeams: false });
  const teamIds = teams.map(t => t.id);

  logger.info({ ctx, userId: user.id, teamIds }, 'setAvailabilityDelayAtLogin');
  if (!user?.id) return;

  const markUser = async newCtx => {
    const innerCtx = newCtx || ctx;

    await updateStatusForUsers(innerCtx, [user.id], DALTypes.UserStatus.AVAILABLE);
  };

  const delayTimes = teams.map(team => ({
    id: team.id,
    delay: team.metadata.call?.initialDelayAfterSignOn,
  }));

  let teamId;

  let availabilityDelaySeconds;
  if (delayTimes.length) {
    const maxTime = Math.max(...delayTimes.map(time => time.delay));
    teamId = maxTime ? delayTimes.find(time => time.delay === maxTime).id : delayTimes[0].id;

    if (maxTime === 0) {
      logger.info({ ctx, userId: user.id, teamIds }, 'setAvailabilityDelayAtLogin - maxTime set at 0 on all teams, setting user as Available');

      await markUser(ctx);

      return;
    }

    availabilityDelaySeconds = maxTime || config.initialDelayAfterSignOn;
  } else {
    availabilityDelaySeconds = config.initialDelayAfterSignOn;
  }

  const teamMember = teamId && (await getTeamMemberByTeamAndUser(ctx, teamId, user.id));
  const isTeamMemberLWA = teamMember?.functionalRoles.includes(FunctionalRoleDefinition.LWA.name);

  if (!isTeamMemberLWA) {
    logger.info({ ctx, userId: user.id, teamId }, 'setAvailabilityDelayAtLogin - user is not an LWA in the team');

    await markUser(ctx);
    return;
  }

  const loginTimeoutId = newId();
  await saveUserStatusLoginTimeoutId(ctx, user.id, loginTimeoutId);

  scheduleForLater(async () => {
    try {
      logger.info({ ctx, userId: user.id, teamIds }, 'login delay expired, attempting to set user available');
      const { trx, ...timeoutCtx } = ctx;
      const userStatus = await getUserStatusByUserId(timeoutCtx, user.id);
      if (userStatus.loginTimeoutId === loginTimeoutId) await markUser(timeoutCtx);
    } catch (error) {
      logger.error({ ctx, userId: user.id, teamIds, error }, 'login delay error while making user available');
    }
  }, availabilityDelaySeconds * 1000);

  notify({
    ctx,
    event: eventTypes.START_WRAPUP_CALL,
    data: { wrapUpTime: availabilityDelaySeconds },
    routing: { users: [user.id], teams: teamIds },
  });
};
