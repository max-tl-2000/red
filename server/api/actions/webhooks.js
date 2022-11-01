/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sendMessage } from '../../services/pubsub';
import { handleExternalCalendarRsvpResponse } from '../../services/appointments';
import * as service from '../../services/telephony';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE, EXTERNAL_CALENDARS_TYPE } from '../../helpers/message-constants';
import { ServiceError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { insertInto } from '../../database/factory';
import { obscureObject } from '../../../common/helpers/logger-utils';
import * as incoming from '../../services/telephony/incoming';
import { validateUser } from './users';
import { validateTeam } from './teams';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { processSendGridStats } from '../../services/bulkEmails/sendGridStats';

const logger = loggerModule.child({ subType: 'api/webhooks' });

const clientError = new ServiceError({ status: 400 });
const serverError = new ServiceError({ status: 500 });

export const enqueueInboundEmailReceived = async req => {
  logger.trace({ ctx: req }, 'enqueueInboundEmailReceived');

  const { Bucket, Key } = req.body;
  if (!Bucket || !Key) {
    logger.error(`Bucket or key missing for email: key - ${Key} / bucket -${Bucket}`);
    throw clientError;
  }
  try {
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.INBOUND_EMAIL,
      message: req.body,
      ctx: req,
    });
  } catch (error) {
    logger.error({ error }, 'Error while handling received mail');
    throw serverError;
  }
};

export const enqueueOutboundEmailStatusChange = async req => {
  logger.trace({ ctx: req }, 'enqueueOutboundEmailStatusChange');
  if (!req.tenantId) {
    logger.warn({ ctx: req }, 'Unable to update status on non-tenant email');
    return true;
  }
  const { email, messageId, type } = req.body;
  if (!email || !messageId || !type) {
    logger.error(`Email status change parameters missing: ${JSON.stringify(req.body)}`);
    throw clientError;
  }
  try {
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.OUTBOUND_EMAIL_STATUS_UPDATE,
      message: req.body,
      ctx: req,
    });
    return true;
  } catch (error) {
    logger.error({ error }, 'Error while handling email status update');
    throw serverError;
  }
};

export const enqueueInboundSmsReceived = async req => {
  logger.trace({ ctx: req }, 'enqueueInboundSmsReceived');
  try {
    const body = obscureObject(req.body);
    logger.info({ ctx: req }, `Saving inbound SMS: ${JSON.stringify(body)}`);
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.INBOUND_SMS,
      message: { ...body, tenantId: req.tenantId },
      ctx: req,
    });
  } catch (error) {
    logger.error({ ctx: req, error }, 'Error while handling received sms');
    throw serverError;
  }
};

export const enqueueOutboundSmsStatusChange = async req => {
  logger.trace({ ctx: req, reqBody: req.body, reqQuery: req.query }, 'enqueueOutboundSmsStatusChange');

  try {
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.OUTBOUND_SMS_STATUS_UPDATE,
      message: { ...req.body, tenantId: req.tenantId, commId: req.query.commId },
      ctx: req,
    });
  } catch (error) {
    logger.error({ ctx: req, error }, 'Error while handling sms status update');
    throw serverError;
  }
};

export const respondToCallRequest = async req => {
  logger.trace({ ctx: req }, 'respondToCallRequest');
  const content = await service.respondToDirectCallRequest(req);
  return { type: 'xml', content };
};

export const respondToPostCallRequest = async req => {
  logger.trace({ ctx: req }, 'respondToPostCallRequest');
  const content = await service.respondToPostDialRequest(req);
  return { type: 'xml', content };
};

export const respondToDialCallbackRequest = async req => {
  logger.trace({ ctx: req }, 'respondToDialCallbackRequest');
  const content = await service.respondToDialCallback(req);
  return { type: 'xml', content };
};

export const respondToAgentCallForQueueRequest = async req => {
  logger.trace({ ctx: req }, 'respondToAgentCallForQueueRequest');
  const content = await incoming.respondToAgentCallForQueueRequest(req);
  return { type: 'xml', content };
};

