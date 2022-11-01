/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fromPairs from 'lodash/fromPairs';
import flatten from 'lodash/flatten';
import mapValues from 'lodash/mapValues';
import { Response } from 'plivo';
import range from 'lodash/range';
import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import config from '../../config';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import * as commsRepo from '../../dal/communicationRepo';
import { getTeamsFromTenant } from '../../dal/teamsRepo';
import * as voiceMessages from './voiceMessages';
import { sendMessage } from '../pubsub';
import { APP_EXCHANGE, CALLS_QUEUE_MESSAGE_TYPE } from '../../helpers/message-constants';
import { isDuringOfficeHours } from '../teams';
import * as callQueueRepo from '../../dal/callQueueRepo';
import { toQualifiedSipEndpoint, toCommIdSipHeader, shouldRecordCall } from '../helpers/telephonyHelpers';
import { getCallReceivingEndpointsByUser } from './endpoints';
import { getTelephonyOps } from './providerApiOperations';
import * as recording from './recording';
import { toMoment } from '../../../common/helpers/moment-utils';
import { updateStatusForUsers } from '../users';
import { DALTypes } from '../../../common/enums/DALTypes';
import { RESTRICTED_PHONE_REPLACEMENT } from '../../helpers/phoneUtils';
import { isPhoneValid } from '../../../common/helpers/validations/phone';
import { updateRecurringJobStatus } from '../../dal/jobsRepo';
import { transferCallToVoicemail } from './callActions';
import { addVoiceMessageToResponse } from './voiceResponses';
import EventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';

const logger = loggerModule.child({ subType: 'telephony-queue' });

const getResponseParams = async (ctx, commId, teamId, programId) => {
  const { message: welcomeMessage } = await voiceMessages.getVoiceMessage(ctx, {
    programId,
    teamId,
    messageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME,
  });
  const holdingMusic = await voiceMessages.getHoldingMusic(ctx, { programId, teamId });

  const holdingMusicUrl = `${config.telephony.audioAssetsUrl}/${holdingMusic}`;
  const { digitsPressedUrl, callReadyForDequeueUrl } = await getTelephonyConfigs(ctx);

  const digitsUrl = addParamsToUrl(digitsPressedUrl, { commId, teamId, programId, voiceMessageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME });
  const redirectUrl = addParamsToUrl(callReadyForDequeueUrl, { commId, teamId, programId });

  return { message: welcomeMessage, holdingMusicUrl, digitsUrl, redirectUrl };
};

const getInitialResponseForQueuedCalls = async (ctx, { comm, teamId, programId }) => {
  logger.trace({ ctx, commId: comm.id, teamId, programId }, 'getInitialResponseForQueuedCalls - params');

  const { digitsUrl, message, redirectUrl } = await getResponseParams(ctx, comm.id, teamId, programId);
  const response = new Response();

  const shouldRecord = await shouldRecordCall(ctx, comm);
  if (shouldRecord) {
    await recording.updateCommAndNotifyAboutRecording(ctx, comm);
    const { message: recordNoticeMessage } = await voiceMessages.getVoiceMessage(ctx, {
      programId,
      teamId,
      messageType: DALTypes.VoiceMessageType.RECORDING_NOTICE,
    });
    recording.addRecordingNotice(ctx, response, recordNoticeMessage);
  }

  const digits = response.addGetDigits({ action: digitsUrl, numDigits: 1, timeout: 1 });
  addVoiceMessageToResponse(ctx, digits, message);
  response.addRedirect(redirectUrl);

  return response.toXML();
};

export const getResponseForQueuedCalls = async (ctx, { commId, teamId, programId, shouldPlayMessageFirst = true }) => {
  logger.trace({ ctx, commId, teamId, programId, shouldPlayMessageFirst }, 'getResponseForQueuedCalls params');

  const { digitsUrl, message, holdingMusicUrl } = await getResponseParams(ctx, commId, teamId, programId);

  const response = new Response();
  const digits = response.addGetDigits({ action: digitsUrl, numDigits: 1, timeout: 1 });

  range(10).forEach(() => {
    if (shouldPlayMessageFirst) addVoiceMessageToResponse(ctx, digits, message);
    digits.addPlay(holdingMusicUrl);
    if (!shouldPlayMessageFirst) addVoiceMessageToResponse(ctx, digits, message);
  });

  digits.addPlay(holdingMusicUrl, { loop: 0 });

  return response.toXML();
};

