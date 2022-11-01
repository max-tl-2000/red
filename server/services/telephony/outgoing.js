/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Response } from 'plivo';
import { getPersonById } from '../../dal/personRepo';
import { updateCallBackCommForParties } from '../../dal/callQueueRepo';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { addRecordingInstructions } from './recording';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import parseBoolean from '../../../common/helpers/booleanParser';
import { getPersonIdForContactInfoValue, getAllPersonsWithSamePhone } from '../../dal/contactInfoRepo';
import { updateCommunicationEntryById } from '../../dal/communicationRepo';
import eventTypes from '../../../common/enums/eventTypes';
import { extractSipUsername } from '../helpers/telephonyHelpers';
import { updateUserStatus } from '../users';
import { DALTypes } from '../../../common/enums/DALTypes';
import { notify } from '../../../common/server/notificationClient';
import loggerModule from '../../../common/helpers/logger';
import { obscureObject } from '../../../common/helpers/logger-utils';
import { loadPartiesByPersonIds, loadParty } from '../../dal/partyRepo';
import { updatePartyActivity, getActivityLogDetailsForNewComm } from '../activityLogService';
import { getTeamsForUser } from '../../dal/teamsRepo';
import { getOutProgramByTeamAndProperty } from '../../dal/programsRepo';
import { getTasksForPartiesByName } from '../../dal/tasksRepo';
import * as resources from './resources';
import { runInTransaction } from '../../database/factory';
import { toProfiledFunction } from '../../helpers/profiler';
import { getUpdatedRawData } from './callDataUtils';
import { ServiceError } from '../../common/errors';
import * as eventService from '../partyEvent';
import { computeThreadId } from '../../../common/helpers/utils';
import { addVoiceMessageToResponse } from './voiceResponses';
import { partyWfStatesSubset } from '../../../common/enums/partyTypes';
import { addNewCommunication } from '../communication';

const logger = loggerModule.child({ subType: 'telephony-outgoing' });

export const getOutgoingSourcePhoneNumber = async ({ ctx, partyId }) => {
  logger.trace({ ctx, partyId }, 'getOutgoingSourcePhoneNumber');

  const party = (partyId && (await loadParty(ctx, partyId))) || {};
  const { ownerTeam: teamId, assignedPropertyId: propertyId } = party;
  if (!teamId || !propertyId) {
    logger.error({ ctx, teamId, propertyId }, `ownerTeam or assignedProperty are missing on party ${partyId}`);
    throw new ServiceError({
      token: 'PARTY_WITHOUT_PROPERTY_OR_TEAM',
      status: 412,
    });
  }

  const program = await getOutProgramByTeamAndProperty(ctx, teamId, propertyId);
  if (!program) {
    logger.error({ ctx, partyId }, `No out teamPropertyProgram associated with team: ${teamId} and property: ${propertyId} and no default program`);
    throw new ServiceError({
      token: 'TEAM_PROPERTY_OUT_PROGRAM_DOES_NOT_EXIST',
      status: 412,
    });
  }

  const { displayPhoneNumber } = program;

  logger.trace(
    { ctx, displayPhoneNumber, programId: program.id, isDefaultProgram: program.default },
    `outgoing phone number for team ${teamId} and property ${propertyId}`,
  );
  return displayPhoneNumber;
};

const getPartiesForOutgoingCall = async (ctx, partyId, personId, userId, teams) => {
  if (partyId) return [partyId];

  const teamIds = new Set(teams);
  const parties = await loadPartiesByPersonIds(ctx, [personId], partyWfStatesSubset.all);
  const partiesInTheSameTeamsAsUser = parties.filter(p => p.teams.some(id => teamIds.has(id)));

  if (partiesInTheSameTeamsAsUser.length) return partiesInTheSameTeamsAsUser.map(p => p.id);

  const partyIds = parties.map(p => p.id);
  logger.warn(
    { ctx, partyIds, personId, callingAgent: userId },
    'no parties for the target person in the same team as calling agent to save for outgoing call, saving all parties of target person',
  );

  logger.trace({ ctx, parties, teams }, 'parties and teams for outgoing call comm entry');

  return partyIds;
};

export const createOutgoingCallCommunicationEntry = async ({ ctx: outerCtx, user, personId, parties, teams, callId, ...otherInfo }) => {
  logger.trace({ ctx: outerCtx, personId, parties, user: user.fullName, ...obscureObject(otherInfo) }, 'createOutgoingCallCommunicationEntry');

  const updatePartyActivityProfiled = toProfiledFunction(updatePartyActivity);
  const allPersonsWithSamePhone = await getAllPersonsWithSamePhone(outerCtx, [personId]);

  const execute = async trx => {
    const ctx = { ...outerCtx, trx };
    const party = (await loadParty(ctx, parties[0])) || {};

    const messageEntity = {
      type: DALTypes.CommunicationMessageType.CALL,
      parties,
      userId: user.id,
      direction: DALTypes.CommunicationDirection.OUT,
      persons: [personId],
      threadId: computeThreadId(DALTypes.CommunicationMessageType.CALL, allPersonsWithSamePhone),
      messageId: callId,
      message: { ...otherInfo },
      teams,
      category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
      partyOwner: party.userId,
      partyOwnerTeam: party.ownerTeam,
    };

    const comm = await addNewCommunication(ctx, messageEntity);

    await updatePartyActivityProfiled({ ...ctx, authUser: user }, [comm], getActivityLogDetailsForNewComm);

    logger.trace({ ctx, communication: obscureObject(comm) }, 'comm entry created for outgoing call');
    return comm;
  };

  return await runInTransaction(execute, outerCtx);
};