export const respondToDigitsPressedRequest = async req => {
  logger.trace({ ctx: req }, 'respondToDigitsPressedRequest');
  const content = await service.respondToDigitsPressedRequest(req);
  return { type: 'xml', content };
};

export const respondToCallReadyForDequeueRequest = async req => {
  logger.trace({ ctx: req }, 'respondToCallReadyForDequeueRequest');
  const content = await service.respondToCallReadyForDequeueRequest(req);
  return { type: 'xml', content };
};

export const respondToConferenceCallbackRequest = async req => {
  logger.trace({ ctx: req }, 'respondToConferenceCallbackRequest');
  const content = await service.respondToConferenceCallbackRequest(req);
  return { type: 'xml', content };
};

export const transferFromQueue = async req => {
  const content = await incoming.respondToTransferredCallFromQueue(req);
  return { type: 'xml', content };
};

export const transferToVoicemail = async req => {
  const content = await incoming.respondToTransferToVoicemail(req);
  return { type: 'xml', content };
};

export const saveCallRecording = service.saveCallRecording;

export const respondToRCEvent = async req => {
  logger.trace({ ctx: req }, 'respondToRCEvent');
  const header = req.get('Validation-Token');
  await insertInto(req.tenantId, 'RingCentralEvents', {
    eventType: req.body.event,
    body: req.body,
  });
  return {
    headers: {
      'Validation-Token': header,
    },
  };
};

export const respondToCalendarDelegatedAccessCallback = async req => {
  const {
    authorization: { code, state: entityTypeAndId },
  } = req.body;
  const [type, id] = entityTypeAndId.split(':');
  logger.trace({ ctx: req, type, id }, 'respondToCalendarDelegatedAccessCallback');

  type === CalendarTargetType.USER && (await validateUser(req, id));
  type === CalendarTargetType.TEAM && (await validateTeam(req, id));

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.PERFORM_INTEGRATION_SETUP_FOR_ACCOUNT,
    message: {
      tenantId: req.tenantId,
      code,
      id,
      type,
    },
    ctx: req,
  });
};

export const userRevaCalendarEventUpdatedCallback = async req => {
  logger.trace({ ctx: req, reqBody: req.body, reqQuery: req.query }, 'userRevaCalendarEventUpdatedCallback');
  const { userId } = req.query;
  const { notification } = req.body;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.USER_REVA_EVENT_UPDATED,
    message: {
      tenantId: req.tenantId,
      userId,
      notificationData: notification,
    },
    ctx: req,
  });
};

export const userPersonalCalendarEventUpdatedCallback = async req => {
  logger.trace({ ctx: req, reqBody: req.body, reqQuery: req.query }, 'userPersonalCalendarEventUpdatedCallback');
  const { userId } = req.query;
  const { notification } = req.body;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.USER_PERSONAL_EVENT_UPDATED,
    message: {
      tenantId: req.tenantId,
      userId,
      notificationData: notification,
    },
    ctx: req,
  });
};

export const teamCalendarEventUpdatedCallback = async req => {
  logger.trace({ ctx: req, reqBody: req.body, reqQuery: req.query }, 'teamCalendarEventUpdatedCallback');
  const { teamId } = req.query;
  const { notification } = req.body;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.TEAM_EVENT_UPDATED,
    message: {
      tenantId: req.tenantId,
      teamId,
      notificationData: notification,
    },
    ctx: req,
  });
};

export const externalCalendarRsvpStatus = async req => {
  logger.trace({ ctx: req, reqBody: req.body, reqQuery: req.query }, 'externalCalendarRsvpStatus');
  const { smart_invite_id: appointmentId, reply } = req.body.smart_invite;

  return await handleExternalCalendarRsvpResponse(req, appointmentId, reply);
};

export const sendGridStats = async req => {
  logger.trace({ ctx: req, reqBody: req.body }, 'sendGrid Statistics');
  const { event } = req.body;

  await processSendGridStats(req, event);
};
