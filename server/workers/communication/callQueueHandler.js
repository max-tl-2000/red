/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import flatten from 'lodash/flatten';
import { mapSeries, filter as promiseFilter } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import * as repo from '../../dal/callQueueRepo';
import { getTeamById, getTeamsWhereUserIsAgent, lockAgentsForCallQueueSortedByLastCallTime, unlockAgentsForCallQueue } from '../../dal/teamsRepo';
import { loadMessageById } from '../../dal/communicationRepo';
import { callAgentsForQueue, handleTeamsCallQueueChangeNotification, hangupCalls } from '../../services/telephony/callQueuing';
import { sendMessage } from '../../services/pubsub';
import { saveMissedCallEvent, saveCommunicationCompletedEvent } from '../../services/partyEvent';
import { APP_EXCHANGE, CALLS_QUEUE_MESSAGE_TYPE } from '../../helpers/message-constants';
import { runInTransaction } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { canUserBeCalled, getOnlineAgentsForPhoneCallsByTeamId } from '../../services/telephony/userAvailability';
import * as actions from '../../services/telephony/callActions';
import config from '../../config';

const { telephony } = config;
const logger = loggerModule.child({ subType: 'callQueueHandler' });

const getFiredCallsToAgents = call => flatten(Object.values(call.firedCallsToAgents));

const sendCallQueueTimeoutMessage = ({ ctx, commId, teamId }) =>
  sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.CALL_QUEUE_TIMEOUT,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
      teamId,
    },
    ctx: { tenantId: ctx.tenantId },
  });

export const dequeueCallAfterTimeout = async ({ ctx, commId, teamId }) => {
  const { metadata: settings } = await getTeamById(ctx, teamId);

  setTimeout(() => sendCallQueueTimeoutMessage({ ctx, commId, teamId }), settings.callQueue.timeToVoiceMail * 1000);
};

let dequeueCallAfterTimeoutFunc = dequeueCallAfterTimeout;

export const setDequeueCallAfterTimeoutFunc = func => {
  dequeueCallAfterTimeoutFunc = func;
};

export const resetDequeueCallAfterTimeoutFunc = () => {
  dequeueCallAfterTimeoutFunc = dequeueCallAfterTimeout;
};

export const callEnqueued = async ({ msgCtx: outerCtx, commId, teamId, transferredFrom }) => {
  logger.trace({ ctx: outerCtx, commId, teamId, transferredFrom }, 'handling call enqueued');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };

      const declinedByUserIds = transferredFrom ? [transferredFrom] : [];

      await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true, declinedByUserIds });
      await repo.addCallQueueStats(ctx, { communicationId: commId, entryTime: now() });
      await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [teamId] });
    }, outerCtx);

    await dequeueCallAfterTimeoutFunc({ ctx: outerCtx, commId, teamId });
  } catch (error) {
    // TODO: drop the call or redirect to voicemail if this happens
    logger.error({ ctx: outerCtx, error, commId }, 'failed to enque call');
  }

  // mark message as proceesed because we don't want to retry this action with a
  // delay as it will affect the call queue
  return { processed: true };
};

const callAgentsByTeamStrategy = async (ctx, userIds, teamId, callRoutingStrategy) => {
  logger.trace({ ctx, userIds, teamId, callRoutingStrategy }, 'calling agents for queued calls by strategy');

  switch (callRoutingStrategy) {
    case DALTypes.CallRoutingStrategy.EVERYBODY:
      {
        const dequeueForMultipleUsers = async ids => {
          const { call, usersThatDeclinedCall, usersThatCanBeCalled } = await repo.lockCallForDequeueForMultipleUsers({ ctx, teamId, userIds: ids });

          if (call) await callAgentsForQueue(ctx, usersThatCanBeCalled, call.commId);
          if (usersThatDeclinedCall.length) await dequeueForMultipleUsers(usersThatDeclinedCall);
        };

        logger.trace({ ctx, userIds }, 'attempting to connect a queued call to users by EVERYBODY strategy');
        await dequeueForMultipleUsers(userIds);
      }
      break;
    case DALTypes.CallRoutingStrategy.ROUND_ROBIN:
    default:
      await mapSeries(userIds, async userId => {
        const otherAvailableUserIds = userIds.filter(id => id !== userId);

        logger.trace({ ctx, userId, otherAvailableUserIds }, 'attempting to connect a queued call to user by ROUND ROBIN strategy');
        const isCallQueueEnabled = t => (t.metadata.callQueue || {}).enabled;
        const teamIds = (await getTeamsWhereUserIsAgent(ctx, userId)).filter(isCallQueueEnabled).map(t => t.id);

        const call = await repo.lockCallForDequeueForOneUser({ ctx, teamIds, userId, otherAvailableUserIds });

        if (call) await callAgentsForQueue(ctx, [userId], call.commId);
      });
      break;
  }
};