export const sendCallToQueue = async (ctx, { commId, team, transferredFrom, ...targetId }) => {
  logger.trace({ ctx, commId, team: team.displayName, transferredFrom, ...targetId }, 'routing incoming call to call queue');

  const comm = await commsRepo.updateCommunicationEntryById(ctx, commId, { message: { targetName: team.displayName, isCallFromQueue: true } });
  const response = await getInitialResponseForQueuedCalls(ctx, { comm, teamId: team.id, ...targetId });

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.CALL_ENQUEUED,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
      teamId: team.id,
      transferredFrom,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });

  return response;
};

export const requestCallback = async (ctx, { commId, programId, teamId }) => {
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.CALLBACK_REQUESTED,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });

  return await voiceMessages.createCallBackRequestAckResponse(ctx, { programId, teamId });
};

const createWaitResponse = () => {
  const response = new Response();
  response.addWait({ length: 10 });
  return response.toXML();
};

export const requestVoicemail = async (ctx, { commId, teamId, programId }) => {
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.VOICEMAIL_REQUESTED,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
      teamId,
      programId,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });

  // must create a response that keeps the call going because transfer request is async
  // and call ends before it otherwise
  return createWaitResponse();
};

export const requestTransferToNumber = async (ctx, commId, number) => {
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.TRANSFER_TO_NUMBER_REQUESTED,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
      number,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });

  // must create a response that keeps the call going because transfer request is async
  // and call ends before it otherwise
  return createWaitResponse();
};

export const saveUserThatDeclinedCall = async (ctx, commId, userId) => await callQueueRepo.saveUserThatDeclinedCall(ctx, commId, userId);

let markCallAsReadyForDequeueFunc = async (ctx, commId, declinedByUserId) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.CALL_READY_FOR_DEQUEUE,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
      declinedByUserId,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });

export const getMarkCallAsReadyForDequeueFunc = () => markCallAsReadyForDequeueFunc;

export const setMarkCallAsReadyForDequeueFunc = func => {
  markCallAsReadyForDequeueFunc = func;
};

export const markCallAsReadyForDequeue = async (ctx, commId, declinedByUserId) => {
  logger.trace({ ctx, commId, declinedByUserId }, 'markCallAsReadyForDequeue');
  return await getMarkCallAsReadyForDequeueFunc()(ctx, commId, declinedByUserId);
};

export const handleCallReadyForDequeue = async (ctx, commId, teamId, programId) => {
  logger.trace({ ctx, commId, teamId, programId }, 'handleCallReadyForDequeue');

  await markCallAsReadyForDequeue(ctx, commId);

  return await getResponseForQueuedCalls(ctx, { commId, teamId, programId, shouldPlayMessageFirst: false });
};

export const handleHangup = async (ctx, commId) => {
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.HANGUP,
    message: {
      ctx: { tenantId: ctx.tenantId },
      commId,
    },
    ctx: { tenantId: ctx.tenantId, reqId: ctx.reqId },
  });
};

export const clearCallQueueIfEndOfDay = async (ctx, { lastOccurrence, jobId }) => {
  // check if any team end of office hours is between lastRunAt and now
  const teams = await getTeamsFromTenant(ctx.tenantId);
  const lastRunTime = lastOccurrence && toMoment(lastOccurrence);

  const teamsWithOfficeHoursCheck = await mapSeries(teams, async team => {
    const previousOfficeHours = await isDuringOfficeHours(ctx, team, lastRunTime);
    const isCurrentlyDuringOfficeHours = await isDuringOfficeHours(ctx, team);
    return { ...team, previousOfficeHours, isCurrentlyDuringOfficeHours };
  });

  const endOfDayTeams = teamsWithOfficeHoursCheck.filter(team => {
    const wasDuringOfficeHoursPreviously = lastRunTime ? team.previousOfficeHours : true;
    return wasDuringOfficeHoursPreviously && !team.isCurrentlyDuringOfficeHours;
  });

  if (!endOfDayTeams.length) {
    await updateRecurringJobStatus(ctx, jobId, DALTypes.JobStatus.IDLE);
    return;
  }

  logger.info({ ctx, endOfDayTeams: endOfDayTeams.map(t => ({ id: t.id, teamName: t.name })) }, 'Call queue: teams have reached the end of office hours');

  // 'jobId' is necessary in the payload so that the consumer sets the recurring job to 'Idle' after
  // the message is processed.
  const message = {
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.END_OF_DAY,
    message: { ctx, teamIds: endOfDayTeams.map(t => t.id), jobId },
    ctx,
  };

  await sendMessage(message);
};

