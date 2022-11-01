/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { getProperty } from '../dal/propertyRepo';
import { getOutProgramByTeamAndProperty } from '../dal/programsRepo';
import { getTeamCalendarSlots } from './calendar';
import { toMoment, now, DATE_ISO_FORMAT, parseAsInTimezone } from '../../common/helpers/moment-utils';
import config from '../config';
import loggerModule from '../../common/helpers/logger';
import { formatPhoneNumberForDb, isValidPhoneNumber } from '../helpers/phoneUtils';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { isEmailValid } from '../../common/helpers/validations/email';
import { getNewFromEmailAddress } from '../../common/helpers/utils';
import { outboundEmailFromForwardingCommunication } from '../workers/communication/emailHandlers';
import { saveForwardedCommunications } from '../dal/forwardedCommunicationsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { getPartyUrl } from '../helpers/party';
import { sendUrltoShortener } from './urlShortener';
import { convertToMomentFromDateOnlyOrISOFormat } from './helpers/calendarHelpers';

const logger = loggerModule.child({ subtype: 'services/selfBookingService' });

// eg.
// input:
// [{ startDate: '2018-08-14T07:00:00.000Z',
//     endDate: '2018-08-16T07:00:00.000Z',
//     availableAgents: [],
//     isAllDay: true,
//     isTeam: true } ]
// output:
// [{ startDate: '2018-08-14T07:00:00.000Z',
//     endDate: '2018-08-15T07:00:00.000Z',
//     availableAgents: [],
//     isAllDay: true,
//     isTeam: true },
//  { startDate: '2018-08-15T07:00:00.000Z',
//     endDate: '2018-08-16T07:00:00.000Z',
//     availableAgents: [],
//     isAllDay: true,
//     isTeam: true }  ]
const splitMultipleDayEventInMultipleSingleDayEvents = (teamEvents, timezone) =>
  teamEvents.reduce((acc, event) => {
    const { startDate, endDate, isAllDay } = event;

    if (!isAllDay) return [...acc, event];

    const start = toMoment(startDate, { timezone });
    const end = toMoment(endDate, { timezone });
    const eventDays = end.diff(start, 'days');

    const allDayEvents = [...Array(eventDays).keys()].map(dayNo => ({
      ...event,
      startDate: start.clone().add(dayNo, 'days').toISOString(),
      endDate: start
        .clone()
        .add(dayNo + 1, 'days')
        .toISOString(),
    }));
    return [...acc, ...allDayEvents];
  }, []);

const createSlots = (acc, { currentTeamSlot, timezone, fromDate, toDate }) => {
  const { startDate, isTeam, isAllDay, availableAgents } = currentTeamSlot;
  const slotStartDateMoment = toMoment(startDate, { timezone });

  const slotDate = slotStartDateMoment.toISOString();
  const day = slotStartDateMoment.format(DATE_ISO_FORMAT);
  const officeClosed = isTeam && isAllDay;
  const isSlotBeforeFromDate = slotStartDateMoment.isBefore(fromDate);

  const isSlotAfterToDate = slotStartDateMoment.isSameOrAfter(toDate);

  if (isSlotAfterToDate) return acc;

  const calendarDayDefault = {
    day,
    officeClosed,
    slots: officeClosed || !availableAgents.length || isSlotBeforeFromDate ? [] : [slotDate],
  };

  if (officeClosed) {
    acc.set(day, calendarDayDefault);
    return acc;
  }

  const calendarDay = acc.get(day);

  if (!calendarDay) {
    acc.set(day, calendarDayDefault);
    return acc;
  }

  if (availableAgents.length && !isSlotBeforeFromDate) {
    calendarDay.slots.push(slotDate);
  }

  return acc;
};

const getStartAndEndDates = ({ from, timezone, numberOfDays }) => {
  const { webInquiryFirstAvailableSlotOffset } = config.calendar;
  const fromMoment = convertToMomentFromDateOnlyOrISOFormat(from, { timezone });

  let startDate;

  const nowMoment = now({ timezone }).add(webInquiryFirstAvailableSlotOffset, 'minutes');
  if (fromMoment.isBefore(nowMoment)) {
    startDate = nowMoment;
  } else {
    startDate = fromMoment;
  }

  const endDate = startDate.clone().add(numberOfDays, 'days');

  return { startDate: startDate.clone(), endDate };
};

