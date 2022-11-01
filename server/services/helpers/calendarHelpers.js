/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment, parseAsInTimezone, DATE_ISO_FORMAT, stringRepresentsADateWithoutTime } from '../../../common/helpers/moment-utils';
import loggerModule from '../../../common/helpers/logger';
import { getPropertyById } from '../properties';
import { formatSimpleAddress } from '../../../common/helpers/addressUtils';

const logger = loggerModule.child({ subType: 'calendarHelpers' });

export const NUMBER_OF_DAYS_SYNC = 60;
export const NUMBER_OF_PAST_DAYS_SYNC = 30;
export const TIMEZONE_SYNC = 'Etc/UTC';

const momentsHaveSameTime = ({ startMoment, endMoment, timezone }) => {
  const start = toMoment(startMoment, { timezone });
  const end = toMoment(endMoment, { timezone });

  return end.format('HH:mm:ss') === start.format('HH:mm:ss');
};

export const convertToMomentFromDateOnlyOrISOFormat = (date, { timezone }) => {
  if (stringRepresentsADateWithoutTime(date)) {
    return parseAsInTimezone(date, { timezone });
  }

  return toMoment(date, { timezone });
};

// format received from Cronofy for full-day event:
// {
//   "calendar_id": "cal_U9uuErStTG@EAAAB_IsAsykA2DBTWqQTf-f0kJw",
//   "start": "2019-01-28",
//   "end": "2014-01-29",
//   "free_busy_status": "busy",
//   "event_uid": "evt_external_5c40e8fdd646c74f367684d5",
// },
//
// format received from Cronofy for an event which is not full-day:
// {
//   "calendar_id": "cal_U9uuErStTG@EAAAB_IsAsykA2DBTWqQTf-f0kJw",
//   "start": "2019-01-28T08:00:00Z",
//   "end": "2019-01-28T08:30:00Z",
//   "free_busy_status": "busy",
//   "event_uid": "evt_external_5c40e8fdd646c74f367684d5",
// },
export const isAllDayEvent = (event, timezone) => {
  const start = event.start || event.startDate;
  const end = event.end || event.endDate;

  if (start === end) return false;

  const startMoment = convertToMomentFromDateOnlyOrISOFormat(start, { timezone });
  const endMoment = convertToMomentFromDateOnlyOrISOFormat(end, { timezone });

  if (!momentsHaveSameTime({ startMoment, endMoment, timezone })) return false;

  return true;
};

export const adjustDatesToTimezoneForCronofyEvent = (ctx, event, timezone) => {
  const { start, end } = event;

  const isAllDay = isAllDayEvent(event, timezone);
  if (!isAllDay) return event;

  logger.trace({ ctx, cronofyEvent: event, timezone }, 'adjust event dates to timezone - input');
  const startDateTime = parseAsInTimezone(start, { timezone, format: DATE_ISO_FORMAT });
  const endDateTime = parseAsInTimezone(end, { timezone, format: DATE_ISO_FORMAT });
  const fixedEvent = {
    ...event,
    start: startDateTime.toISOString(),
    end: endDateTime.toISOString(),
  };
  logger.trace({ ctx, cronofyEvent: event, fixedEvent }, 'adjust event dates to timezone - output');
  return fixedEvent;
};

export const getDateRangeForSync = (startDate, numberOfDays) => {
  const dateMoment = toMoment(startDate, { parseFormat: DATE_ISO_FORMAT, timezone: TIMEZONE_SYNC, strict: false });
  const from = dateMoment.format();
  const to = dateMoment.add(numberOfDays, 'day').format();

  return { from, to };
};

export const getAppointmentAddress = async (ctx, appointment) => {
  logger.trace({ ctx, appointment }, 'getAppointmentAddress - params');

  if (!appointment.metadata || !appointment.metadata.selectedPropertyId) return '';

  const property = await getPropertyById(ctx, appointment.metadata.selectedPropertyId);

  return property.leasingOfficeAddress || formatSimpleAddress(property.address);
};
