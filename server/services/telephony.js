/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partition from 'lodash/partition';
import { Response } from 'plivo';
import { mapSeries } from 'bluebird';
import { loadParty } from '../dal/partyRepo';
import { getTeamsForUser } from '../dal/teamsRepo';
import * as commsRepo from '../dal/communicationRepo';
import { getCallQueueStatsByCommId, updateCallQueueStatsByCommId } from '../dal/callQueueRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import config from '../config';
import { getTelephonyConfigs } from '../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../common/helpers/urlParams';
import loggerModule from '../../common/helpers/logger';
import parseBoolean from '../../common/helpers/booleanParser';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { loadUserById, loadUserBySipUsername, loadUsersByIds } from './users';
import { sendMessageToCompleteFollowupPartyTasks } from '../helpers/taskUtils';
import { CallReceiverType } from './routing/targetUtils';
import { obscureObject, obscureUrl } from '../../common/helpers/logger-utils';
import * as outgoing from './telephony/outgoing';
import * as incoming from './telephony/incoming';
import * as voiceResponses from './telephony/voiceResponses';
import * as hangup from './telephony/hangup';
import * as callQueuing from './telephony/callQueuing';
import * as callActions from './telephony/callActions';
import * as voiceMessages from './telephony/voiceMessages';
import { getUpdatedRawData } from './telephony/callDataUtils';
import { extractSipUsername, getAnsweringUserInfo } from './helpers/telephonyHelpers';
import * as userAvailability from './telephony/userAvailability';
import { getTelephonyOps } from './telephony/providerApiOperations';
import { TransferTargetType, ConferenceEvents, ConferenceActions, DialActions, DialStatus } from './telephony/enums';
import { updatePartyOwnerAfterCall, updateOwner } from './party';
import { saveAnsweredCallEvent, saveMissedCallEvent, saveCommunicationCompletedEvent } from './partyEvent';
import { assignPartyOrUpdateCollaborators } from './partyCollaborators';
import { notifyCommunicationUpdate } from '../helpers/notifications';
import * as commService from './communication';
import { toMoment, now } from '../../common/helpers/moment-utils';
import { saveCallDetails } from '../dal/callDetailsRepo';
import { saveForwardedCommunications } from '../dal/forwardedCommunicationsRepo';
import { ServiceError } from '../common/errors';
import { isInvalidFrom } from '../helpers/phoneUtils';

const { telephony } = config;

const logger = loggerModule.child({ subType: 'telephony' });

const redactedResponse = response => obscureUrl(response, ['api-token']);

const getCallInitiatingUser = async (ctx, { From: initiatingEndpoint, initiatingUserId }) => {
  if (initiatingUserId) {
    const user = await loadUserById(ctx, initiatingUserId);
    return {
      isInitiatedByUser: !!user,
      initiatingUser: user,
    };
  }

  const { isSipEndpoint, username } = extractSipUsername(ctx, initiatingEndpoint);
  if (isSipEndpoint) {
    const user = await loadUserBySipUsername(ctx, username);
    return {
      isInitiatedByUser: !!user,
      initiatingUser: user,
    };
  }

  return { isInitiatedByUser: false };
};

const getCommIdForExternalTransfer = async (ctx, callData) => {
  if (callData.commId) return callData.commId;
  if (!callData.transferredFromCommId) return '';

  const [comm] = await commsRepo.getCommsByTransferredFrom(ctx, callData.transferredFromCommId);
  return comm.id;
};

const respondToExternalTransferRequest = async req => {
  const callData = req.body;
  logger.trace({ ctx: req, callData: obscureObject(callData) }, 'respondToExternalTransferRequest');

  const callerId =
    (callData.transferredCallDirection === DALTypes.CommunicationDirection.OUT && callData.To) || isInvalidFrom(callData) ? callData.CallerName : callData.From;
  const { dialCallbackUrl } = await getTelephonyConfigs(req);

  const commId = await getCommIdForExternalTransfer(req, callData);
  if (commId) {
    const rawMessage = await getUpdatedRawData(req, req.body);
    await commsRepo.updateCommunicationEntryById(req, commId, { messageId: callData.CallUUID, message: { rawMessage } });
  }

  const response = new Response();

  const dialWithCallback = response.addDial({ callerId, callbackUrl: addParamsToUrl(dialCallbackUrl, { commId }) });
  const dialWithNoCallback = response.addDial({ callerId });

  const dial = commId ? dialWithCallback : dialWithNoCallback;

  dial.addNumber(callData.transferTarget);

  const res = response.toXML();
  logger.trace({ ctx: req, commId, res }, 'respondToExternalTransferRequest response');
  return res;
};

