/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { loadPartiesByIds, getTeamsForParties } from '../dal/partyRepo';
import { sendMessage } from '../services/pubsub';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from './message-constants';
import { FadvRequestTypes } from '../../common/enums/fadvRequestTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { AppointmentEmailType, LeaseEmailType } from '../../common/enums/enums';

export const notifyCommunicationUpdate = async (ctx, communication) => {
  const partiesWithOwner = (await loadPartiesByIds(ctx, communication.parties)).filter(p => p.userId);
  const partyIds = partiesWithOwner.map(p => p.id);
  if (!partyIds.length) return;
  const teams = await getTeamsForParties(ctx, partyIds);
  await notify({
    ctx,
    event: eventTypes.COMMUNICATION_UPDATE,
    data: { partyIds, ids: [communication.id], threadIds: [communication.threadId] },
    routing: { teams },
  });
};

export const getEmailNotificationMessage = (emailType, commCategory, partyWfName) => {
  switch (commCategory) {
    case DALTypes.CommunicationCategory.APPOINTMENT:
      switch (emailType) {
        case AppointmentEmailType.CREATE:
          return 'APPOINTMENT_CONFIRMATION_EMAIL_SUCCESS';
        case AppointmentEmailType.UPDATE:
          return 'APPOINTMENT_UPDATE_EMAIL_SUCCESS';
        case AppointmentEmailType.CANCEL:
          return 'APPOINTMENT_CANCELLED_EMAIL_SUCCESS';
        default:
          return '';
      }
    case DALTypes.CommunicationCategory.LEASE:
      switch (emailType) {
        case LeaseEmailType.SENT:
          return 'SIGN_LEASE_EMAIL_SUCCESS';
        case LeaseEmailType.VOID:
          return 'VOID_LEASE_EMAIL_SUCCESS';
        case LeaseEmailType.EXECUTE:
          return 'EXECUTED_LEASE_EMAIL_SUCCESS';
        default:
          return '';
      }
    case DALTypes.CommunicationCategory.QUOTE:
      return partyWfName === DALTypes.WorkflowName.RENEWAL ? 'RENEWAL_LETTER_SENT_SUCCESS' : 'QUOTE_EMAIL_SENT_SUCCESS';
    case DALTypes.CommunicationCategory.APPLICATION_DECLINED:
      return 'APPLICATION_DECLINED_EMAIL_SENT_SUCCESS';
    case DALTypes.CommunicationCategory.APPLICATION_INVITE:
      return 'APPLICATION_EMAIL_SENT_SUCCESS';
    default:
      return '';
  }
};

export const getSMSNotificationMessage = (smsType, commCategory, partyWfName) => {
  switch (commCategory) {
    case DALTypes.CommunicationCategory.APPOINTMENT:
      switch (smsType) {
        case 'create':
          return 'APPOINTMENT_CONFIRMATION_SMS_SUCCESS';
        case 'update':
          return 'APPOINTMENT_UPDATE_SMS_SUCCESS';
        case 'cancel':
          return 'APPOINTMENT_CANCELLED_SMS_SUCCESS';
        default:
          return '';
      }
    case DALTypes.CommunicationCategory.QUOTE:
      return partyWfName === DALTypes.WorkflowName.RENEWAL ? 'RENEWAL_LETTER_SENT_SUCCESS' : 'QUOTE_SMS_SENT_SUCCESS';
    case DALTypes.CommunicationCategory.APPLICATION_DECLINED:
      return 'APPLICATION_DECLINED_SMS_SENT_SUCCESS';
    case DALTypes.CommunicationCategory.APPLICATION_INVITE:
      return 'APPLICATION_SMS_SENT_SUCCESS';
    default:
      return '';
  }
};

export const notifyCommunicationsUpdate = async (ctx, communications) => {
  const partyIdsFromComms = flatten(communications.map(comm => comm.parties));
  const partiesWithOwner = (await loadPartiesByIds(ctx, partyIdsFromComms)).filter(p => p.userId);

  const partyIds = partiesWithOwner.map(p => p.id);
  if (!partyIds.length) return;

  const teams = await getTeamsForParties(ctx, partyIds);
  const communicationIds = communications.map(comm => comm.id);
  const threadIds = communications.map(comm => comm.threadId);

  await notify({
    ctx,
    event: eventTypes.COMMUNICATION_UPDATE,
    data: { partyIds, ids: communicationIds, threadIds },
    routing: { teams },
  });
};

const forceRescreen = async (ctx, partyId, routingKey) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: routingKey,
    message: {
      tenantId: ctx.tenantId,
      partyId,
      screeningTypeRequested: FadvRequestTypes.NEW,
    },
    ctx,
  });

export const sendStuckRequestDetectedMessage = async (ctx, partyId) => await forceRescreen(ctx, partyId, SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED);

export const sendApplicantMemberTypeChangedMessage = async (ctx, partyId) =>
  await forceRescreen(ctx, partyId, SCREENING_MESSAGE_TYPE.APPLICANT_MEMBER_TYPE_CHANGED);
