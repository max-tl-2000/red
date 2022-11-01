/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';
import { getKeyByValue } from '../../../common/enums/enumHelper';
import { TemplateActions, TemplateSections } from '../../../common/enums/templateTypes';
import { filterMembersWithEmail, filterMembersWithPhoneNo } from '../../services/appointments';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import * as appSettings from '../../services/appSettings';
import { getPropertySettings } from '../../dal/propertyRepo';

const getPartyMembersForAppointment = (party, appointment) =>
  party.members.filter(member => appointment && appointment.metadata.partyMembers.includes(member.partyMember.id) && member.contactInfo);

const getAddedPartyMembers = (partyMembers, appointmentEvent) =>
  partyMembers.filter(pm => appointmentEvent.metadata.addedMembers && appointmentEvent.metadata.addedMembers.includes(pm.partyMember.id));

const isAtLeastTwoHoursInTheFuture = startDate => now().add(120, 'minutes').isBefore(startDate);

const isVirtualTourAndIsOnTime = appointment => {
  const { startDate, tourType } = appointment?.metadata || {};

  const isOnTime = now().isBefore(startDate);
  const isVirtualTour = tourType === DALTypes.TourTypes.VIRTUAL_TOUR;

  return isOnTime && isVirtualTour;
};

const shouldSendCommBasedOnCurrentTime = appointment => isAtLeastTwoHoursInTheFuture(appointment.metadata.startDate) || isVirtualTourAndIsOnTime(appointment);

const shouldSendComm = async (ctx, appointment, value) => {
  const sendAppointmentCreatedComm = await appSettings.getAppSettingValue(ctx, value);

  if (sendAppointmentCreatedComm !== 'true') {
    logger.trace({ ctx }, `${value} disabled from AppSettings`);
    return false;
  }
  return shouldSendCommBasedOnCurrentTime(appointment);
};

const getEmailAddresses = partyMembers => {
  const appointmentPartyMembers = partyMembers.map(member => ({
    ...member,
    contactInfo: enhance(member.contactInfo),
  }));

  return filterMembersWithEmail(appointmentPartyMembers).map(member => member.contactInfo.defaultEmail);
};

const getEmailAddressesOfAddedMembers = (partyMembers, appointmentEvent) => {
  const addedPartyMembers = getAddedPartyMembers(partyMembers, appointmentEvent);
  return getEmailAddresses(addedPartyMembers);
};

const getPhoneNumbers = partyMembers => {
  const appointmentPartyMembers = partyMembers.map(member => ({
    ...member,
    contactInfo: enhance(member.contactInfo),
  }));

  return filterMembersWithPhoneNo(appointmentPartyMembers).map(member => member.contactInfo.defaultPhone);
};

const getPhoneNumbersOfAddedMembers = (partyMembers, appointmentEvent) => {
  const addedPartyMembers = getAddedPartyMembers(partyMembers, appointmentEvent);
  return getPhoneNumbers(addedPartyMembers);
};

const membersToSendEmailTo = async (ctx, party, appointment, appointmentEvent) => {
  let membersToSendEmailConfirmation;
  let membersToSendEmailUpdate;
  let membersToSendEmailCancelation;

  const partyMembers = getPartyMembersForAppointment(party, appointment);
  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_CREATED && (await shouldSendComm(ctx, appointment, 'SendAppointmentCreatedEmail'))) {
    membersToSendEmailConfirmation = getEmailAddresses(partyMembers);
  }

  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_UPDATED && (await shouldSendComm(ctx, appointment, 'SendAppointmentUpdatedEmail'))) {
    membersToSendEmailConfirmation = getEmailAddressesOfAddedMembers(partyMembers, appointmentEvent);

    if (appointmentEvent.metadata.hasAppointmentDateChanged) {
      const existingPartyMembers = partyMembers.filter(pm => !appointmentEvent.metadata.addedMembers.includes(pm.partyMember.id));
      membersToSendEmailUpdate = getEmailAddresses(existingPartyMembers);
    }

    const removedPartyMembers = party.members.filter(pm => appointmentEvent.metadata.removedMembers.includes(pm.partyMember.id));
    membersToSendEmailCancelation = getEmailAddresses(removedPartyMembers);
  }

  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_CANCELED && (await shouldSendComm(ctx, appointment, 'SendAppointmentCanceledEmail'))) {
    if (appointmentEvent.metadata.userHasConfirmedCommSending) {
      membersToSendEmailCancelation = filterMembersWithEmail(appointmentEvent.metadata.removedMembers).map(member => member.contactInfo.defaultEmail);
    }
  }

  return {
    membersToSendEmailConfirmation,
    membersToSendEmailUpdate,
    membersToSendEmailCancelation,
  };
};

