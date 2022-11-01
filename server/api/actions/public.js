/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { addAutomaticTask, updateAutomaticTask } from '../../services/tasks';
import { updateScoreForParty } from '../../services/scoring';
import { getUsersWithRoleFromPartyOwnerTeam } from '../../dal/usersRepo';
import { saveDelayedMessage } from '../../dal/delayedMessagesRepo';
import { getPartyScreeningDecisionData } from '../../../rentapp/server/services/party-screening.ts';
import { APP_EXCHANGE, DELAYED_APP_EXCHANGE, COMM_MESSAGE_TYPE, DELAYED_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'api/actions/public' });

import { ServiceError } from '../../common/errors';
import { sendCommunication } from '../../services/communication';
import { createExternalPartyMemberInfoForPrimaryMember } from '../../services/externalPartyMemberInfo';
import { isNumber } from '../../../common/helpers/type-of';
import { reassignParty as reassignPartyService, archiveParty as archivePartyService } from '../../services/party';

export const getScreeningReports = async req => {
  const { partyId } = req.params;
  logger.trace({ ctx: req, partyId }, 'getScreeningReports');

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  const screeningReports = await getPartyScreeningDecisionData(req, partyId);
  logger.trace({ ctx: req, partyId, screeningReports }, 'getScreeningReports');
  return screeningReports;
};

export const getUsersWithRoleForParty = async req => {
  const { partyId, role } = req.params;
  logger.trace({ ctx: req, partyId, role }, 'getUsersWithRoleForParty');

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  if (!role) {
    throw new ServiceError({
      token: 'USER_ROLE_MISSING',
      status: 400,
    });
  }

  const userIds = await getUsersWithRoleFromPartyOwnerTeam(req, partyId, role);
  logger.trace({ ctx: req, partyId, role, userIds }, 'getUsersWithRoleForParty');
  return userIds;
};

export const createTask = async req => {
  const { partyId } = req.params;

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }
  const task = req.body;
  logger.trace({ ctx: req, partyId, task }, 'create task');

  await addAutomaticTask(req, task);
  return 201;
};

export const updateTask = async req => {
  const { partyId } = req.params;

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  const task = req.body;
  logger.trace({ ctx: req, partyId, task }, 'update task');

  await updateAutomaticTask(req, task.id, task);
  return 200;
};

export const updatePartyScore = async req => {
  const { partyId } = req.params;

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }
  const { score } = req.body;
  logger.trace({ ctx: req, partyId, score }, 'update party score');

  await updateScoreForParty(req, req.params.partyId, score);
  return 200;
};

export const sendPartyEmail = async req => {
  const { partyId } = req.params;

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }
  const { emailInfo } = req.body;
  logger.trace({ ctx: req, partyId, emailInfo }, 'sendPartyEmail');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.DECISION_SERVICE_EMAIL,
    message: {
      ctx: {
        tenantId: req.tenantId,
        host: req.host,
        protocol: req.protocol,
      },
      partyId,
      emailInfo,
    },
    ctx: req,
  });

  return 200;
};

const throwError = (token, status, data) => {
  throw new ServiceError({ token, status: status || 412, data });
};

export const sendDelayedCustomMessage = async req => {
  const { partyId } = req.params;

  logger.trace({ ctx: req, partyId, body: req.body }, 'sendDelayedCustomMessage');

  !partyId && throwError('PARTY_ID_MISSING', 400);

  const delay = req.body?.delay || 0;
  const THIRTY_ONE_DAYS_MILLISECOND_LIMIT = 2678400000;

  !isNumber(delay) && throwError('INVALID_DELAY', 400, { delay });
  delay > THIRTY_ONE_DAYS_MILLISECOND_LIMIT && throwError('DELAY_LIMIT_EXCEEDED', 400, { delay });

  const savedMessage = await saveDelayedMessage(req, partyId, { ...req.body, sessionId: req.reqId });

  await sendMessage({
    exchange: DELAYED_APP_EXCHANGE,
    key: DELAYED_MESSAGE_TYPE.PROCESS_DELAYED_MESSAGE,
    message: {
      ctx: {
        tenantId: req.tenantId,
      },
      delayedMessageId: savedMessage.id,
      partyId,
    },
    ctx: {
      ...req,
      delay,
    },
  });

  return 200;
};

export const sendComm = async req => {
  const { partyId } = req.params;

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  logger.trace({ ctx: req, partyId, body: req.body }, 'sendComm');

  const {
    templateName,
    personIds,
    channel: context,
    templateDataOverride,
    communicationCategory,
    templateArgs,
    messageType,
    skipAgentNotification,
    attachmentFilenames,
    userIdFrom,
  } = req.body;

  if (!templateName) throwError('TEMPLATE_NOT_DEFINED');
  if (!personIds) throwError('PERSON_IDS_NOT_DEFINED');

  await sendCommunication(req, {
    templateName,
    partyId,
    personIds,
    context,
    templateDataOverride,
    templateArgs,
    communicationCategory,
    skipAgentNotification,
    messageType,
    attachmentFilenames,
    userIdFrom,
  });

  return 200;
};

export const createPartyMember = async req => {
  const { partyId } = req.params;
  const { propertyId, propertyName } = req.body;

  if (!partyId || !propertyId || !propertyName) {
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMS',
      status: 400,
    });
  }

  logger.trace({ ctx: req, partyId, body: req.body }, 'createPartyMember');

  await createExternalPartyMemberInfoForPrimaryMember(req, {
    partyId,
    propertyId,
    propertyName,
  });

  return 200;
};

export const reassignParty = async req => {
  const { partyId } = req?.params;
  const { teamId, userId } = req?.body;

  logger.trace({ ctx: req, partyId, newTeamId: teamId, newUserId: userId }, 'reassignParty - action');

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  if (!teamId) {
    throw new ServiceError({
      token: 'TEAM_ID_MISSING',
      status: 400,
    });
  }

  if (!userId) {
    throw new ServiceError({
      token: 'USER_ID_MISSING',
      status: 400,
    });
  }

  await reassignPartyService(req, { partyId, teamId, userId });
  return 200;
};

export const archiveParty = async req => {
  const { partyId } = req?.params;
  const { reason } = req?.body;

  logger.trace({ ctx: req, partyId, reason }, 'archiveParty - action');

  if (!partyId) {
    throw new ServiceError({
      token: 'PARTY_ID_MISSING',
      status: 400,
    });
  }

  if (!reason) {
    throw new ServiceError({ token: 'MISSING_ARCHIVE_REASON', status: 400 });
  }

  await archivePartyService(req, { partyId, archiveReasonId: reason });
  return 200;
};