const dequeue = async (ctx, { commId, userId }) => {
  logger.trace({ ctx, commId, userId }, 'entering call dequeue process');

  let lwaUsers = [];
  let targetedUsers = [];

  try {
    ({ lwaUsers, targetedUsers } = await lockAgentsForCallQueueSortedByLastCallTime(ctx));
    const users = await promiseFilter(targetedUsers, async user => await canUserBeCalled(ctx, user));

    const getUserData = usersList => usersList.map(u => ({ id: u.id, fullName: u.fullName }));

    // targetedUsers - this contains all LWA users that are available and have lockedForCallQueueRouting = false
    // onlineUsers - this is a subset of targetedUsers, contains all users that have a WS connection active
    logger.trace(
      { ctx, lwaUsers, targetedUsers: getUserData(targetedUsers), onlineUsers: getUserData(users) },
      'call dequeue - targeted users locked for dequeuing calls',
    );

    if (!users.length) {
      logger.trace({ ctx }, 'no agents are available for taking queued calls');
      return;
    }

    const teamUserPairs = flatten(users.map(user => user.teams.map(teamId => ({ teamId, user }))));
    const usersByTeams = teamUserPairs.reduce(
      (acc, { teamId, user }) => ({
        ...acc,
        [teamId]: [...(acc[teamId] || []), user],
      }),
      {},
    );

    const targetedTeamsSortedByCallTime = await repo.getTargetedTeamsSortedByCallTime(ctx);

    await mapSeries(targetedTeamsSortedByCallTime, async teamId => {
      const areUsersAvailableForTargetedTeam = usersByTeams[teamId];
      if (!areUsersAvailableForTargetedTeam) return;

      const {
        metadata: { callRoutingStrategy },
      } = await getTeamById(ctx, teamId);

      const bookedUsers = new Set(await repo.getBookedUsers(ctx));
      const userIds = usersByTeams[teamId].map(u => u.id).filter(id => !bookedUsers.has(id));

      if (!userIds.length) {
        logger.trace({ ctx, availableUsers: usersByTeams[teamId], bookedUsers, teamId }, 'all users available for this team are booked for other calls');
        return;
      }

      await callAgentsByTeamStrategy(ctx, userIds, teamId, callRoutingStrategy);
    });
  } finally {
    const targetedUserIds = targetedUsers.map(u => u.id);
    logger.trace({ ctx, targetedUserIds }, 'exiting call dequeue proces - unlocking targeted users');
    await unlockAgentsForCallQueue(ctx, targetedUserIds);
  }
};

const removeCallDeclinedByAllAgents = async (ctx, commId) => {
  const removedCallQueue = await repo.removeCallFromQueue(ctx, commId);
  await actions.markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.QUEUE_DECLINED_BY_ALL);
  const { partyId } = await actions.assignCallPartyAccordingToRoutingStrategy(ctx, commId);
  await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });

  const transferredToVoiceMail = await actions.transferCallToVoicemail(ctx, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
  await repo.updateCallQueueStatsByCommId(ctx, commId, { transferredToVoiceMail });
  await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCallQueue.teamId], isFromRemoveCallQueue: true });
};