const respondToForwardCallRequest = async (ctx, callData, transferTarget) => {
  logger.trace({ ctx, callData: obscureObject(callData) }, 'respondToForwardCallRequest');

  const callerId = isInvalidFrom(callData) ? callData.CallerName : callData.From;
  const response = new Response();
  const dialWithNoCallback = response.addDial({ callerId });
  const dial = dialWithNoCallback;
  dial.addNumber(transferTarget);

  const res = response.toXML();
  logger.trace({ ctx, callData: obscureObject(callData), res }, 'respondToForwardCallRequest response');
  return res;
};

const getResponseForIncomingCallRequest = async req => {
  const incomingCallRequest = await incoming.respondToIncomingCallRequest(req);

  if (incomingCallRequest.isCallForwarding) {
    const res = await respondToForwardCallRequest(req, incomingCallRequest.callData, incomingCallRequest.transferTarget);

    const forwardedCommunication = {
      type: DALTypes.CommunicationMessageType.CALL,
      messageId: incomingCallRequest.callData.CallUUID,
      programId: incomingCallRequest.program.id,
      programContactData: incomingCallRequest.program.directPhoneIdentifier,
      message: incomingCallRequest.callData,
      forwardedTo: incomingCallRequest.transferTarget,
      receivedFrom: incomingCallRequest.callData.From,
    };
    await saveForwardedCommunications(req, forwardedCommunication);
    return res;
  }
  return incomingCallRequest;
};

export const respondToDirectCallRequest = async req => {
  const { body } = req;
  logger.trace({ ctx: req, callData: obscureObject(body) }, 'direct call request body');
  const { HangupCause: hangupCause } = body;

  const { isInitiatedByUser, initiatingUser } = await getCallInitiatingUser({ tenantId: req.tenantId }, req.body);

  const isExternalTransfer = body.transferTargetType === TransferTargetType.EXTERNAL_PHONE;
  const isTransfer = !!body.transferTarget;
  const isOutgoingCall = isInitiatedByUser && !isTransfer;

  const getResponse = async () => {
    if (hangupCause) return await hangup.respondToHangupRequest(req);
    if (isOutgoingCall) {
      return await outgoing.respondToOutgoingCallRequest(req, initiatingUser);
    }
    if (isExternalTransfer) return await respondToExternalTransferRequest(req);
    return await getResponseForIncomingCallRequest(req);
  };

  try {
    const response = await getResponse();
    logger.trace({ ctx: req, callData: obscureObject(body), response: redactedResponse(response) }, 'direct call response');
    return response;
  } catch (error) {
    logger.error({ ctx: req, callData: obscureObject(body), error }, 'error in respondToDirectCallRequest');
    throw error;
  }
};

const createCommEntryForExternalTransfer = async (ctx, { transferredToNumber, transferredToDisplayName, transferredFromComm }) => {
  const { parties, persons, type, messageId, threadId, teams, teamPropertyProgramId, id: transferredFromCommId } = transferredFromComm;
  const entry = {
    parties,
    persons,
    type,
    messageId,
    threadId,
    teams,
    teamPropertyProgramId,
    direction: DALTypes.CommunicationDirection.OUT,
    message: { transferredToNumber, transferredToDisplayName, wasTransferred: true },
    transferredFromCommId,
  };

  return await commService.addNewCommunication(ctx, entry);
};

