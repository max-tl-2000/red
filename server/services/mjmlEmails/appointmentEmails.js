/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import { mapSeries } from 'bluebird';
import { loadPartyMemberByIds, getTimezoneForParty } from '../../dal/partyRepo';
import { getPersonsByIds } from '../../dal/personRepo';
import { getPropertyById } from '../../dal/propertyRepo';
import { getUserFullNameById, getUserById } from '../../dal/usersRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { shouldSendCalendarEmails } from '../teams';
import { assert } from '../../../common/assert';
import logger from '../../../common/helpers/logger';
import { isSelfServiceAppointment as selfServiceAppointmentCheck } from '../../../common/helpers/tasks.js';
import { CommunicationContext } from '../../../common/enums/communicationTypes';
import { sendCommunication as sendCommunicationFunc } from '../communication';
import { generateIcsSmartInvite, isCalendarIntegrationEnabled } from '../externalCalendars/cronofyService';
import { getAppointmentAddress } from '../helpers/calendarHelpers';
import { getTenant } from '../tenantService';

let sendCommunication;
const getSendCommunicationFunc = () => {
  if (!sendCommunication) {
    sendCommunication = sendCommunicationFunc;
  }
  return sendCommunication;
};

const getInvitationData = async (ctx, appointment, personIds, type) => {
  const { displayName } = await getPropertyById(ctx, appointment.metadata.selectedPropertyId);
  const persons = await getPersonsByIds(ctx, personIds);

  return {
    appointment,
    propertyAddress: await getAppointmentAddress(ctx, appointment),
    partyTimeZone: await getTimezoneForParty(ctx, appointment.partyId),
    summary: `Property tour on ${displayName}`,
    organizer: await getUserFullNameById(ctx, appointment.userIds[0]),
    recipientsEmails: persons.map(person => person.contactInfo.defaultEmail),
    type,
  };
};

const createIcsAttachments = async (ctx, appointment, personIds, type) => {
  try {
    const invitationData = await getInvitationData(ctx, appointment, personIds, type);
    const icsContent = await generateIcsSmartInvite(ctx, invitationData);

    return [
      {
        originalName: 'invite.ics',
        additional: {
          contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
          content: icsContent,
          contentDisposition: 'inline',
          encoding: 'ascii',
        },
      },
      {
        originalName: 'invite.ics',
        additional: {
          contentType: 'application/ics; charset=UTF-8; method=REQUEST',
          content: Buffer.from(icsContent).toString('base64'),
          encoding: 'base64',
        },
      },
    ];
  } catch (error) {
    logger.error({ ctx, error, appointmentId: appointment.id }, 'unable to generate ics file');
    return [];
  }
};

export const setSendCommunicationFunc = func => {
  sendCommunication = func;
};
export const resetSendCommunicationFunc = () => {
  sendCommunication = sendCommunicationFunc;
};

const shouldAttachIcsFiles = async (ctx, tenantSettings) => {
  const {
    features: { enableIcsAttachment = false },
  } = tenantSettings;

  return enableIcsAttachment && (await isCalendarIntegrationEnabled(ctx));
};

const sendAppointmentEmails = async (ctx, { tenantSettings, personIds, propertyTemplate, appointmentData, isSelfServiceAppt, type }) => {
  const { id: appointmentId, partyId } = appointmentData;
  const icsAttachments = (await shouldAttachIcsFiles(ctx, tenantSettings)) ? await createIcsAttachments(ctx, appointmentData, personIds, type) : [];
  const sendMail = getSendCommunicationFunc();

  return await mapSeries(personIds, async personId => {
    await sendMail(ctx, {
      propertyTemplate,
      partyId,
      personIds: [personId],
      attachments: icsAttachments,
      context: CommunicationContext.PREFER_EMAIL_AND_SMS,
      templateArgs: { appointmentId },
      communicationCategory: DALTypes.CommunicationCategory.APPOINTMENT,
      messageType: type,
      shouldNotNotifyMailSent: !!isSelfServiceAppt,
    });
  });
};

export const sendAppointmentCommunication = async (ctx, { appointmentData, propertyTemplate, type, modifiedBy }) => {
  const isSelfServiceAppt = selfServiceAppointmentCheck(appointmentData.metadata);
  assert(modifiedBy || isSelfServiceAppt, 'sendAppointmentCommunication without an authUser');
  const { metadata, partyMembers } = appointmentData;

  let recipients = partyMembers;
  if (!recipients) {
    recipients = await loadPartyMemberByIds(ctx, appointmentData.metadata.partyMembers);
  }
  const sendCalendarEmails = await shouldSendCalendarEmails(ctx, metadata.teamId);
  if (!recipients.length || !sendCalendarEmails) {
    const logMessage = `Calendar emails do not need to be sent for appointment:
      ${appointmentData.id}. Recipients: ${recipients}, sendCalendarCommsFlag: ${sendCalendarEmails}`;
    logger.trace({ ctx }, logMessage);
    return true;
  }

  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);

  const sender = modifiedBy || (await getUserById(ctx, appointmentData.userIds[0]));
  const extendedCtx = { ...ctx, tenantName, tenantSettings, sender };

  const personIds = uniq(recipients.map(({ personId }) => personId));

  logger.trace({ ctx, personIds }, 'sendAppointmentCommunication - personIds');
  return await sendAppointmentEmails(extendedCtx, { tenantSettings, personIds, propertyTemplate, appointmentData, isSelfServiceAppt, type });
};