export const callReadyForDequeue = async ({ msgCtx: outerCtx, commId, declinedByUserId }) => {
  logger.trace({ ctx: outerCtx, commId, declinedByUserId }, 'handling call ready for dequeue');

  try {
    const shouldDequeue = await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };

      const unlockedCall = await repo.unlockCallForDequeue(ctx, commId, declinedByUserId);

      if (!unlockedCall) {
        logger.trace({ ctx, commId }, 'call to unlock no longer in queue');
        return false;
      }

      const { metadata: settings } = await getTeamById(ctx, unlockedCall.teamId);

      const expirationTime = toMoment(unlockedCall.created_at).add(settings.callQueue.timeToVoiceMail, 'seconds');

      const queueTimeExpired = expirationTime.isBefore(now());

      if (queueTimeExpired) {
        logger.trace({ ctx, commId }, 'time in queue expired for unlocked call, sending message to dequeue');
        await sendCallQueueTimeoutMessage({ ctx, ...unlockedCall });
        return false;
      }

      const onlineAgents = await getOnlineAgentsForPhoneCallsByTeamId(ctx, unlockedCall.teamId);
      const onlineAgentsIds = (onlineAgents || []).map(agent => agent.id);

      const agentsThatHaventDeclined = difference(onlineAgentsIds, unlockedCall.declinedByUserIds);
      if (agentsThatHaventDeclined.length === 0) {
        logger.trace(
          { ctx, commId, agentsThatDeclined: unlockedCall.declinedByUserIds, onlineAgentsIds },
          'queued call was declined by all online agents, sending to voicemail',
        );
        await removeCallDeclinedByAllAgents(ctx, commId);
        return false;
      }

      return true;
    }, outerCtx);

    if (shouldDequeue) await dequeue(outerCtx, { commId });
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to handle callReadyForDequeue ');
    return { processed: false };
  }

  return { processed: true };
};

export const callbackRequested = async ({ msgCtx: outerCtx, commId }) => {
  logger.trace({ ctx: outerCtx, commId }, 'handling callback requested');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCall = await repo.removeCallFromQueue(ctx, commId);

      if (!removedCall) return;
      await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

      await actions.handleCallbackRequest(ctx, commId);

      await repo.updateCallQueueStatsByCommId(ctx, commId, { callerRequestedAction: DALTypes.CallerRequestedAction.CALL_BACK });
      await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to remove call from queue on callback request');
    return { processed: false };
  }

  return { processed: true };
};

export const callHungUp = async ({ msgCtx: outerCtx, commId }) => {
  logger.trace({ ctx: outerCtx, commId }, 'handling call that was hung up');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCall = await repo.removeCallFromQueue(ctx, commId);

      if (removedCall) {
        const updatedComm = await actions.markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.NORMAL_QUEUE);

        await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

        await mapSeries(updatedComm.parties, async partyId => await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: updatedComm.id } }));
        const { partyId, userId } = await actions.assignCallPartyAccordingToRoutingStrategy(ctx, commId);
        await saveCommunicationCompletedEvent(ctx, { partyId, userId, metadata: { communicationId: updatedComm.id } });
        await repo.updateCallQueueStatsByCommId(ctx, commId, { hangUp: true });
        await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
      } else {
        const comm = await loadMessageById(ctx, commId);
        await mapSeries(
          comm.parties,
          async partyId =>
            await saveCommunicationCompletedEvent(ctx, { partyId, userId: comm.userId || comm.partyOwner, metadata: { communicationId: comm.id } }),
        );
      }
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to remove call from queue on hangup');
    return { processed: false };
  }

  return { processed: true };
};

export const handleUserAvailable = async ({ msgCtx, userId }) => {
  // we should not check this if the tenantId is admin as it does not have
  // the teams table and makes no sense to do this in the admin schema
  if (msgCtx.tenantId === 'admin') return { processed: true };

  logger.trace({ ctx: msgCtx, userId }, 'Call queue - handling user is available');

  setTimeout(async () => {
    try {
      await dequeue(msgCtx, { userId });
    } catch (error) {
      logger.error({ ctx: msgCtx, userId, error }, 'error on handleUserAvailable');
    }
  }, telephony.callQueueUserAvailabilityDelay);

  logger.trace({ ctx: msgCtx, userId }, 'handled user is available');

  return { processed: true };
};

export const callQueueTimeExpired = async ({ ctx: outerCtx, commId }) => {
  logger.trace({ ctx: outerCtx, commId }, 'handling callQueueTimeExpired');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCall = await repo.removeCallUnlessLockedForDequeue(ctx, commId);

      if (!removedCall) {
        logger.trace({ ctx, commId }, 'call was dequeued before time in queue expired or is locked for dequeue');
        return;
      }

      logger.info({ ctx, removedCall }, 'call was removed from queue because configured time expired, sending to voicemail');

      await actions.markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.QUEUE_TIME_EXPIRED);
      const { partyId } = await actions.assignCallPartyAccordingToRoutingStrategy(ctx, commId);
      await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });

      const transferredToVoiceMail = await actions.transferCallToVoicemail(ctx, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
      await repo.updateCallQueueStatsByCommId(ctx, commId, { transferredToVoiceMail });
      await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to remove call from queue on timeout');
    return { processed: false };
  }

  return { processed: true };
};