export const transferCall = async transferParams => {
  const { ctx, callId, direction, to, from, comm, parties } = transferParams;
  logger.trace({ ctx, callId, direction, to, from, commId: comm.id, parties }, 'transferCall - params');
  const { answerUrl, auth } = await getTelephonyConfigs(ctx);

  const transferTargetType = (to.isTeam && TransferTargetType.TEAM) || (to.isExternalPhone && TransferTargetType.EXTERNAL_PHONE) || TransferTargetType.USER;

  const transferTarget = (to.isExternalPhone && to.number) || to.id;
  const transferTargetValue = (to.isTeam && to.displayName) || (to.isExternalPhone && to.number) || to.fullName;

  await userAvailability.markUsersInvolvedInCallAsAvailable(ctx, comm);
  await commsRepo.updateCommunicationEntryById(ctx, comm.id, { message: { wasTransferred: true, transferTargetValue } });

  const endTime = now({ timezone: 'UTC' }).toISOString();
  await saveCallDetails(ctx, { commId: comm.id, details: { endTime } });

  if (transferTargetType === TransferTargetType.USER) {
    await mapSeries(parties, async p => await assignPartyOrUpdateCollaborators(ctx, p, [to.id]));
  }

  if (transferTargetType === TransferTargetType.EXTERNAL_PHONE) {
    await createCommEntryForExternalTransfer(ctx, { transferredToNumber: to.number, transferredToDisplayName: to.fullName, transferredFromComm: comm });
  }

  const urlParams = {
    transferTargetType,
    transferTarget,
    transferredCallDirection: direction,
    transferredFrom: from,
    transferredFromCommId: comm.id,
  };

  const url = addParamsToUrl(answerUrl, urlParams);

  //  aleg/bleg terminology required by Plivo API
  const legInfo = direction === DALTypes.CommunicationDirection.IN ? { legs: 'aleg', alegUrl: url } : { legs: 'bleg', blegUrl: url };
  const res = await getTelephonyOps().transferCall(auth, { callId, ...legInfo });

  if (res && res.notFound) {
    throw new ServiceError({ token: 'TRANSFER_CALL_INTERRUPTED', status: 404 });
  }
  logger.info({ ctx, commId: comm.id }, `Transfer Call operation result: ${JSON.stringify(obscureObject(res))}`);
};

export const stopRecording = async (ctx, callId) => {
  logger.trace({ ctx, callId }, 'stopping recording for call');

  const { auth } = await getTelephonyConfigs(ctx);
  const { notFound } = await getTelephonyOps().stopRecording(auth, { callId });
  notFound && logger.info({ ctx, callId }, 'call ended before stopping the recording');
};

export const holdCall = async (ctx, callId, holdingMusicUrl, legs) => {
  logger.trace({ ctx, callId, holdingMusicUrl, legs }, 'hold call with id');

  const { auth } = await getTelephonyConfigs(ctx);
  const result = await getTelephonyOps().holdCall(auth, { callId, holdingMusicUrl, mix: false, legs, loop: true });
  logger.trace({ ctx, callId, result }, 'hold call with id - done');
  result?.notFound && logger.info({ ctx, callId }, 'call ended before holding');
};

export const unholdCall = async (ctx, callId) => {
  logger.trace({ ctx, callId }, 'unhold call with id');

  const { auth } = await getTelephonyConfigs(ctx);
  const result = await getTelephonyOps().unholdCall(auth, { callId });
  logger.trace({ ctx, callId, result }, 'unhold call with id - done');
  result?.notFound && logger.info({ ctx, callId }, 'call ended before unholding');
};

export const makeCallFromPhone = async ({ ctx, user, from, to }) => {
  logger.trace({ ctx, from, to, userId: user.id }, 'makeCallFromPhone params');

  const { answerUrl, auth } = await getTelephonyConfigs(ctx);

  const { phone: number, personId, partyId } = to;

  const fromNumber = await outgoing.getOutgoingSourcePhoneNumber({ ctx, partyId });

  const party = await loadParty(ctx, partyId);
  const teams = party?.ownerTeam ? [party.ownerTeam] : (await getTeamsForUser(ctx, user.id)).map(t => t.id);

  const outgoingComm = await outgoing.createOutgoingCallCommunicationEntry({
    ctx,
    user,
    personId,
    parties: [partyId],
    toNumber: number,
    fromNumber,
    teams,
  });

  const { id: commId } = outgoingComm;

  await notifyCommunicationUpdate(ctx, outgoingComm);

  const answerParams = {
    guestNo: to.phone,
    isPhoneToPhone: true,
    initiatingUserId: user.id,
    commId,
  };
  const url = addParamsToUrl(answerUrl, answerParams);

  const res = await getTelephonyOps().makeCall(auth, { from: fromNumber, to: from.phone, answerUrl: url, machineDetection: 'hangup' });

  const { requestUuid: messageId } = res;
  const comm = await commsRepo.updateCommunicationEntryById(ctx, commId, { messageId });

  logger.info({ ctx, commId: comm.id }, `Make Call operation result: ${JSON.stringify(res)}`);
  return comm;
};

