/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import * as commsRepo from '../../dal/communicationRepo';
import { getTeamById } from '../../dal/teamsRepo';
import { getTelephonyOps } from './providerApiOperations';
import { now } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { TransferTargetType } from './enums';
import { saveCallDetails } from '../../dal/callDetailsRepo';
import { loadPartyById } from '../../dal/partyRepo';
import { getPartyRoutingUserId } from '../routing/partyRouter';
import { CommTargetType } from '../routing/targetUtils';
import { updateOwner } from '../party';
import { getDisplayNameByPhoneNumber } from '../../dal/voiceMessageRepo';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import { saveEvent, saveMissedCallEvent } from '../partyEvent';
import * as commService from '../communication';

const logger = loggerModule.child({ subType: 'telephony-call-actions' });

const updateComm = async (ctx, commId, delta) => {
  const comm = await commsRepo.updateCommunicationEntryById(ctx, commId, delta);
  await mapSeries(comm.parties, async partyId => await commsRepo.saveUnreadCommunication(ctx, partyId, comm));
  return comm;
};

export const markCallAsMissed = async (ctx, commId, missedCallReason) => {
  const delta = {
    message: { isMissed: true, missedCallReason },
    unread: true,
  };
  return await updateComm(ctx, commId, delta);
};

const markCallAsCallbackRequested = async (ctx, commId) => {
  const delta = {
    message: { isMissed: true, isCallbackRequested: true, missedCallReason: DALTypes.MissedCallReason.CALLBACK_REQUESTED },
    unread: true,
  };
  return await updateComm(ctx, commId, delta);
};

export const assignCallPartyAccordingToRoutingStrategy = async (ctx, commId) => {
  const comm = await commsRepo.loadMessageById(ctx, commId);

  // incoming call from unknown caller should have only one team
  const team = await getTeamById(ctx, comm.teams[0]);

  // incoming call from unknown caller party should have only one associated party
  const [partyId] = comm.parties;
  const party = await loadPartyById(ctx, partyId);

  const userId = await getPartyRoutingUserId(ctx, { targetContext: { type: CommTargetType.TEAM }, team });
  const communication = await commService.getCommunication(ctx, commId);

  communication && (await commsRepo.updateCommsWithoutOwnerIds(ctx, party.id, userId));

  if (party.userId) {
    logger.trace({ ctx, partyId: party.id }, 'the party of the caller is already assigned, skipping assignement');
    return { partyId, userId: party.userId };
  }

  await updateOwner(ctx, party, userId);

  return { partyId, userId };
};

export const transferCallToNumber = async (ctx, { commId, number, requestedFrom }) => {
  logger.trace({ ctx, commId, number, requestedFrom }, 'transferCallToNumber - params');
  const { answerUrl, auth } = await getTelephonyConfigs(ctx);

  const { messageId: callId } = await commsRepo.loadMessageById(ctx, commId);

  const { notFound } = await getTelephonyOps().getLiveCall(auth, { callId });
  if (notFound) {
    logger.info({ ctx, commId }, `call ended before transferring to number: ${number}`);
    return false;
  }

  const urlParams = {
    transferTargetType: TransferTargetType.EXTERNAL_PHONE,
    transferTarget: number,
    transferredCallDirection: DALTypes.CommunicationDirection.IN,
    commId,
  };

  const url = addParamsToUrl(answerUrl, urlParams);
  const res = await getTelephonyOps().transferCall(auth, { callId, alegUrl: url });

  logger.info({ ctx }, `transfer call to number operation result: ${JSON.stringify(res)}`);

  const transferRequestedFrom = requestedFrom ? { transferRequestedFrom: requestedFrom } : {};
  const displayNameForNumber = await getDisplayNameByPhoneNumber(ctx, number);
  const delta = {
    message: { wasTransferred: true, transferredToNumber: number, transferredToDisplayName: displayNameForNumber, ...transferRequestedFrom },
    unread: true,
  };

  const comm = await updateComm(ctx, commId, delta);
  await notifyCommunicationUpdate(ctx, comm);

  const endTime = now({ timezone: 'UTC' }).toISOString();
  await saveCallDetails(ctx, { commId, details: { endTime } });

  return true;
};

export const transferCallToVoicemail = async (ctx, { commId, programId, teamMemberId, teamId, messageType }) => {
  logger.trace({ ctx, commId, programId, teamMemberId, teamId, messageType }, 'transferCallToVoicemail - params');

  const comm = await commsRepo.loadMessageById(ctx, commId);
  const { transferToVoicemailUrl, auth } = await getTelephonyConfigs(ctx);

  const { notFound } = await getTelephonyOps().getLiveCall(auth, { callId: comm.messageId });
  if (notFound) {
    logger.info({ ctx, commId: comm.id }, 'call ended before transferring to voicemail');
    return false;
  }

  const transferParams = { commId, programId, teamMemberId, teamId, messageType };
  const url = addParamsToUrl(transferToVoicemailUrl, transferParams);

  try {
    const res = await getTelephonyOps().transferCall(auth, { callId: comm.messageId, alegUrl: url });
    logger.info({ ctx, commId: comm.id }, `transfer call to voicemail operation result: ${JSON.stringify(res)}`);
  } catch (error) {
    logger.error({ error, ctx, commId }, 'Error while transferring call to voicemail');
    return false;
  }
  return true;
};

export const handleCallbackRequest = async (ctx, commId) => {
  await markCallAsCallbackRequested(ctx, commId);
  const { partyId } = await assignCallPartyAccordingToRoutingStrategy(ctx, commId);
  await saveEvent(ctx, { partyId, metadata: { communicationId: commId } }, DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED);
  await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });
};

export const handleVoicemailRequest = async (ctx, { commId, programId, teamId, teamMemberId, messageType }) => {
  await markCallAsMissed(ctx, commId, DALTypes.MissedCallReason.VOICEMAIL_REQUEST);
  const { partyId } = await assignCallPartyAccordingToRoutingStrategy(ctx, commId);
  await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: commId } });
  return transferCallToVoicemail(ctx, { commId, programId, teamMemberId, teamId, messageType });
};

export const handleTransferToNumberRequest = async (ctx, commId, number, requestedFrom) => {
  await assignCallPartyAccordingToRoutingStrategy(ctx, commId);
  return await transferCallToNumber(ctx, { commId, number, requestedFrom });
};