const membersToSendSMSTo = async (ctx, party, appointment, appointmentEvent) => {
  let membersToSendSMSConfirmation;
  let membersToSendSMSUpdate;
  let membersToSendSMSCancelation;

  const partyMembers = getPartyMembersForAppointment(party, appointment);

  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_CREATED && (await shouldSendComm(ctx, appointment, 'SendAppointmentCreatedSMS'))) {
    membersToSendSMSConfirmation = getPhoneNumbers(partyMembers);
  }

  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_UPDATED && (await shouldSendComm(ctx, appointment, 'SendAppointmentUpdatedSMS'))) {
    membersToSendSMSConfirmation = getPhoneNumbersOfAddedMembers(partyMembers, appointmentEvent);

    if (appointmentEvent.metadata.hasAppointmentDateChanged) {
      const existingPartyMembers = partyMembers.filter(pm => !appointmentEvent.metadata.addedMembers.includes(pm.partyMember.id));
      membersToSendSMSUpdate = getPhoneNumbers(existingPartyMembers);
    }

    const removedPartyMembers = party.members.filter(pm => appointmentEvent.metadata.removedMembers.includes(pm.partyMember.id));
    membersToSendSMSCancelation = getPhoneNumbers(removedPartyMembers);
  }

  if (appointmentEvent.event === DALTypes.PartyEventType.APPOINTMENT_CANCELED && (await shouldSendComm(ctx, appointment, 'SendAppointmentCanceledSMS'))) {
    if (appointmentEvent.metadata.userHasConfirmedCommSending) {
      membersToSendSMSCancelation = filterMembersWithPhoneNo(appointmentEvent.metadata.removedMembers).map(member => member.contactInfo.defaultPhone);
    }
  }

  return {
    membersToSendSMSConfirmation,
    membersToSendSMSUpdate,
    membersToSendSMSCancelation,
  };
};

const getEmailPropertyTemplatesForAppointments = async (ctx, appointment, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getEmailTemplateForAppointmentEmail');

  const { tourType } = appointment?.metadata || {};
  const section = getKeyByValue(TemplateSections, tourType) || getKeyByValue(TemplateSections, TemplateSections.IN_PERSON_TOUR);

  const { appointment: { enableSelfServiceEdit } = {} } = (await getPropertySettings(ctx, propertyId)) || {};

  const { createdTemplateAction, updatedTemplateAction } = enableSelfServiceEdit
    ? {
        createdTemplateAction: getKeyByValue(TemplateActions, TemplateActions.CREATED_TEMPLATE_WITH_EDIT_LINK),
        updatedTemplateAction: getKeyByValue(TemplateActions, TemplateActions.UPDATED_TEMPLATE_WITH_EDIT_LINK),
      }
    : {
        createdTemplateAction: getKeyByValue(TemplateActions, TemplateActions.CREATED_TEMPLATE),
        updatedTemplateAction: getKeyByValue(TemplateActions, TemplateActions.UPDATED_TEMPLATE),
      };

  const baseProps = { section, propertyId };
  return {
    appointmentCreatedTemplate: { ...baseProps, action: createdTemplateAction },
    appointmentUpdatedTemplate: { ...baseProps, action: updatedTemplateAction },
    appointmentCancelledTemplate: { ...baseProps, action: getKeyByValue(TemplateActions, TemplateActions.CANCELLED_TEMPLATE) },
  };
};

export const processAppointmentEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process appointment');

  const appointmentEvent = party.events.find(ev =>
    [DALTypes.PartyEventType.APPOINTMENT_CREATED, DALTypes.PartyEventType.APPOINTMENT_CANCELED, DALTypes.PartyEventType.APPOINTMENT_UPDATED].includes(ev.event),
  );

  if (!appointmentEvent) return {};

  const appointment = party.tasks && party.tasks.find(task => task.id === appointmentEvent.metadata.appointmentId);
  const { selectedPropertyId } = appointment.metadata;

  const emails = await membersToSendEmailTo(ctx, party, appointment, appointmentEvent);
  const phones = await membersToSendSMSTo(ctx, party, appointment, appointmentEvent);

  const noRecipients = obj => !Object.values(obj).some(e => e && e.length);
  if (noRecipients(emails) && noRecipients(phones)) return {};

  const emailPropertyTemplates = await getEmailPropertyTemplatesForAppointments(ctx, appointment, selectedPropertyId);

  return {
    emailInfo: {
      appointmentId: appointment ? appointment.id : appointmentEvent.metadata.appointmentId,
      type: appointmentEvent.event,
      emails,
      phones,
      emailPropertyTemplates,
    },
  };
};
