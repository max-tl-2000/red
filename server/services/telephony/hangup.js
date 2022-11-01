/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Response } from 'plivo';
import { mapSeries } from 'bluebird';
import sortBy from 'lodash/sortBy';
import { toMoment, isValidMoment, now } from '../../../common/helpers/moment-utils';
import * as commsRepo from '../../dal/communicationRepo';
import { saveCallDetails } from '../../dal/callDetailsRepo';
import { isContactBlacklisted } from '../../dal/blacklistRepo';
import { notify } from '../../../common/server/notificationClient';
import logger from '../../../common/helpers/logger';
import eventTypes from '../../../common/enums/eventTypes';
import * as callQueuing from './callQueuing';
import * as userAvailability from './userAvailability';
import parseBoolean from '../../../common/helpers/booleanParser';
import { updatePartyOwnerAfterCall, getPartyById } from '../party';
import { saveMissedCallEvent, saveCommunicationCompletedEvent } from '../partyEvent';
import config from '../../config';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updatePartyActivity, getActivityLogDetailsForCommUpdate } from '../activityLogService';
import { getUpdatedRawData } from './callDataUtils';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import { getTelephonyOps } from './providerApiOperations';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { loadProgramForIncomingCommByPhone } from '../../dal/programsRepo';
import { getTargetForProgram } from '../routing/targetProcessorHelpers';
import { getContactsInfoByPhone, updateContactInfo } from '../../dal/contactInfoRepo';

const { telephony } = config;

let delayFunc = (...args) => setTimeout(...args);

export const setDelayFunc = func => (delayFunc = func);

const getEndTime = endTimeFromPlivo => {
  const endTime = toMoment(new Date(endTimeFromPlivo), { timezone: 'UTC' });
  return isValidMoment(endTime) ? endTime : now({ timezone: 'UTC' }).subtract(telephony.timeoutBeforeRequestingCallDetails, 'milliseconds');
};

const saveDetails = async (ctx, comm) => {
  const { auth } = await getTelephonyConfigs(ctx);
  const { endTime, notFound } = await getTelephonyOps().getCallDetails(auth, { callId: comm.messageId });
  logger.trace({ ctx, commId: comm.id, endTime, notFound }, 'call hangup - saveDetails');

  if (notFound) {
    const totalWaitTime = telephony.timeoutBeforeHandlingAfterCallOperations + telephony.timeoutBeforeRequestingCallDetails;
    logger.warn({ ctx, commId: comm.id, callId: comm.messageId, totalWaitTime }, 'call details not found after timeout');
    return;
  }

  const callDetails = {
    commId: comm.id,
    details: { endTime: getEndTime(endTime).toISOString() },
  };

  await saveCallDetails(ctx, callDetails);
};

const getLastCallStatus = comm => {
  if (comm.direction === DALTypes.CommunicationDirection.OUT) return DALTypes.ContactInfoLastCallStatus.OUTGOING;

  if (comm.message.isCallbackRequested) return DALTypes.ContactInfoLastCallStatus.CALLBACK_REQUESTED;

  if (comm.message.isMissed) return DALTypes.ContactInfoLastCallStatus.MISSED;

  return DALTypes.ContactInfoLastCallStatus.INCOMING;
};

const updateContactInfoMetadata = async (ctx, messageId) => {
  logger.info({ ctx, messageId }, 'updateContactInfoMetadata - params');

  const comms = await commsRepo.getCommunicationsByMessageId(ctx, messageId);

  if (!comms.length) {
    logger.info({ ctx, messageId }, 'updateContactInfoMetadata - No communication found for messageId');
    return;
  }

  const [comm] = sortBy(comms, c => -c.created_at);
  const value =
    comm.direction === DALTypes.CommunicationDirection.IN
      ? comm.message.rawMessage.From || comm.message.from
      : comm.message.rawMessage.To || comm.message.toNumber;

  const contactInfoByPhoneNumber = await getContactsInfoByPhone(ctx, value);
  const contactInfoEntriesToUpdate = contactInfoByPhoneNumber.filter(ci => comm.persons.includes(ci.personId));
  const lastCallStatus = getLastCallStatus(comm);
  const enhancedContantInfoEntries = contactInfoEntriesToUpdate.map(ci => ({
    ...ci,
    metadata: { ...ci.metadata, lastCall: lastCallStatus, lastCallDate: comm.created_at.toISOString() },
  }));

  await updateContactInfo(ctx, enhancedContantInfoEntries);
};