const updateQueueStatisticsUser = async (ctx, comm) => {
  const answeringAgent = comm.userId;

  const receivingAgents = Object.keys(comm.message.receiversEndpointsByUserId || {});
  const singleReceivingAgent = receivingAgents.length === 1 && receivingAgents[0];

  const callReceiver = answeringAgent || singleReceivingAgent;
  if (!callReceiver) return;

  const stats = await getCallQueueStatsByCommId(ctx, comm.id);
  if (!stats || stats.userId) return;

  await updateCallQueueStatsByCommId(ctx, comm.id, { userId: callReceiver });
};

const getCallEndingStatus = ({ comm, dialStatus, dialHangupCause }) => {
  const incomingNotAnswered = comm.direction === DALTypes.CommunicationDirection.IN && !comm.message.answered;

  const notAnswered = dialStatus === DialStatus.NO_ANSWER || dialStatus === DialStatus.BUSY;
  const originatorCancelled =
    (dialStatus === DialStatus.CANCEL && dialHangupCause === 'ORIGINATOR_CANCEL') ||
    // this is the situation where the caller hung up during recording notice, before <Dial>, and the call is answered from Plivo's POV
    (dialStatus === DialStatus.COMPLETED && incomingNotAnswered);

  const isDeclined = dialStatus === DialStatus.BUSY && incomingNotAnswered && dialHangupCause === 'USER_BUSY';

  const isMissed = notAnswered || originatorCancelled || incomingNotAnswered;

  return { isMissed, originatorCancelled, notAnswered, isDeclined };
};

