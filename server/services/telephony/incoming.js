/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Response } from 'plivo';
import flatten from 'lodash/flatten';
import intersectionBy from 'lodash/intersectionBy';
import intersection from 'lodash/intersection';
import pickBy from 'lodash/pickBy';
import { filter as promiseFilter, mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { obscureObject } from '../../../common/helpers/logger-utils';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { isDuringOfficeHours, doesUserBelongToACallCenter } from '../teams';
import { getCommunicationContext } from '../routing/communicationContextProcessor';
import { encodeSIP } from '../../../common/helpers/strings';
import { loadParty, loadPartiesByIds } from '../../dal/partyRepo';
import { getTeamBy, getTeamMemberById, getTeamsForUser, getTeamMemberId } from '../../dal/teamsRepo';
import { loadProgramByTeamPropertyProgramId } from '../../dal/programsRepo';
import { getUserStatusByUserId } from '../../dal/usersRepo';
import { processIncomingCommunication } from '../routing/incomingCommunicationProcessor';
import { loadActiveUserById, updateStatusForUsers, updateUserStatus, loadUsersByIds, loadUserById } from '../users';
import { getCallRoutingReceivers } from '../routing/callRouter';
import { notify } from '../../../common/server/notificationClient';
import { getTelephonyOps } from './providerApiOperations';
import { DALTypes } from '../../../common/enums/DALTypes';
import * as resources from './resources';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import config from '../../config';
import { CallReceiverType, CommTargetType } from '../routing/targetUtils';
import { shouldIgnoreProgram } from '../routing/targetProcessorHelpers';
import * as commsRepo from '../../dal/communicationRepo';
import * as commService from '../communication';
import { saveAnsweredCallEvent } from '../partyEvent';
import eventTypes from '../../../common/enums/eventTypes';
import { getPartyRoutingUserId } from '../routing/partyRouter';
import * as recording from './recording';
import * as voiceResponses from './voiceResponses';
import * as callQueuing from './callQueuing';
import { sendMessageToCompleteFollowupPartyTasks } from '../../helpers/taskUtils';
import { updateOwner } from '../party';
import { TransferTargetType, CallStatus, ConferenceEvents, HangupCauseName } from './enums';
import * as commsHelpers from '../helpers/communicationHelpers';
import { CommunicationTargetNotFoundError, ServiceError } from '../../common/errors';
import { getAnsweringUserInfo, shouldRecordCall } from '../helpers/telephonyHelpers';
import * as endpoints from './endpoints';
import { canUserBeCalled, getOnlineAgentsForPhoneCallsByTeamId } from './userAvailability';
import { getUpdatedRawData } from './callDataUtils';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import parseBoolean from '../../../common/helpers/booleanParser';
import { formatStack } from '../../../common/helpers/stack-formatter';
import * as voiceMessages from './voiceMessages';
import { isProgramForwarding } from '../../workers/communication/helpers/communicationForwardingHelper';
import { updatePartyActivity, getActivityLogDetailsForNewComm } from '../activityLogService';
import { isInvalidFrom } from '../../helpers/phoneUtils';

const { telephony } = config;
const logger = loggerModule.child({ subType: 'telephony-incoming' });

const constructMessageData = async (ctx, msg, communicationContext) => ({
  from: isInvalidFrom(msg) ? msg.CallerName : msg.From,
  to: communicationContext.targetContext.program ? [communicationContext.targetContext.program.directPhoneIdentifier] : [msg.To],
  messageId: msg.CallUUID,
  transferTargetType: msg.transferTargetType,
  transferTarget: msg.transferTarget,
  transferredCallDirection: msg.transferredCallDirection,
  transferredFrom: msg.transferredFrom,
  transferredFromCommId: msg.transferredFromCommId,
  rawMessage: await getUpdatedRawData(ctx, msg),
});

const determineCallSourceConsideringTransferDirection = callData =>
  (callData.transferredCallDirection === DALTypes.CommunicationDirection.OUT && callData.To) || isInvalidFrom(callData) ? callData.CallerName : callData.From;

const getCommunicationContextFromPhoneCall = async (ctx, callData) => {
  const from = determineCallSourceConsideringTransferDirection(callData);

  const transferTargetType = callData.transferTargetType === TransferTargetType.USER ? 'toUserId' : 'toTeamId';

  const contextData = {
    messageData: {
      from,
      to: [callData.To],
      cc: [],
      [transferTargetType]: callData.transferTarget,
    },
    channel: DALTypes.CommunicationMessageType.CALL,
    transferredFromCommId: callData.transferredFromCommId,
    redialForCommId: callData.redialForCommId,
  };

  try {
    const communicationContext = await getCommunicationContext(ctx, contextData);
    return { targetFound: true, communicationContext };
  } catch (error) {
    if (error instanceof CommunicationTargetNotFoundError) {
      logger.warn({ ctx, target: callData.To }, 'incoming call to unknown phone number');
      return { targetFound: false };
    }

    throw error;
  }
};

const createWaitAndDialAgainResponse = async ({ ctx, callId, redialAttemptNo = 0, isLeadCreated = false, transferParameters = {}, commId }) => {
  logger.trace({ ctx, callId, redialAttemptNo, isLeadCreated, commId }, 'unable to take incoming call, receivers are busy, waiting and dialing again');

  const response = new Response();

  response.addPlay(resources.DIAL_SOUND_URL, { loop: 0 }); // repeat indefinitely untill transferred

  setTimeout(async () => {
    const { answerUrl, auth } = await getTelephonyConfigs(ctx);

    const { notFound } = await getTelephonyOps().getLiveCall(auth, { callId });
    if (notFound) {
      logger.info({ ctx, callId }, 'caller hung up during wait-and-dial-again phase, cancelling dial-again');
      return;
    }

    ++redialAttemptNo;
    const url = addParamsToUrl(answerUrl, { ...transferParameters, redialAttemptNo, isLeadCreated, redialForCommId: commId });

    const res = await getTelephonyOps().transferCall(auth, { callId, alegUrl: url });

    logger.info(
      {
        ctx,
        transferResult: JSON.stringify(obscureObject(res)),
        timeoutBeforeRedial: telephony.timeoutBeforeRedial,
      },
      'transferring waiting caller to incoming call hook again',
    );
  }, telephony.timeoutBeforeRedial);

  return response.toXML();
};

const excludeTransferInitiatorFromUsersToCall = async (ctx, users, team, transferredFromUserId) => {
  const usersToCall = users.filter(u => u.id !== transferredFromUserId);
  if (usersToCall.length) {
    return { receivers: usersToCall, type: CallReceiverType.REVA_USER, team };
  }

  logger.info({ ctx }, 'Determined user for call routing is the same as transfer originator, applying routing strategy to find another user');

  const getReceiversExcludingTransferInitiator = async () => {
    const { ids, type } = await getCallRoutingReceivers(ctx, team);
    const receivers = await loadUsersByIds(
      ctx,
      ids.filter(id => id !== transferredFromUserId),
    );
    return { receivers, type };
  };

  const { receivers, type } = await getReceiversExcludingTransferInitiator();

  if (receivers.length) return { receivers, type, team };

  logger.info({ ctx }, 'User determined by strategy is the same as transfer originator, getting next one...');

  // refresh team from db because routing strategy updates it
  team = await getTeamBy(ctx, { id: team.id });
  const nextReceivers = await getReceiversExcludingTransferInitiator();

  return { ...nextReceivers, team };
};

const shouldRedirectToCallCenter = async (ctx, parties, targetContext, team) => {
  if (parties.length) {
    const senderParty = await loadParty(ctx, parties[0]); // parties[0] - because there should be only one party open for the sender
    return await doesUserBelongToACallCenter(ctx, senderParty.userId);
  }

  return targetContext.type === CommTargetType.TEAM && team.metadata.callRoutingStrategy === DALTypes.CallRoutingStrategy.CALL_CENTER;
};

const getCallUsersForStrategyByTeam = async (ctx, team, transferInitiator) => {
  logger.info({ ctx, team: team.displayName }, 'Routing call to users determined by call strategy of team');

  const { ids: allIds, type } = await getCallRoutingReceivers(ctx, team);
  const ids = allIds.filter(id => id !== transferInitiator);

  const receivers = type === CallReceiverType.REVA_USER ? await loadUsersByIds(ctx, ids) : [team];

  return { receivers, type, team };
};

const getTargetTeamIdForCallTransferToUser = async (ctx, userId, partyIds) => {
  const parties = await loadPartiesByIds(ctx, partyIds);
  const userTeams = await getTeamsForUser(ctx, userId);
  const userTeamIds = userTeams.map(team => team.id);
  const partyOwnedByUserTeam = parties.find(p => intersection(p.ownerTeam, userTeamIds).length);

  logger.trace({ ctx, userId, partyIds, userTeamIds, partyOwnedByUserTeam }, 'getTargetTeamIdForCallTransferToUser');

  if (partyOwnedByUserTeam) return partyOwnedByUserTeam.ownerTeam;
  return userTeamIds[0];
};

const getTeamFromCallContext = async (ctx, { type, id, program }, { parties: partyIds }) => {
  const originStack = formatStack(new Error().stack);

  try {
    logger.trace({ ctx, type, id, program, partyIds }, 'getTeamFromCallContext params');

    let teamId;
    switch (type) {
      case CommTargetType.TEAM_MEMBER:
        teamId = (await getTeamMemberById(ctx, id)).teamId;
        break;
      case CommTargetType.PROGRAM:
        teamId = program.teamId;
        break;
      case CommTargetType.INDIVIDUAL:
        // CommTargetType.INDIVIDUAL is when a call is transferred to a user
        teamId = await getTargetTeamIdForCallTransferToUser(ctx, id, partyIds);
        break;
      case CommTargetType.TEAM:
        // CommTargetType.TEAM is when a call is transferred to a team
        teamId = id;
        break;
      default: {
        throw new ServiceError({
          token: 'INVALID_CALL_TARGET_TYPE',
          status: 412,
        });
      }
    }

    const team = await getTeamBy(ctx, { id: teamId });
    logger.info({ ctx, team: team.displayName, teamId }, 'getTeamFromCallContext result');
    return team;
  } catch (error) {
    logger.error({ ctx, error, originStack }, 'getTeamFromCallContext error');
    throw error;
  }
};

const processCommunication = async (ctx, { callId, callData, communicationContext, redialAttemptNo }) => {
  const { transferredFromCommId = null } = callData;
  const [comm] = await commsRepo.getCommsByMessageIdAndTransferredFrom(ctx, callId, transferredFromCommId);
  if (comm) {
    return {
      commId: comm.id,
      partyId: comm.parties[0],
      personId: comm.persons[0],
      isLeadCreated: false,
    };
  }

  const contextData = {
    communicationContext,
    message: await constructMessageData(ctx, callData, communicationContext),
  };
  const commInfoResult = await processIncomingCommunication(ctx, contextData);
  if (commInfoResult.isSpam) return { isSpam: true };

  if (!redialAttemptNo) {
    const commEntry = await commsRepo.loadMessageById(ctx, commInfoResult.communication.id);
    await updatePartyActivity(ctx, [commEntry], getActivityLogDetailsForNewComm);
  }

  return {
    commId: commInfoResult.communication.id,
    partyId: commInfoResult.partyId,
    partyIds: commInfoResult?.partyIds,
    personId: commInfoResult.personId,
    isLeadCreated: commInfoResult.isLeadCreated,
  };
};

const shouldRouteByTeamStrategy = async (ctx, parties, transferredFromUserId, targetTeam) => {
  logger.trace({ ctx, parties: parties.map(p => p.id), transferredFromUserId, targetTeam: targetTeam.displayName }, 'shouldRouteByTeamStrategy params');
  const [ownerTeamId] = parties.map(p => p.ownerTeam);
  const ownerTeam = await getTeamBy(ctx, { id: ownerTeamId });
  const transferTargetTeam = transferredFromUserId && targetTeam;
  const calledTeam = transferTargetTeam || ownerTeam;

  const routeByStrategy =
    [DALTypes.CallRoutingStrategy.EVERYBODY, DALTypes.CallRoutingStrategy.ROUND_ROBIN].includes(calledTeam.metadata.callRoutingStrategy) ||
    (transferTargetTeam && transferTargetTeam !== ownerTeam);

  logger.trace({ ctx, calledTeam, routeByStrategy }, 'shouldRouteByTeamStrategy result');
  return { calledTeam, routeByStrategy };
};

const getReceiversForCalling = async ({ ctx, targetTeam, targetContext, transferredFromUserId, isUnknownCaller, parties }) => {
  if (targetContext.type === CommTargetType.TEAM_MEMBER || targetContext.type === CommTargetType.INDIVIDUAL) {
    const { userId } = targetContext.type === CommTargetType.TEAM_MEMBER ? await getTeamMemberById(ctx, targetContext.id) : { userId: targetContext.id };

    const user = await loadActiveUserById(ctx, userId);

    if (user) {
      logger.info({ ctx }, 'Routing call to individual user');
      return {
        receivers: [user],
        type: CallReceiverType.REVA_USER,
        team: targetTeam,
      };
    }
  }

  if (await shouldRedirectToCallCenter(ctx, parties, targetContext, targetTeam)) {
    return {
      receivers: [targetTeam],
      type: CallReceiverType.CALL_CENTER,
      team: targetTeam,
    };
  }

  if (isUnknownCaller) {
    return await getCallUsersForStrategyByTeam(ctx, targetTeam, transferredFromUserId);
  }

  // narrow down the number of parties by using alias data if present
  const allParties = await loadPartiesByIds(ctx, parties);

  const narrowedParties = commsHelpers.narrowDownPartiesByProperty({
    parties: allParties,
    propertyId: targetContext.program && targetContext.program.propertyId,
  });

  const { calledTeam, routeByStrategy } = await shouldRouteByTeamStrategy(ctx, narrowedParties, transferredFromUserId, targetTeam);

  if (routeByStrategy) return await getCallUsersForStrategyByTeam(ctx, calledTeam, transferredFromUserId);

  logger.info({ ctx }, 'Routing call to user(s) owning party(ies) of caller');

  const users = await loadUsersByIds(
    ctx,
    narrowedParties.map(p => p.userId),
  );

  if (users.length && transferredFromUserId) {
    return await excludeTransferInitiatorFromUsersToCall(ctx, users, calledTeam, transferredFromUserId);
  }

  return {
    receivers: users,
    type: CallReceiverType.REVA_USER,
    team: calledTeam,
  };
};

export const getTargetId = async (ctx, { commTargetType, targetContextId, targetTeamId }) => {
  switch (commTargetType) {
    case CommTargetType.PROGRAM:
      return { programId: targetContextId };
    case CommTargetType.TEAM_MEMBER:
      return { teamMemberId: targetContextId };
    case CommTargetType.TEAM:
      return { teamId: targetTeamId };
    case CommTargetType.INDIVIDUAL: {
      const teamMemberId = await getTeamMemberId(ctx, targetTeamId, targetContextId);
      return { teamMemberId };
    }
    default:
      throw new ServiceError({
        token: 'INVALID_CALL_TARGET_TYPE',
        status: 412,
      });
  }
};

const createDialIncomingCallResponse = async (ctx, { receivers, commId, partyId, isLeadCreated, callerId, commTargetType, targetContextId, targetTeamId }) => {
  const response = new Response();

  const isRecorded = await recording.addRecordingInstructions(ctx, response, commId);
  if (isRecorded) {
    const targetId = await getTargetId(ctx, { commTargetType, targetContextId, targetTeamId });

    const { message: callRecordingNotice } = await voiceMessages.getVoiceMessage(ctx, {
      ...targetId,
      messageType: DALTypes.VoiceMessageType.RECORDING_NOTICE,
    });
    recording.addRecordingNotice(ctx, response, callRecordingNotice);
  }

  const sipHeaders = `commId=${encodeSIP(commId)}`;

  const { postCallUrl, dialCallbackUrl } = await getTelephonyConfigs(ctx);

  const dial = response.addDial({
    callerId,
    sipHeaders,
    timeout: telephony.ringTimeBeforeVoicemail,

    // upon the completion of the call, Plivo makes a GET or POST request to this URL
    action: addParamsToUrl(postCallUrl, {
      commId,
      partyId,
      isLeadCreated,
      receiverType: receivers.type,
      commTargetType,
      targetContextId,
      targetTeamId,
    }),

    // URL that is notified by Plivo when one of the following events occur:
    // - called party is bridged with caller
    // - called party hangs up
    // - caller has pressed any digit
    callbackUrl: addParamsToUrl(dialCallbackUrl, {
      commId,
      partyId,
      receiverType: receivers.type,
    }),
  });

  receivers.sipEndpoints.forEach(e => dial.addUser(`sip:${e.username}@phone.plivo.com`));
  receivers.externalPhones.forEach(no => dial.addNumber(no));

  return response.toXML();
};

const getAvailableReceiverIds = async (ctx, receivers, type) => {
  if (type !== CallReceiverType.REVA_USER) return receivers.map(r => r.id);

  return (await promiseFilter(receivers, async user => await canUserBeCalled(ctx, user))).map(u => u.id);
};

const markCallAsMissed = async (ctx, commId) => {
  logger.trace({ ctx, commId }, 'marking call as missed and unread comm');
  const isMissed = true;
  const [commEntry] = await commsRepo.updateMessages(ctx, { id: commId }, { message: { isMissed }, unread: true });
  await mapSeries(commEntry.parties, async partyId => await commsRepo.saveUnreadCommunication(ctx, partyId, commEntry));

  await notifyCommunicationUpdate(ctx, commEntry);
};

const getOwnerTeamFromContext = async (ctx, targetContext, parties) => {
  const allParties = await loadPartiesByIds(ctx, parties);
  const narrowedParties = commsHelpers.narrowDownPartiesByProperty({
    parties: allParties,
    propertyId: targetContext.program && targetContext.program.propertyId,
  });

  const [ownerTeamId] = narrowedParties.map(p => p.ownerTeam);
  return await getTeamBy(ctx, { id: ownerTeamId });
};

const shouldSendToCallQueue = async ({ ctx, targetTeam, targetContext, callData, newLeadWasCreated, parties }) => {
  if (telephony.forceQueueDisabled) {
    logger.info({ ctx }, 'shouldSendToCallQueue forcing queue disabled');
    return { shouldSendToQueue: false };
  }

  if ([CommTargetType.TEAM_MEMBER, CommTargetType.INDIVIDUAL].includes(targetContext.type)) return { shouldSendToQueue: false };
  if (callData.transferTargetType === TransferTargetType.USER) return { shouldSendToQueue: false };

  const team =
    newLeadWasCreated || callData.transferTargetType === TransferTargetType.TEAM ? targetTeam : await getOwnerTeamFromContext(ctx, targetContext, parties);

  if (!(team.metadata.callQueue || {}).enabled) return { shouldSendToQueue: false };

  const onlineAgents = await getOnlineAgentsForPhoneCallsByTeamId(ctx, team.id);

  return { queueTeam: team, shouldSendToQueue: !!onlineAgents.length };
};

const createTargetNotFoundResponse = ctx => {
  const response = new Response();

  const delayInSeconds = 3; // delay to avoid truncating the message by the telephony system
  response.addWait({ length: delayInSeconds });
  voiceResponses.addVoiceMessageToResponse(ctx, response, resources.INCOMING_TO_UNKNOWN_NO);
  return response.toXML();
};

const updatePartyOwner = async ({ ctx, team, party, targetContext = {}, commId, userId, comm }) => {
  if (!party.userId) {
    logger.trace({ ctx, communicationId: commId || comm.id, userId, partyId: party.id }, 'Updating party owner');
    const communication = comm || (await commService.getCommunication(ctx, commId));
    const ownerId = userId || (await getPartyRoutingUserId(ctx, { targetContext, team }));
    await updateOwner(ctx, party, ownerId);

    communication && (await commsRepo.updateCommsWithoutOwnerIds(ctx, party.id, ownerId));
  }
};

const assignPartyIfNeeded = async (ctx, party, team, type, receivers, commId) => {
  if (party.userId) return;

  if (type === CallReceiverType.CALL_CENTER) {
    await updatePartyOwner({ ctx, team, party, targetContext: { type: CommTargetType.TEAM }, commId });
  }

  if (team.metadata.callRoutingStrategy === DALTypes.CallRoutingStrategy.OWNER) {
    const [user] = receivers;
    await updatePartyOwner({ ctx, party, commId, userId: user.id });
  }
};

const groupEndpointsByUserId = async (ctx, availableUserIds, availableSipEndpoints) => {
  const availableUsers = await loadUsersByIds(ctx, availableUserIds);
  const availableEndpointsByUserId = availableUsers.reduce(
    (acc, u) => ({ ...acc, [u.id]: intersectionBy(availableSipEndpoints, u.sipEndpoints, 'username') }),
    {},
  );
  return availableEndpointsByUserId;
};

const updateCommUserIdForSingleReceiver = async (ctx, commId, type, receivers) => {
  const receiverIsSingleUser = type === CallReceiverType.REVA_USER && receivers.length === 1;

  if (!receiverIsSingleUser) return;

  const userId = receivers[0].id;
  logger.trace({ ctx, commId, receiverIsSingleUser, userId }, 'updateCommUserIdForSingleReceiver');
  const comm = await commsRepo.updateCommunicationEntryById(ctx, commId, { userId });
  await notifyCommunicationUpdate(ctx, comm);
};

const getTransferParameters = callData => {
  const { transferTargetType, transferTarget, transferredCallDirection, transferredFrom, transferredFromCommId } = callData;
  const transferParams = { transferTargetType, transferTarget, transferredCallDirection, transferredFrom, transferredFromCommId };
  return pickBy(transferParams, val => !!val);
};

const getCallForwardingInformation = async (ctx, communicationContext, callData) => {
  const program = communicationContext.targetContext.program;
  const commsForwardingData = program.metadata.commsForwardingData;
  logger.trace(
    { ctx, programId: communicationContext.targetContext.id, commsForwardingData, callData: obscureObject(callData) },
    'Process received call for forwarding',
  );

  return { isCallForwarding: true, callData, transferTarget: commsForwardingData.forwardCallToExternalTarget, program };
};

export const respondToIncomingCallRequest = async req => {
  const { CallUUID: callId, redialAttemptNo = 0, isLeadCreated: isLeadFromTransfer = false } = req.body;

  if (redialAttemptNo) {
    logger.info({ ctx: req, callId, redialAttemptNo }, 'the incoming call is a redial attempt');
  }

  const callData = req.body;

  const { targetFound, communicationContext } = await getCommunicationContextFromPhoneCall(req, callData);

  if (!targetFound || shouldIgnoreProgram({ communicationContext })) return createTargetNotFoundResponse(req);
  const { targetContext, senderContext } = communicationContext;

  logger.trace({ ctx: req, communicationContext, callId }, 'determined communication context for incoming call');

  if (isProgramForwarding(communicationContext)) {
    return await getCallForwardingInformation(req, communicationContext, callData);
  }

  const { isSpam, commId, partyId, isLeadCreated: isNewLeadCreated, partyIds = [] } = await processCommunication(req, {
    callId,
    callData,
    communicationContext,
    redialAttemptNo,
  });

  logger.trace({ ctx: req, isSpam, commId, callId, partyId, isNewLeadCreated }, 'processCommunication result');

  if (isSpam) return voiceResponses.createVoiceMailResponse({ ctx: req, isSpam });

  const isLeadCreated = isNewLeadCreated || isLeadFromTransfer; // we need to pass this in the transfers

  const party = await loadParty(req, partyId);
  const partyIdsForComm = partyIds?.length ? partyIds : [partyId];

  const targetTeam = await getTeamFromCallContext(req, targetContext, { parties: partyIdsForComm });
  const targetId = await getTargetId(req, {
    commTargetType: targetContext.type,
    targetContextId: targetContext.id,
    targetTeamId: targetTeam.id,
  });

  const isAfterHours = !(await isDuringOfficeHours(req, targetTeam));
  if (isAfterHours) {
    logger.trace({ ctx: req, commId, callId, partyId, teamId: targetTeam?.id, ...targetId }, 'communication is after hours');
    await updatePartyOwner({ ctx: req, team: targetTeam, party, targetContext, commId });
    await markCallAsMissed(req, commId);
    return await voiceResponses.createVoiceResponse(req, { commId, ...targetId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
  }
  const { shouldSendToQueue, queueTeam } = await shouldSendToCallQueue({
    ctx: req,
    targetTeam,
    targetContext,
    callData,
    newLeadWasCreated: isNewLeadCreated,
    parties: partyIdsForComm,
  });

  if (shouldSendToQueue) {
    logger.trace({ ctx: req, commId, team: queueTeam.displayName }, 'sending call to queue');
    const { transferredFrom } = callData;

    return await callQueuing.sendCallToQueue(req, { commId, team: queueTeam, transferredFrom, ...targetId });
  }

  const { receivers, type, team: calledTeam } = await getReceiversForCalling({
    ctx: req,
    targetTeam,
    targetContext,
    transferredFromUserId: callData.transferredFrom,
    isUnknownCaller: isLeadCreated,
    parties: partyIdsForComm,
  });

  const isInOfficeHours = await isDuringOfficeHours(req, calledTeam);

  if (calledTeam !== targetTeam && !isInOfficeHours) {
    logger.trace(
      { ctx: req, calledTeam: calledTeam.displayName, targetTeam: targetTeam.displayName },
      'call routed to owner team which is different than target team and is outside office hours',
    );
    await updatePartyOwner({ ctx: req, team: calledTeam, party, targetContext, commId });
    await markCallAsMissed(req, commId);
    return await voiceResponses.createVoiceResponse(req, { commId, teamId: calledTeam.id, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
  }

  logger.trace(
    {
      ctx: req,
      receivers: receivers.map(r => r.fullName || r.name || r.id),
      callReceiverType: type,
      team: calledTeam.displayName,
      commId,
    },
    'determined receivers for incoming call',
  );

  await updateCommUserIdForSingleReceiver(req, commId, type, receivers);

  const availableReceiverIds = await getAvailableReceiverIds(req, receivers, type);
  const { enabled: isCallQueueEnabled } = targetTeam.metadata.callQueue || {};

  const shouldWaitAndDialAgain =
    !isCallQueueEnabled &&
    type === CallReceiverType.REVA_USER &&
    !availableReceiverIds.length &&
    receivers.some(u => u.metadata.status === DALTypes.UserStatus.BUSY) &&
    redialAttemptNo <= telephony.incomingRedialMaxAttempts;

  if (shouldWaitAndDialAgain) {
    return createWaitAndDialAgainResponse({
      ctx: req,
      callId,
      redialAttemptNo,
      isLeadCreated,
      commId,
      transferParameters: getTransferParameters(callData),
    });
  }

  if (!availableReceiverIds.length) {
    await updatePartyOwner({ ctx: req, team: calledTeam, party, targetContext, commId });
    await markCallAsMissed(req, commId);
    return await voiceResponses.createVoiceResponse(req, { commId, ...targetId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
  }

  await assignPartyIfNeeded(req, party, calledTeam, type, receivers, commId);

  const receivingEndpoints = await endpoints.getCallReceivingEndpoints(req, calledTeam, availableReceiverIds, type);
  logger.trace({ ctx: req, receivingEndpoints, commId }, 'receivers for incoming call');

  await commsRepo.updateCommunicationEntryById(req, commId, {
    message: {
      targetName: calledTeam.displayName,
      receiversEndpointsByUserId: await groupEndpointsByUserId(req, availableReceiverIds, receivingEndpoints.sipEndpoints),
    },
  });

  await updateStatusForUsers(req, availableReceiverIds, DALTypes.UserStatus.BUSY);

  return createDialIncomingCallResponse(req, {
    callerId: senderContext.from,
    receivers: receivingEndpoints,
    partyId,
    commId,
    isLeadCreated,
    commTargetType: targetContext.type,
    targetContextId: targetContext.id,
    targetTeamId: targetTeam.id,
  });
};

const getTargetIdForCall = async (ctx, commId) => {
  const comm = await commsRepo.loadMessageById(ctx, commId);
  const {
    parties,
    teamPropertyProgramId,
    message: { transferTargetType, transferTarget },
  } = comm;

  if (transferTargetType === TransferTargetType.USER) {
    const teamId = await getTargetTeamIdForCallTransferToUser(ctx, transferTarget, parties);
    const teamMemberId = await getTeamMemberId(ctx, teamId, transferTarget);
    return { teamMemberId };
  }

  if (transferTargetType === TransferTargetType.TEAM) return { teamId: transferTarget };

  const { programId } = await loadProgramByTeamPropertyProgramId(ctx, teamPropertyProgramId);
  return { programId };
};

export const respondToTransferToVoicemail = async req => {
  logger.trace({ ctx: req, ...req.body }, 'respondToTransferToVoicemail - params');
  const { commId, messageType, teamMemberId, programId, teamId } = req.body;

  const targetId = programId || teamId || teamMemberId ? { programId, teamId, teamMemberId } : await getTargetIdForCall(req, commId);

  return await voiceResponses.createVoiceResponse(req, { commId, ...targetId, messageType });
};

export const respondToTransferredCallFromQueue = async req => {
  logger.trace({ ctx: req, ...obscureObject(req.body) }, 'respondToTransferredCallFromQueue');

  const { commId } = req.body;

  const comm = await commsRepo.loadMessageById(req, commId);

  const response = new Response();

  const shouldRecord = await shouldRecordCall(req, comm);
  if (shouldRecord) recording.updateCommAndNotifyAboutRecording(req, comm);

  const { conferenceCallbackUrl } = await getTelephonyConfigs(req);
  const callbackUrl = addParamsToUrl(conferenceCallbackUrl, { commId: comm.id });

  response.addConference(`room_${comm.id}`, { endConferenceOnExit: true, callbackUrl, record: shouldRecord });
  const res = response.toXML();
  logger.trace({ ctx: req, commId: comm.id, response: res }, 'transfer call from queue response');

  const partyIds = comm.parties;
  if (partyIds && partyIds.length) {
    await sendMessageToCompleteFollowupPartyTasks(req, partyIds);
  }

  return res;
};

const updateOwnerForUnknownCaller = async (ctx, comm, userId) => {
  if (comm.parties.length !== 1) return;
  const party = await loadParty(ctx, comm.parties[0]);
  if (party.userId) return;
  logger.trace({ ctx, partyId: party.id, userId }, 'updating party owner for incoming call from unknown caller');
  await updatePartyOwner({ ctx, party, userId, comm });
};

const updateUserStatusForNotAnsweredCalls = async (ctx, userId) => {
  const { notAvailableSetAt } = await getUserStatusByUserId(ctx, userId);
  const userSetManuallyAsNotAvailable = !!notAvailableSetAt;
  const newStatus = userSetManuallyAsNotAvailable ? DALTypes.UserStatus.NOT_AVAILABLE : DALTypes.UserStatus.AVAILABLE;
  await updateUserStatus(ctx, userId, newStatus);
};

const handleCallForQueueToAgentHangup = async ({ ctx, commId, userId, callId }) => {
  logger.trace({ ctx, commId, userId, callId }, 'call to agent for queue was hung up');
  const {
    messageId: queuedCallId,
    userId: answeringUser,
    message: { answered },
  } = await commsRepo.loadMessageById(ctx, commId);

  const callWasAnsweredByThisAgent = answered && userId === answeringUser;
  if (callWasAnsweredByThisAgent) return;

  const liveCallsByAgent = await callQueuing.getLiveFiredCallsForQueuedCall(ctx, commId, userId);
  const noLiveCallsToThisAgent = (liveCallsByAgent[userId] || []).length === 0;
  if (noLiveCallsToThisAgent) {
    await updateUserStatusForNotAnsweredCalls(ctx, userId);
  }

  const noLiveCallsToAnyAgents = flatten(Object.values(liveCallsByAgent)).length === 0;
  if (noLiveCallsToAnyAgents && !answered) {
    const { auth } = await getTelephonyConfigs(ctx);
    const { notFound: queuedCallEnded } = await getTelephonyOps().getLiveCall(auth, { callId: queuedCallId });
    if (!queuedCallEnded) await callQueuing.markCallAsReadyForDequeue(ctx, commId, userId);
  }
};

const handleCallForQueueDeclineByAgent = async ({ ctx, commId, userId, callId, hangupCauseName }) => {
  logger.trace({ ctx, commId, userId, callId }, 'user declined queued call');

  const { hungUpCalls, remainingFiredCalls } = await callQueuing.hangupCallsFiredForQueue({ ctx, commId, exceptCallId: callId, forUserId: userId });

  if (hungUpCalls.length === 0) {
    logger.trace({ ctx, commId, userId }, 'no live calls to agent were hung up for queued call; hangup was previously handled for all fired calls to agent');
    return;
  }

  const userIdToSendMarkAsDeclined = hangupCauseName !== HangupCauseName.BUSY_LINE ? userId : '';

  if (remainingFiredCalls.length > 0) {
    await callQueuing.saveUserThatDeclinedCall(ctx, commId, userId);
  } else {
    await callQueuing.markCallAsReadyForDequeue(ctx, commId, userIdToSendMarkAsDeclined);
  }

  userIdToSendMarkAsDeclined && (await updateUserStatusForNotAnsweredCalls(ctx, userId));
};

const respondToCallForQueueAnsweredByAgent = async ({ ctx, commId, userId, callId, endpoint }) => {
  logger.trace({ ctx, commId, userId, callId }, 'agent answered call for queue');

  const user = await loadUserById(ctx, userId);

  const { hasAnsweredFromExternalEndpoint } = getAnsweringUserInfo(ctx, user, endpoint);

  if (hasAnsweredFromExternalEndpoint) {
    notify({
      ctx,
      event: eventTypes.CALL_ANSWERED,
      data: { commId, isPhoneToPhone: true },
      routing: { users: [userId] },
    });
  }

  const response = new Response();

  // Check first whether the call was already answered, if so, even if this agent accepted the call
  // there is nothing else to do. We will let the first agent pick up the call. Issue was that
  // the second agent would kill the calls because it would not be able to grab the communication
  const {
    userId: answeringUser,
    message: { answered },
  } = await commService.getCommunication(ctx, commId);
  if (answered && answeringUser) {
    logger.trace({ ctx, commId, answeringUser, answered, userId, callId, response }, 'ignoring agent pick up as somebody else picked it up');
    await updateUserStatus(ctx, userId, DALTypes.UserStatus.AVAILABLE);
    return response.toXML();
  }

  const comm = await commService.updateCommunicationEntryById({
    ctx: { ...ctx, authUser: user },
    id: commId,
    delta: { userId, message: { answered: true } },
    shouldAddActivityLog: true,
  });
  await notifyCommunicationUpdate(ctx, comm);

  await updateOwnerForUnknownCaller(ctx, comm, userId);

  const transferredSuccesfully = await callQueuing.transferQueuedCallToAgent(ctx, comm, callId);

  if (!transferredSuccesfully) {
    await callQueuing.hangupCalls(ctx, [callId]);
    await updateUserStatus(ctx, userId, DALTypes.UserStatus.AVAILABLE);
    return response.toXML();
  }

  await saveAnsweredCallEvent(ctx, { partyId: comm.parties[0], metadata: { communicationId: comm.id } });

  const { conferenceCallbackUrl } = await getTelephonyConfigs(ctx);
  const callbackUrl = addParamsToUrl(conferenceCallbackUrl, { commId: comm.id });

  response.addConference(`room_${commId}`, { endConferenceOnExit: true, callbackUrl });
  const res = response.toXML();

  logger.trace({ ctx, commId, response: res }, 'connect agent for queue response');
  return res;
};

export const respondToAgentCallForQueueRequest = async req => {
  logger.trace({ ctx: req, callData: obscureObject(req.body) }, 'respondToAgentCallForQueueRequest');

  const {
    commId,
    userId,
    CallUUID: callId,
    Event: event,
    CallStatus: callStatus,
    To: endpoint,
    Duration: duration,
    Machine: machineDetectedString,
    HangupCauseName: hangupCauseName = HangupCauseName.NO_HANGUP,
  } = req.body;
  const machineDetected = parseBoolean(machineDetectedString);

  const callWasHungUp =
    event === ConferenceEvents.HANGUP && [CallStatus.COMPLETED, CallStatus.FAILED].includes(callStatus) && (duration === '0' || machineDetected);
  const callWasDeclined = event === ConferenceEvents.HANGUP && [CallStatus.BUSY, CallStatus.NO_ANSWER].includes(callStatus);
  const callWasAnswered = event === ConferenceEvents.START_APP;

  const defaultResponse = new Response().toXML();
  const ctx = req;

  if (callWasHungUp) {
    await handleCallForQueueToAgentHangup({ ctx, commId, userId, callId });
    return defaultResponse;
  }

  if (callWasDeclined) {
    await handleCallForQueueDeclineByAgent({ ctx, commId, userId, callId, hangupCauseName });
    return defaultResponse;
  }

  if (callWasAnswered) {
    return await respondToCallForQueueAnsweredByAgent({ ctx, userId, commId, callId, endpoint });
  }

  return defaultResponse;
};