const updateCommunication = async (ctx, comm, delta) => {
  const updatedComm = await commsRepo.updateCommunicationEntryById(ctx, comm.id, delta);
  updatedComm.unread && (await mapSeries(updatedComm.parties, async partyId => await commsRepo.saveUnreadCommunication(ctx, partyId, updatedComm)));
  await notifyCommunicationUpdate(ctx, comm);
};

const performAfterCallOperations = async (ctx, { comms, messageId, rawMessage, isPhoneToPhone, machineDetected }) => {
  comms.length > 1 &&
    logger.trace(
      { ctx, callId: messageId, comms: comms.map(c => c.id) },
      'respondToHangupRequest - multiple comms for same callId indicate transfer(s), handling after call operations for last leg',
    );

  const [comm] = sortBy(comms, c => -c.created_at);

  const updatedComm = await commsRepo.updateCommunicationEntryById(ctx, comm.id, { message: { rawMessage } });

  const { userId, id: commId, parties } = comm;
  await updatePartyActivity(ctx, [updatedComm], getActivityLogDetailsForCommUpdate({ message: updatedComm.message, isCallTerminated: true }));

  isPhoneToPhone &&
    notify({
      ctx,
      event: eventTypes.CALL_TERMINATED,
      data: { commId, machineDetected },
      routing: { users: [userId] },
    });

  await delayFunc(async () => await saveDetails(ctx, comm), telephony.timeoutBeforeRequestingCallDetails);

  if (comm.message.postDialHandled) {
    // this will be true only when: callQueue=disabled and the call was answered
    // in this case `communication_completed` and  `communication_missed_call` events are saved in `respondToPostDialRequest` from server/services/telephony.js
    logger.trace({ ctx, commId: comm.id }, 'after call operations were handled by postDial request handler');
    return;
  }

  if (comm.message.isCallFromQueue) {
    // in this case `communication_completed` and  `communication_missed_call` events are saved in callQueuing.handleHangup
    await callQueuing.handleHangup(ctx, commId);
    logger.trace({ ctx, commId: comm.id }, 'after call operations were handled by callQueue handler');
    return;
  }

  const { transferredToNumber, answered } = comm.message;
  if (transferredToNumber && !answered) {
    await mapSeries(parties, async partyId => {
      const partyOwnerId = comm.userId || comm.partyOwner || (await getPartyById(ctx, partyId)).userId;
      partyOwnerId && (await saveCommunicationCompletedEvent(ctx, { partyId, userId, metadata: { communicationId: comm.id } }));
    });

    const delta = { message: { isMissed: true } };
    await updateCommunication(ctx, comm, delta);
    return;
  }

  await mapSeries(parties, async partyId => {
    const partyOwnerId = await updatePartyOwnerAfterCall(ctx, partyId);
    await saveCommunicationCompletedEvent(ctx, { partyId, userId: partyOwnerId, metadata: { communicationId: comm.id } });
  });

  const { receiversEndpointsByUserId } = comm.message;
  const receiverIds = Object.keys(receiversEndpointsByUserId || {});
  const callAgents = [comm.userId, ...receiverIds].filter(id => !!id);

  logger.debug({ ctx, commId: comm.id, callAgents }, 'making call agents available');
  if (callAgents.length > 0) await userAvailability.markUsersAvailable(ctx, callAgents);

  // and the call is answered from Plivo's POV
  if (comm.direction === DALTypes.CommunicationDirection.IN && !comm.message.answered) {
    const delta = { message: { isMissed: true, missedCallReason: DALTypes.MissedCallReason.FALLBACK_MISSED }, unread: true };
    await updateCommunication(ctx, comm, delta);
    await mapSeries(parties, async partyId => {
      await saveMissedCallEvent(ctx, { partyId, metadata: { communicationId: comm.id } });
    });
  }
};