export const respondToPostDialRequest = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'post dial request body');
  const {
    DialStatus: dialStatus = '',
    DialHangupCause: dialHangupCause,
    receiverType = CallReceiverType.REVA_USER,
    partyId,
    commId,
    commTargetType,
    targetContextId,
    targetTeamId,
  } = req.body;

  const rawMessage = await getUpdatedRawData(req, req.body);
  const comm = await commsRepo.updateCommunicationEntryById(req, commId, { message: { rawMessage, postDialHandled: true } });

  if (receiverType === CallReceiverType.REVA_USER) {
    if (comm.message.wasTransferred) {
      logger.trace({ ctx: req, userId: comm.userId, commId }, 'user availability already handled at transfer time');
    } else {
      await userAvailability.markUsersInvolvedInCallAsAvailable(req, comm);
    }
  }

  if (commId) {
    notify({
      ctx: req,
      event: eventTypes.CALL_TERMINATED,
      data: { commId },
      routing: { users: [comm.userId] },
    });
  }

  const { isMissed, originatorCancelled, notAnswered, isDeclined } = getCallEndingStatus({ comm, dialStatus, dialHangupCause });

  if (comm.direction !== DALTypes.CommunicationDirection.IN) {
    partyId && (await saveCommunicationCompletedEvent(req, { partyId, userId: comm.userId, metadata: { communicationId: comm.id } }));
    return new Response().toXML();
  }

  // update party with owner determined by partyRouting module if needed
  if (partyId) {
    const userId = await updatePartyOwnerAfterCall(req, partyId); // TODO: why do we need to call this every time?
    await saveCommunicationCompletedEvent(req, { partyId, userId, metadata: { communicationId: comm.id } });
  }
  let message = { isMissed, dialStatus, originatorCancelled, isDeclined };
  if (isMissed) message = { ...message, missedCallReason: DALTypes.MissedCallReason.NORMAL_NO_QUEUE };
  const delta = { message, unread: isMissed };

  const commEntry = await commsRepo.updateCommunicationEntryById(req, commId, delta);

  if (isMissed) {
    await notifyCommunicationUpdate(req, commEntry);

    if (partyId) {
      await commsRepo.saveUnreadCommunication(req, partyId, commEntry);
      await saveMissedCallEvent(req, { partyId, metadata: { communicationId: comm.id } });
    }
  }

  await updateQueueStatisticsUser(req, commEntry);

  const getResponse = async () => {
    if (notAnswered) {
      const targetId = await incoming.getTargetId(req, { commTargetType, targetContextId, targetTeamId });
      return await voiceResponses.createVoiceResponse(req, { commId, ...targetId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
    }

    return new Response().toXML();
  };

  const response = await getResponse();
  logger.trace({ ctx: req, commId: comm.id, response: redactedResponse(response) }, 'post dial response');
  return response;
};

const getActionsForDigitsPressed = async (ctx, { commId, programId, teamMemberId, teamId, messageType, number }) =>
  (await callQueuing.isCallQueued(ctx, commId))
    ? {
        callback: async () => await callQueuing.requestCallback(ctx, { commId, programId, teamId }),
        voicemail: async () => await callQueuing.requestVoicemail(ctx, { commId, programId, teamId }),
        transferToNumber: async () => await callQueuing.requestTransferToNumber(ctx, commId, number),
        replayResponse: async () => await callQueuing.getResponseForQueuedCalls(ctx, { commId, teamId, programId }),
      }
    : {
        callback: async () => {
          await callActions.handleCallbackRequest(ctx, commId);
          return await voiceMessages.createCallBackRequestAckResponse(ctx, { programId, teamMemberId, teamId });
        },
        voicemail: async () => {
          await callActions.handleVoicemailRequest(ctx, { commId, programId, teamId, teamMemberId, messageType: DALTypes.VoiceMessageType.VOICEMAIL });
          return new Response().toXML();
        },
        transferToNumber: async () => {
          await callActions.handleTransferToNumberRequest(ctx, commId, number, messageType);
          return new Response().toXML();
        },
        replayResponse: async () => await voiceResponses.createVoiceResponse(ctx, { commId, programId, teamMemberId, teamId, messageType }),
      };

export const respondToDigitsPressedRequest = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'respondToDigitsPressedRequest');
  const { commId, programId, teamMemberId, teamId, voiceMessageType, Digits } = req.body;
  const digit = parseInt(Digits, 10);

  const voiceMenuItems = await voiceMessages.getMenuItemsByTargetIdAndMsgType(req, { teamMemberId, programId, teamId, messageType: voiceMessageType });
  const { action: digitPressedAction, number } = voiceMenuItems.find(mi => mi.key === digit) || {};
  logger.trace({ ctx: req, commId, digitPressedAction, number }, 'identified action for pressed digit');

  const { VoiceMenuAction } = DALTypes;

  const actions = await getActionsForDigitsPressed(req, { commId, programId, teamMemberId, teamId, messageType: voiceMessageType, number });

  switch (digitPressedAction) {
    case VoiceMenuAction.REQUEST_CALLBACK:
      return await actions.callback();

    case VoiceMenuAction.TRANSFER_TO_VOICEMAIL:
      return await actions.voicemail();

    case VoiceMenuAction.TRANSFER_TO_PHONE_NUMBER:
      return await actions.transferToNumber();

    default:
      return actions.replayResponse();
  }
};

export const respondToCallReadyForDequeueRequest = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'respondToCallReadyForDequeueRequest');
  return await callQueuing.handleCallReadyForDequeue(req, req.body.commId, req.body.teamId, req.body.programId);
};

const getConnectedUserInfo = async (ctx, commId, answeringEndpoint) => {
  logger.trace({ ctx, commId, answeringEndpoint }, 'getConnectedUserInfo');

  const comm = await commsRepo.loadMessageById(ctx, commId);
  const isIncoming = comm.direction === DALTypes.CommunicationDirection.IN;

  if (!isIncoming) return { userId: comm.userId };

  const toReceivers = user => ({ ...user, ...getAnsweringUserInfo(ctx, user, answeringEndpoint) });
  const receiverIds = Object.keys(comm.message.receiversEndpointsByUserId || {});
  const callReceivers = (await loadUsersByIds(ctx, receiverIds || [])).map(toReceivers);
  const [[answeringUser], otherReceivers] = partition(callReceivers, u => u.isAnsweringUser);

  logger.trace({ ctx, commId, receivers: otherReceivers.map(r => r.fullName) }, 'marking call receivers that did not answer the call as AVAILABLE');

  await userAvailability.markUsersAvailable(
    ctx,
    otherReceivers.map(r => r.id),
  );

  if (!answeringUser) return {};

  logger.trace({ ctx, commId, user: answeringUser.fullName, answeredFrom: answeringEndpoint }, 'call answered by user');

  const updatedComm = await commService.updateCommunicationEntryById({
    ctx: { ...ctx, authUser: answeringUser },
    id: commId,
    delta: { userId: answeringUser.id, message: { answered: true } },
    shouldAddActivityLog: true,
  });

  await updateQueueStatisticsUser(ctx, updatedComm);
  return {
    userId: answeringUser.id,
    hasAnsweredFromExternalEndpoint: answeringUser.hasAnsweredFromExternalEndpoint,
  };
};