export const voicemailRequested = async ({ msgCtx: outerCtx, commId, programId, teamId }) => {
  logger.trace({ ctx: outerCtx, commId, programId, teamId }, 'handling voicemailRequested');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCall = await repo.removeCallFromQueue(ctx, commId);

      if (!removedCall) return;

      await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

      const transferredToVoiceMail = await actions.handleVoicemailRequest(ctx, {
        commId,
        programId,
        teamId,
        messageType: DALTypes.VoiceMessageType.VOICEMAIL,
      });
      await repo.updateCallQueueStatsByCommId(ctx, commId, { callerRequestedAction: DALTypes.CallerRequestedAction.VOICEMAIL, transferredToVoiceMail });
      await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to remove call from queue on voicemail requested');
    return { processed: false };
  }

  return { processed: true };
};

export const transferToNumberRequested = async ({ msgCtx: outerCtx, commId, number }) => {
  logger.trace({ ctx: outerCtx, commId, number }, 'handling transferToNumberRequested');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCall = await repo.removeCallFromQueue(ctx, commId);

      if (!removedCall) return;

      await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

      const transferred = await actions.handleTransferToNumberRequest(ctx, commId, number, DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME);

      if (transferred) {
        await repo.updateCallQueueStatsByCommId(ctx, commId, {
          callerRequestedAction: DALTypes.CallerRequestedAction.TRANSFER_TO_NUMBER,
          metadata: { transferToNumber: number },
        });

        await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
      }
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, commId }, 'failed to remove call from queue on transfer to number requested');
    return { processed: false };
  }

  return { processed: true };
};

export const handleEndOfDay = async ({ msgCtx: outerCtx, teamIds }) => {
  logger.time({ ctx: outerCtx, teamIds }, 'Recurring Jobs - Handling call queue end of work day');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCalls = await repo.dequeueCallsByTeamIds(ctx, teamIds);

      await mapSeries(removedCalls, async removedCall => {
        const commId = removedCall.commId;

        await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

        await actions.markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.QUEUE_END_OF_DAY);
        const { partyId } = await actions.assignCallPartyAccordingToRoutingStrategy(ctx, commId);
        await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });

        const transferredToVoiceMail = await actions.transferCallToVoicemail(ctx, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_CLOSING });
        await repo.updateCallQueueStatsByCommId(ctx, commId, { transferredToVoiceMail });
        await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
      });
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, teamIds, error }, 'Error handling call queue end of work day');
    return { processed: false };
  }
  logger.timeEnd({ ctx: outerCtx }, 'Recurring Jobs - Handling call queue end of work day');

  return { processed: true };
};

export const handleAllAgentsOffline = async ({ msgCtx: outerCtx, teamIds }) => {
  logger.trace({ ctx: outerCtx, teamIds }, 'handling all agents went offline');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...outerCtx, trx };
      const removedCalls = await repo.dequeueCallsByTeamIds(ctx, teamIds);

      if (!removedCalls.length) {
        logger.trace({ ctx, teamIds }, 'no calls to dequeue for teams when agents went offline');
        return;
      }

      logger.info({ ctx, removedCalls }, 'calls where removed from queue because all agents went offline');

      await mapSeries(removedCalls, async removedCall => {
        const commId = removedCall.commId;
        await actions.markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.QUEUE_AGENTS_OFFLINE);

        await hangupCalls(ctx, getFiredCallsToAgents(removedCall));

        const { partyId } = await actions.assignCallPartyAccordingToRoutingStrategy(ctx, commId);
        await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });

        const transferredToVoiceMail = await actions.transferCallToVoicemail(ctx, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
        await repo.updateCallQueueStatsByCommId(ctx, commId, { transferredToVoiceMail });
        await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCall.teamId], isFromRemoveCallQueue: true });
      });
    }, outerCtx);
  } catch (error) {
    logger.error({ ctx: outerCtx, error, teamIds }, 'failed to remove calls from queue when agents went offline');
    return { processed: false };
  }

  return { processed: true };
};