const performAfterCallOperationsRetry = async (ctx, { messageId, rawMessage, isPhoneToPhone, machineDetected }) => {
  logger.trace({ ctx, messageId, isPhoneToPhone, machineDetected }, 'performAfterCallOperationsRetry');
  const comms = await commsRepo.getCommunicationsByMessageId(ctx, messageId);

  if (!comms.length) {
    const { StartTime: startTime, EndTime: endTime } = rawMessage;
    const VERY_SHORT_CALL_DURATION_SEC = 2;

    // based on Plivo support ticket #37031 if the call is cancelled immediately we may not receive a request from Plivo when the call was initiated,
    // so we will not have a record in our database when the hang up request is processed
    if (toMoment(endTime).diff(toMoment(startTime), 'seconds') < VERY_SHORT_CALL_DURATION_SEC) {
      logger.trace({ ctx, messageId, startTime, endTime }, 'ignoring the call, because was cancelled right after it was initiated');
      return;
    }

    logger.error({ ctx, messageId, rawMessage }, 'cannot find communication entry for call at handleAfterCallOperations');
    return;
  }

  await performAfterCallOperations(ctx, { comms, messageId, rawMessage, isPhoneToPhone, machineDetected });
};

const shouldIgnoreCall = async (ctx, { messageId, from, to }) => {
  const isSpam = await isContactBlacklisted(ctx, DALTypes.ContactInfoType.PHONE, from);
  if (isSpam) {
    logger.trace({ ctx, messageId, from }, 'handleAfterCallOperations - is spam');
    return true;
  }

  const program = await loadProgramForIncomingCommByPhone(ctx, to, { includeInactive: true });
  if (program) {
    const { program: targetProgram, shouldIgnore } = await getTargetForProgram({ ctx, program, identifier: to });
    if (!targetProgram || shouldIgnore) {
      logger.trace({ ctx, messageId, from }, 'handleAfterCallOperations - inactive program');
      return true;
    }
  }

  return false;
};

const handleAfterCallOperations = async (ctx, { messageId, isPhoneToPhone, machineDetected, rawMessage, from, to }) => {
  const handle = async () => {
    try {
      logger.trace({ ctx, messageId, isPhoneToPhone, machineDetected }, 'handleAfterCallOperations');
      const comms = await commsRepo.getCommunicationsByMessageId(ctx, messageId);

      if (comms.length) {
        await performAfterCallOperations(ctx, { comms, messageId, rawMessage, isPhoneToPhone, machineDetected });
      } else {
        const shouldIgnore = await shouldIgnoreCall(ctx, { messageId, from, to });
        if (shouldIgnore) return;

        await delayFunc(
          async () => performAfterCallOperationsRetry(ctx, { messageId, rawMessage, isPhoneToPhone, machineDetected }),
          telephony.timeoutBeforeHandlingAfterCallOperationsRetry,
        );
      }
    } catch (error) {
      logger.error({ ctx, messageId, error }, 'handleAfterCallOperations error');
    }
  };

  // delaying to allow postDial handler to execute if necessary
  await delayFunc(handle, telephony.timeoutBeforeHandlingAfterCallOperations);
};

export const respondToHangupRequest = async req => {
  const { isPhoneToPhone, CallUUID: messageId, Machine: machineDetectedString, From, To } = req.body;
  const machineDetected = parseBoolean(machineDetectedString);
  const rawMessage = await getUpdatedRawData(req, req.body);
  await handleAfterCallOperations(req, { messageId, isPhoneToPhone, machineDetected, rawMessage, from: From, to: To });

  await delayFunc(async () => await updateContactInfoMetadata(req, messageId), telephony.timeoutBeforeRequestingCallDetails);
  return new Response().toXML();
};