export const hangupCalls = async (ctx, calls) => {
  logger.trace({ ctx, calls }, 'hangupCalls');
  await mapSeries(calls, async id => {
    try {
      const { auth } = await getTelephonyConfigs(ctx);
      await getTelephonyOps().hangupCall(auth, { callId: id });
      logger.trace({ ctx, callId: id }, 'hung up call fired for queue');
    } catch (hangupError) {
      logger.trace({ ctx, callId: id, hangupError }, 'failed to hangup call fired for queue, probably the call already ended');
    }
  });
};

export const hangupCallsFiredForQueue = async ({ ctx, commId, exceptCallId, forUserId }) => {
  logger.trace({ ctx, commId, exceptCallId, forUserId }, 'hangupCallsFiredForQueue');

  const { takenFiredCalls = [], remainingFiredCalls = [] } = forUserId
    ? await callQueueRepo.takeFiredCallsForUser(ctx, commId, forUserId)
    : await callQueueRepo.takeAllFiredCalls(ctx, commId);

  logger.trace({ ctx, takenFiredCalls, remainingFiredCalls }, 'hangupCallsFiredForQueue - firedCalls');

  const callsToEnd = takenFiredCalls.filter(id => id !== exceptCallId);
  await hangupCalls(ctx, callsToEnd);

  return { hungUpCalls: takenFiredCalls, remainingFiredCalls };
};

export const handleTeamsCallQueueChangeNotification = async (ctx, { teamsIds = [], isFromRemoveCallQueue = false }) => {
  logger.trace({ ctx, teamsIds, isFromRemoveCallQueue }, 'handleTeamsCallQueueChangeNotification initialized');

  teamsIds = teamsIds.filter(teamId => teamId);

  if (!teamsIds.length) {
    logger.warn({ ctx, teamsIds, isFromRemoveCallQueue }, 'handleTeamsCallQueueChangeNotification no teamsIds provided');
    return;
  }

  const teamsCallQueue = await callQueueRepo.getCallQueueCountByTeamIds(ctx, teamsIds);
  if (teamsCallQueue?.length) {
    notify({
      ctx,
      event: EventTypes.TEAMS_CALL_QUEUE_CHANGED,
      data: {
        teamsCallQueue,
      },
      routing: { teams: teamsIds },
    });
  }
};

export const callAgentsForQueue = async (ctx, userIds, commId) => {
  logger.trace({ ctx, userIds, commId }, 'connecting agents for transferring queued call');

  const comm = await commsRepo.loadMessageById(ctx, commId);

  const endpointsByUser = await getCallReceivingEndpointsByUser(ctx, userIds);

  // If the caller ID is 'Restricted', 'anonymous', etc., Plivo will reject the 'makeCall' request
  // so we are using a workaround that Plivo is also using for this scenario: replace 'Restricted' with '1000000000'.
  // It does not affect call routing or person/party association in our system.
  const from = isPhoneValid(comm.message.from) ? comm.message.from : RESTRICTED_PHONE_REPLACEMENT;
  const callerName = (comm.message.rawMessage && comm.message.rawMessage.CallerName) || comm.message.from;

  const makeCall = async (...args) => {
    try {
      return await getTelephonyOps().makeCall(...args);
    } catch (error) {
      logger.error({ error, ctx, makeCallArgs: args }, 'Error while calling agent for queued call');
      return { requestUuid: [] };
    }
  };

  const callsByAgent = fromPairs(
    await mapSeries(endpointsByUser, async ({ userId, sipEndpoints, externalPhones }) => {
      const endpoints = sipEndpoints.map(toQualifiedSipEndpoint);
      const sipHeaders = endpoints.map(() => toCommIdSipHeader(commId));

      const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
      const answerUrl = addParamsToUrl(agentCallForQueueUrl, { commId, userId });

      const { requestUuid: endpointsCalls } = endpoints.length
        ? await makeCall(auth, {
            from,
            callerName: endpoints.map(() => callerName).join('<'),
            to: endpoints.join('<'),
            answerUrl,
            machineDetection: 'false',
            sipHeaders: sipHeaders.join('<'),
            ringTimeout: config.telephony.ringTimeBeforeVoicemail,
          })
        : { requestUuid: [] };

      const { requestUuid: externalPhonesCalls } = externalPhones.length
        ? await makeCall(auth, {
            from,
            callerName: externalPhones.map(() => callerName).join('<'),
            to: externalPhones.join('<'),
            answerUrl,
            machineDetection: 'hangup',
            machineDetectionTime: 3000,
            ringTimeout: config.telephony.ringTimeBeforeVoicemail,
          })
        : { requestUuid: [] };

      const firedCalls = flatten([endpointsCalls, externalPhonesCalls]);
      if (firedCalls.length) await updateStatusForUsers(ctx, [userId], DALTypes.UserStatus.BUSY);
      return [userId, firedCalls];
    }),
  );

  const noCallsFired = flatten(Object.values(callsByAgent)).length === 0;
  if (noCallsFired) {
    logger.error({ ctx, userIds, commId }, 'unable to call agents for queued call, sending to voicemail');
    const transferred = await transferCallToVoicemail(ctx, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
    if (transferred) {
      const removedCallQueue = await callQueueRepo.removeCallFromQueue(ctx, commId);
      await callQueueRepo.updateCallQueueStatsByCommId(ctx, commId, { transferredToVoiceMail: true });
      await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCallQueue.teamId], isFromRemoveCallQueue: true });
    }
    return;
  }

  const added = await callQueueRepo.addFiredCallsForUsers(ctx, commId, callsByAgent);

  if (!added) {
    logger.info({ ctx, userIds, commId, callsByAgent }, 'callAgentsForQueue - call is no longer queued, hanging up calls fired to agent');
    await hangupCalls(ctx, flatten(Object.values(callsByAgent)));
    await updateStatusForUsers(ctx, userIds, DALTypes.UserStatus.AVAILABLE);
    return;
  }

  logger.info({ ctx, callsByAgent }, 'callAgentsForQueue - calls fired to agent endpoints for transferring queued call');
};