export const getSelfServiceAvailableSlots = async (ctx, { from, numberOfDays, program }) => {
  const { onSiteLeasingTeamId: teamId, propertyId } = program;
  const { timezone, settings } = await getProperty(ctx, propertyId);

  const slotDuration = (settings.calendar && settings.calendar.teamSlotDuration) || config.calendar.defaultTeamSlotDuration;

  const { startDate, endDate } = getStartAndEndDates({ from, timezone, numberOfDays });

  const teamCalendarSlots = await getTeamCalendarSlots(ctx, { teamId, date: startDate, numberOfDays, slotDuration, timezone });

  const enhancedTeamCalendarSlots = splitMultipleDayEventInMultipleSingleDayEvents(teamCalendarSlots, timezone);

  const calendarMap = enhancedTeamCalendarSlots.reduce(
    (acc, currentTeamSlot) => createSlots(acc, { currentTeamSlot, timezone, fromDate: startDate, toDate: endDate }),
    new Map(),
  );

  const sortByDate = (entry1, entry2) => {
    const firstDate = parseAsInTimezone(entry1.day, { timezone });
    const secondDate = parseAsInTimezone(entry2.day, { timezone });

    return firstDate.isBefore(secondDate) ? -1 : 1;
  };

  const calendar = Array.from(calendarMap.values()).sort(sortByDate);
  const calendarLog = calendar.map(d => ({ day: d.day, numberOfAvailableSlots: d.slots.length, officeClosed: d.officeClosed }));

  logger.trace({ ctx, calendarLog }, 'getSelfServiceAvailableSlots - result');

  return { propertyTimezone: timezone, calendar };
};

export const getAppointmentForSelfService = async (ctx, appointment) => {
  logger.trace({ ctx, appointment }, 'getAppointmentForSelfService - params');

  const { propertyTimeZone, metadata, state } = appointment;
  const { selectedPropertyId: propertyId, teamId } = metadata;
  const { directEmailIdentifier: programEmail } = await getOutProgramByTeamAndProperty(ctx, teamId, propertyId);

  return { programEmail, propertyTimeZone, startDate: metadata.startDate, endDate: metadata.endDate, state };
};

export const getGuestContactInfo = (phone, email) => {
  const formatedPhone = formatPhoneNumberForDb(phone);
  return enhance([
    ...((phone && isValidPhoneNumber(phone) && formatedPhone && [{ type: 'phone', value: formatedPhone }]) || []),
    ...((email && isEmailValid(email) && [{ type: 'email', value: email.toLowerCase().trim() }]) || []),
  ]);
};

export const getGuestDefaultContactInfo = contactInfo => contactInfo.defaultEmail || contactInfo.defaultPhone;

export const getWebInquiryContactInfos = contactInfo => ({ defaultEmail: contactInfo.defaultEmail, defaultPhone: contactInfo.defaultPhone });

const getWebInquiryForwardCommunicationType = data => {
  const { requestQuote, requestApplication, requestAppointment } = data;
  if (requestQuote) {
    return 'quote';
  }
  if (requestApplication) {
    return 'application';
  }
  if (requestAppointment) {
    return 'appointment';
  }
  return '';
};

const constructMessageDataWebInquiryForwarding = async (ctx, inquiry, program) => {
  const message = {
    subject: t('FORWARDED_FROM_REVA_SUBJECT'),
    fromName: inquiry.name,
    to: program.metadata.commsForwardingData.forwardEmailToExternalTarget,
    rawMessage: { ...inquiry, replyTo: inquiry.email },
    replyTo: inquiry.email,
    from: getNewFromEmailAddress(ctx, inquiry.name, config),
    messageId: program.directEmailIdentifier,
  };

  if (inquiry.partyId) {
    const type = getWebInquiryForwardCommunicationType(inquiry);
    const partyUrl = await getPartyUrl(ctx, inquiry.partyId);
    const shortenedUrl = (await sendUrltoShortener(ctx, [partyUrl]))[0];
    message.text = t('FORWARD_WEB_INQUIRY_TEMPLATE', {
      email: message.replyTo,
      name: message.fromName,
      text: inquiry.message,
      moveInDate: t(inquiry.moveInTime || inquiry.qualificationQuestions?.moveInTime),
      phone: inquiry.phone,
      type,
      partyUrl: shortenedUrl,
    });
  } else {
    message.text = t('FORWARD_CONTACT_US_TEMPLATE', {
      email: message.replyTo,
      name: message.fromName,
      text: inquiry.message,
      moveInDate: t(inquiry.moveInTime),
      phone: inquiry.phone,
    });
  }

  return message;
};

export const handleWebInquiryForwarding = async (ctx, data, program) => {
  logger.trace({ ctx, data, program }, 'handleWebInquiryForwarding');
  const message = await constructMessageDataWebInquiryForwarding(ctx, data, program);

  const { processed, result } = await outboundEmailFromForwardingCommunication(ctx, message);

  if (!processed) return false;

  const forwardedCommunication = {
    type: DALTypes.CommunicationMessageType.WEB,
    messageId: result.MessageId,
    programId: program.id,
    programContactData: program.directEmailIdentifier,
    message,
    forwardedTo: program.metadata.commsForwardingData.forwardEmailToExternalTarget,
    receivedFrom: message.replyTo,
  };
  await saveForwardedCommunications(ctx, forwardedCommunication);

  return true;
};