const markHangupSipEndpoint = async (ctx, commId, userId, sipUserName) => {
  const { message } = await commsRepo.loadMessageById(ctx, commId);
  const { receiversEndpointsByUserId } = message;
  const receiverEndpoints = receiversEndpointsByUserId[userId].map(endpoint =>
    endpoint.username === sipUserName ? { ...endpoint, hasHangup: true } : endpoint,
  );

  const updatedComm = await commsRepo.updateCommunicationEntryById(ctx, commId, {
    message: {
      receiversEndpointsByUserId: { ...receiversEndpointsByUserId, [userId]: receiverEndpoints },
    },
  });
  return { updatedComm, receiverEndpoints };
};

const updateExternalTransferDetails = async (ctx, dialAction, duration, commId) => {
  const update = async delta => {
    const comm = await commsRepo.updateCommunicationEntryById(ctx, commId, { message: delta });
    await notifyCommunicationUpdate(ctx, comm);
  };

  if (dialAction === DialActions.HANGUP && duration > 0) {
    const formattedDuration = toMoment(0, { parseFormat: 'HH', strict: false }).add(duration, 's').format('mm:ss');
    await update({ duration: formattedDuration });
  }
  if (dialAction === DialActions.ANSWER) await update({ answered: true });
};

export const respondToDialCallback = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'dial callback request body');
  const {
    DialAction: dialAction,
    AnswerTime: answerTime,
    receiverType = CallReceiverType.REVA_USER,
    partyId,
    isPhoneToPhone: isPhoneToPhoneString,
    DialBLegTo: userEndpoint,
    DialBLegDuration: duration,
    commId,
  } = req.body;

  const rawMessage = await getUpdatedRawData(req, req.body);
  const comm = await commsRepo.updateCommunicationEntryById(req, commId, { message: { rawMessage } });

  if (comm.message.transferredToNumber) {
    await updateExternalTransferDetails(req, dialAction, duration, commId);
    return new Response().toXML();
  }

  if (receiverType === CallReceiverType.REVA_USER && dialAction === DialActions.HANGUP && answerTime === '') {
    const { isSipEndpoint, username } = extractSipUsername(req, userEndpoint);
    if (isSipEndpoint) {
      const { id: userId } = await loadUserBySipUsername(req, username);
      const { receiverEndpoints } = await markHangupSipEndpoint(req, commId, userId, username);
      if (receiverEndpoints.every(e => e.hasHangup)) await userAvailability.markUsersAvailable(req, [userId], comm.messageId);
    }
  }

  if (receiverType === CallReceiverType.REVA_USER && dialAction === DialActions.ANSWER) {
    const { userId, hasAnsweredFromExternalEndpoint } = await getConnectedUserInfo(req, commId, userEndpoint);

    const isPhoneToPhone = parseBoolean(isPhoneToPhoneString);

    if (isPhoneToPhone || hasAnsweredFromExternalEndpoint) {
      notify({
        ctx: req,
        event: eventTypes.CALL_ANSWERED,
        data: { commId, isPhoneToPhone: true },
        routing: { users: [userId] },
      });
    }

    if (partyId) {
      await sendMessageToCompleteFollowupPartyTasks(req, [partyId]);
      await saveAnsweredCallEvent(req, { partyId: comm.parties[0], metadata: { communicationId: comm.id } });
    }

    if (partyId && userId) {
      const party = await loadParty(req, partyId);
      // if we don't have an owner yet, it means we need to add the user that answered as owner
      if (!party.userId) {
        await updateOwner(req, party, userId);
      }
    }
  }

  return new Response().toXML();
};