const createDialOutgoingCallResponse = async ({ ctx, number, callerId, isPhoneToPhone = false, callerName = callerId, commId, partyIds }) => {
  const { postCallUrl, dialCallbackUrl } = await getTelephonyConfigs(ctx);

  const response = new Response();

  await addRecordingInstructions(ctx, response, commId);

  const partyId = partyIds && partyIds[0];

  const dial = response.addDial({
    callerId,
    callerName,
    action: addParamsToUrl(postCallUrl, {
      isPhoneToPhone,
      commId,
      partyId,
    }),
    callbackUrl: addParamsToUrl(dialCallbackUrl, {
      isPhoneToPhone,
      commId,
      partyId,
    }),
  });
  dial.addNumber(number);
  return response.toXML();
};

const decodeExtraHeaders = payload => ({
  ...payload,
  partyId: payload['X-PH-PartyId'] && decodeURIComponent(payload['X-PH-PartyId']),
  personId: payload['X-PH-PersonId'] && decodeURIComponent(payload['X-PH-PersonId']),
});

const getTeamId = async (ctx, partyId, teams) => {
  const party = partyId && (await loadParty(ctx, partyId));
  if (party?.ownerTeam) return party.ownerTeam;

  return teams[0] || [];
};

export const respondToOutgoingCallRequest = async (req, initiatingUser) => {
  const {
    CallerName: callerName,
    CallUUID: callId,
    isPhoneToPhone: isPhoneToPhoneString,
    To: toNumber,
    guestNo,
    From: initiatingEndpoint,
    commId: existingCommId,
    personId: selectedPersonId,
    partyId,
  } = decodeExtraHeaders(req.body);

  const isPhoneToPhone = parseBoolean(isPhoneToPhoneString);

  logger.trace(
    {
      ctx: req,
      callerName,
      callId,
      isPhoneToPhone,
      toNumber,
      guestNo,
      initiatingEndpoint,
      existingCommId,
      selectedPersonId,
      partyId,
    },
    'parameters for respondToOutgoingCallRequest',
  );

  const number = guestNo || toNumber;

  const personId = selectedPersonId || (await getPersonIdForContactInfoValue(req, number));

  if (!personId) {
    logger.error({ ctx: req, number }, 'the dialed number does not belong to a person in the system, this feature is not supported');

    const response = new Response();

    const delayInSeconds = 3; // delay to avoid truncating the message by the telephony system
    response.addWait({ length: delayInSeconds });
    addVoiceMessageToResponse(req, response, resources.OUTGOING_TO_UNKNOWN_NO);
    return response.toXML();
  }

  const teams = (await getTeamsForUser(req, initiatingUser.id)).map(t => t.id);
  const parties = await getPartiesForOutgoingCall(req, partyId, personId, initiatingUser.id, teams);
  const teamId = await getTeamId(req, parties[0], teams);
  const callerNo = await getOutgoingSourcePhoneNumber({ ctx: req, partyId: parties[0] });

  const createOrUpdateComm = async () => {
    const rawMessage = await getUpdatedRawData(req, req.body);

    if (existingCommId) {
      return await updateCommunicationEntryById(req, existingCommId, {
        messageId: callId,
        message: { rawMessage },
      });
    }

    return await createOutgoingCallCommunicationEntry({
      ctx: req,
      user: initiatingUser,
      personId,
      parties,
      callId,
      toNumber,
      fromNumber: callerNo,
      rawMessage,
      teams: [teamId],
    });
  };

  const comm = await createOrUpdateComm();
  const { id: commId } = comm;

  const isCallInitiatedFromUsersPhone = () => {
    const { isSipEndpoint, username } = extractSipUsername(req, initiatingEndpoint);
    return isSipEndpoint && initiatingUser.sipEndpoints.some(e => e.username === username && !e.isUsedInApp);
  };

  const { fullName } = await getPersonById(req, personId);
  const sourcePartyId = partyId || parties[0];

  notify({
    ctx: req,
    event: eventTypes.OUTGOING_CALL_INITIATED,
    data: {
      partyIds: parties,
      commId,
      isPhoneToPhone: isPhoneToPhone || isCallInitiatedFromUsersPhone(),
      to: { fullName, partyId: sourcePartyId },
    },
    routing: { users: [initiatingUser.id] },
  });

  await updateUserStatus(req, initiatingUser.id, DALTypes.UserStatus.BUSY);

  const callBackTasks = await getTasksForPartiesByName(req, parties, DALTypes.TaskNames.CALL_BACK);
  const activeCallBackTaskExists = callBackTasks.some(task => task.state === DALTypes.TaskStates.ACTIVE);
  if (activeCallBackTaskExists) {
    await updateCallBackCommForParties(req, comm);
  }

  await eventService.saveCommunicationSentEvent(req, { partyId: sourcePartyId, userId: initiatingUser.id, metadata: { communicationId: commId } });

  return await createDialOutgoingCallResponse({
    ctx: req,
    number,
    callerId: callerNo,
    callerName,
    isPhoneToPhone: isPhoneToPhone || isCallInitiatedFromUsersPhone(),
    commId,
    partyIds: parties,
  });
};