export const getLiveFiredCallsForQueuedCall = async (ctx, commId) => {
  logger.trace({ ctx, commId }, 'getLiveCallsFiredForQueuedCall');

  const { auth } = await getTelephonyConfigs(ctx);
  const liveCallsData = await getTelephonyOps().getLiveCalls(auth);
  const liveCallIds = new Set(liveCallsData.map(callData => callData.id));

  const call = await callQueueRepo.getQueuedCallByCommId(ctx, commId);
  const firedCalls = (call && call.firedCallsToAgents) || {};

  const liveFiredCalls = mapValues(firedCalls, ids => ids.filter(id => liveCallIds.has(id)));
  logger.trace({ ctx, commId, liveFiredCalls }, 'getLiveCallsFiredForQueuedCall result');
  return liveFiredCalls;
};

export const transferQueuedCallToAgent = async (ctx, comm, agentCallId) => {
  const { id: commId, messageId: callId, userId } = comm;

  logger.trace({ ctx, commId, userId, agentCallId }, 'transferQueuedCallToAgent');

  const { auth, transferFromQueueUrl } = await getTelephonyConfigs(ctx);

  const { notFound } = await getTelephonyOps().getLiveCall(auth, { callId });
  if (notFound) {
    logger.info({ ctx, commId }, 'queued call ended before transferring to agent');
    return false;
  }

  try {
    const res = await getTelephonyOps().transferCall(auth, { callId, alegUrl: addParamsToUrl(transferFromQueueUrl, { commId }) });
    logger.trace({ ctx, callId, transferQueuedCallResult: JSON.stringify(res) }, 'transferred queued call to agent successfully');
  } catch (error) {
    logger.warn({ ctx, callId, error }, 'failed to transfer queued call to agent, it might have ended before transferring');
    return false;
  }

  await hangupCallsFiredForQueue({ ctx, commId, exceptCallId: agentCallId });

  const removedCallQueue = await callQueueRepo.removeCallFromQueue(ctx, commId);
  await callQueueRepo.updateCallQueueStatsByCommId(ctx, commId, { userId });
  await handleTeamsCallQueueChangeNotification(ctx, { teamsIds: [removedCallQueue.teamId], isFromRemoveCallQueue: true });

  return true;
};

export const isCallQueued = async (ctx, commId) => {
  const call = await callQueueRepo.getCallQueueStatsByCommId(ctx, commId);
  return !!call;
};

export const getCallQueueCountByTeamIds = async (ctx, userTeamIds) => {
  logger.trace({ ctx, userTeamIds }, 'getCallQueueCountByTeamIds');
  if (!userTeamIds?.length) return [];
  const callQueueForTeams = await callQueueRepo.getCallQueueCountByTeamIds(ctx, userTeamIds);
  return callQueueForTeams;
};