export const saveCallRecording = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'call recording request body');
  const {
    RecordUrl: recordingUrl,
    RecordingID: recordingId,
    CallUUID: callId,
    RecordingDuration: recordingDuration,
    isVoiceMail: isVoiceMailString,
    commId,
    isSpam: isSpamString,
  } = req.body;

  const isSpam = parseBoolean(isSpamString);
  if (isSpam) {
    logger.warn({ ctx: req, commId, callId, isSpam }, 'received voicemail from contact marked as spam, recording will not be saved');
    return;
  }

  const commEntry = commId && (await commsRepo.loadMessageById(req, commId));

  if (!commEntry) {
    logger.warn({ ctx: req, commId, callId }, 'no communication entry was found for this call, recording cannot be saved');
    return;
  }

  if (commEntry.message.recordingWasRemoved) {
    logger.trace({ ctx: req, callId, commId }, 'call recording was removed from db, deleting it from provider as well');
    const { auth } = await getTelephonyConfigs(req);
    await getTelephonyOps().deleteRecording(auth, { id: recordingId });
    return;
  }

  if (recordingDuration < 1) {
    logger.trace({ ctx: req, commId }, 'the recording has no duration so it is not saved');
    return;
  }

  const duration = toMoment(0, { parseFormat: 'HH', strict: false }).add(recordingDuration, 's').format('mm:ss');

  const isVoiceMail = parseBoolean(isVoiceMailString);

  const updatedComm = await commsRepo.updateCommunicationEntryById(req, commId, {
    unread: isVoiceMail,
    message: {
      recordingUrl,
      recordingId,
      isVoiceMail,
      duration,
      recordingDuration,
    },
  });

  updatedComm.unread && (await mapSeries(updatedComm.parties, async partyId => await commsRepo.saveUnreadCommunication(req, partyId, commEntry)));

  await notifyCommunicationUpdate(req, commEntry);
};

const hangupConferenceIfNoOneJoins = (ctx, commId) =>
  setTimeout(async () => {
    try {
      logger.trace({ ctx, commId }, 'hangupConferenceIfNoOneJoins - params');
      const { auth } = await getTelephonyConfigs(ctx);

      const { getLiveConference, hangupConferenceMember } = getTelephonyOps();

      const conf = await getLiveConference(auth, { conferenceId: `room_${commId}` });
      logger.trace({ ctx, commId, conf }, 'getLiveConference result');

      const { notFound, conferenceMemberCount, members } = conf;
      const memberCount = parseInt(conferenceMemberCount, 10);

      if (notFound || memberCount !== 1) return;

      logger.trace(
        { ctx, commId, member: members[0], timeout: telephony.timeoutBeforeOneMemberConferenceEnds },
        'conference room has only one member after specified timeout, others might have hung up before joining - hanging up conference member',
      );

      await hangupConferenceMember(auth, { conferenceId: `room_${commId}`, memberId: members[0].memberId });
    } catch (error) {
      logger.error({ ctx, commId, error }, 'error in hangupConferenceIfNoOneJoins');
    }
  }, telephony.timeoutBeforeOneMemberConferenceEnds);

export const respondToConferenceCallbackRequest = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'respondToConferenceCallbackRequest - params');
  const { ConferenceAction: action, Event: event, commId } = req.body;

  const comm = await commsRepo.loadMessageById(req, commId);

  if (event === ConferenceEvents.ENTER) hangupConferenceIfNoOneJoins(req, commId);

  if (action === ConferenceActions.RECORD && event === ConferenceEvents.RECORD_STOP) await saveCallRecording(req);

  if (action === ConferenceActions.EXIT) {
    if (comm.message.wasTransferred) {
      logger.trace({ ctx: req, userId: comm.userId, commId }, 'user availability already handled at transfer time');
    } else {
      await userAvailability.markUsersInvolvedInCallAsAvailable(req, comm);
    }

    const endTime = now({ timezone: 'UTC' }).toISOString();

    await saveCallDetails(req, { commId, details: { endTime } });

    notify({
      ctx: req,
      event: eventTypes.CALL_TERMINATED,
      data: { commId },
      routing: { users: [comm.userId] },
    });
  }
};
