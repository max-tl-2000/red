/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertyAssignedToParty } from '../helpers/party';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../helpers/message-constants';
import config from '../config';
import { getUserFullNameById } from '../dal/usersRepo';
import { loadParty, getTimezoneForParty } from '../dal/partyRepo';
import { addNewCommunication } from './communication';
import { sendMessage } from './pubsub';
import { fillSmsTemplate } from '../../common/helpers/render-sms-tpl';
import { TIME_PERIOD_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../common/date-constants';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';
import { getOutgoingSourcePhoneNumber } from './telephony/outgoing';
import { notifyCommunicationUpdate, getSMSNotificationMessage } from '../helpers/notifications';
import { toMoment } from '../../common/helpers/moment-utils';
import { getLeasingOfficeAddress } from './helpers/properties';
import { isSelfServiceAppointment as selfServiceAppointmentCheck } from '../../common/helpers/tasks.js';
import { getPropertyById } from '../dal/propertyRepo';

const logger = loggerModule.child({ subtype: 'services/sms' });

const getAppointmentDate = async (ctx, appointmentData) => {
  const { partyId } = appointmentData;
  const timezone = await getTimezoneForParty(ctx, partyId);

  const momentDate = toMoment(appointmentData.metadata.startDate, { timezone });
  const date = `${momentDate.format(MONTH_DATE_YEAR_FORMAT)} at ${momentDate.format(TIME_PERIOD_FORMAT)}`;
  return date;
};

const getAppointmentPropertyAddress = async (ctx, appointmentData) => {
  let property;
  const { selectedPropertyId } = appointmentData.metadata;

  if (selectedPropertyId) {
    property = await getPropertyById(ctx, selectedPropertyId);
  } else {
    const party = await loadParty(ctx, appointmentData.partyId);
    property = await getPropertyAssignedToParty(ctx, party);
  }
  return getLeasingOfficeAddress(property);
};

const getAppointmentCancelledSmsTemplateData = async (ctx, appointmentData) => {
  const date = await getAppointmentDate(ctx, appointmentData);
  const templateData = {
    templateName: config.smsTemplateNameMap.appointmentCancelledSmsTemplate,
    data: { date },
  };
  return templateData;
};

const getAppointmentConfirmedSmsTemplateData = async (ctx, appointmentData) => {
  const date = await getAppointmentDate(ctx, appointmentData);
  const appointmentOwnerName = await getUserFullNameById(ctx, appointmentData.userIds[0]);
  const propertyAddress = await getAppointmentPropertyAddress(ctx, appointmentData);
  const templateData = {
    templateName: config.smsTemplateNameMap.appointmentConfirmedSmsTemplate,
    data: {
      date,
      appointmentOwnerName,
      propertyAddress,
    },
  };
  return templateData;
};

const getAppointmentUpdatedSmsTemplateData = async (ctx, appointmentData) => {
  const date = await getAppointmentDate(ctx, appointmentData);
  const appointmentOwnerName = await getUserFullNameById(ctx, appointmentData.userIds[0]);
  const propertyAddress = await getAppointmentPropertyAddress(ctx, appointmentData);
  const templateData = {
    templateName: config.smsTemplateNameMap.appointmentUpdatedSmsTemplate,
    data: {
      date,
      appointmentOwnerName,
      propertyAddress,
    },
  };
  return templateData;
};

const getAppointmentMessage = async (phones, templateData) => {
  const text = await fillSmsTemplate(templateData);
  return {
    to: phones,
    text,
  };
};

export const getFormattedSmsData = async (ctx, { message, tenantName, partyId, entityId, userId }) => {
  const sourcePhoneNo = await getOutgoingSourcePhoneNumber({ ctx, partyId });
  const { tenantId } = ctx;

  logger.trace(sourcePhoneNo, 'sourcePhoneNumber');
  return {
    message,
    tenantId,
    tenantName,
    partyId,
    entityId,
    userId,
    sourcePhoneNo,
  };
};

const getSmsData = async (ctx, { message, members, appointmentData, modifiedBy, communicationCategory }) => {
  const persons = members.map(member => member.personId);
  const isSelfServiceAppointment = selfServiceAppointmentCheck(appointmentData.metadata);
  const messageEntity = {
    message,
    unread: false,
    type: DALTypes.CommunicationMessageType.SMS,
    parties: [appointmentData.partyId],
    direction: DALTypes.CommunicationDirection.OUT,
    persons,
    status: {
      status: [{ address: message.to, status: DALTypes.CommunicationStatus.PENDING }],
    },
    category: communicationCategory || DALTypes.CommunicationCategory.USER_COMMUNICATION,
  };
  if (!isSelfServiceAppointment) messageEntity.userId = modifiedBy.id;

  const res = await addNewCommunication(ctx, messageEntity);

  const smsData = await getFormattedSmsData(ctx, {
    message,
    tenantName: ctx.tenantName,
    partyId: appointmentData.partyId,
    entityId: res.id,
    userId: res.userId,
  });
  return {
    smsData,
    communication: res,
  };
};

const getAppointmentSmsTemplate = async (ctx, appointmentData, type) => {
  if (type === 'cancel') return await getAppointmentCancelledSmsTemplateData(ctx, appointmentData);
  if (type === 'update') return await getAppointmentUpdatedSmsTemplateData(ctx, appointmentData);
  return await getAppointmentConfirmedSmsTemplateData(ctx, appointmentData);
};

export const sendAppointmentSms = async (ctx, { phones, members, appointmentData, type, modifiedBy, communicationCategory }) => {
  const templateData = await getAppointmentSmsTemplate(ctx, appointmentData, type);
  const message = await getAppointmentMessage(phones, templateData);
  const notificationMessage = getSMSNotificationMessage(type, communicationCategory);
  const { smsData, communication } = await getSmsData(ctx, { message, members, appointmentData, modifiedBy, communicationCategory });

  const result = await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_SMS,
    message: { ...smsData, notificationMessage },
    ctx,
  });

  await notifyCommunicationUpdate(ctx, communication);

  return result;
};
