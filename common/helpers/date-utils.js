/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DATE_ONLY_FORMAT, SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../date-constants';
import { toMoment, now, findLocalTimezone } from './moment-utils';

export const getPercentageOfDayElapsed = (date, timezone) => {
  const theMoment = toMoment(date, { timezone });
  const theMidnight = theMoment.clone().startOf('day');
  const minutes = theMoment.diff(theMidnight, 'minutes');

  return (minutes * 100) / 24 / 60;
};

export const isDateInThePast = (date, { timezone, timeUnit = 'day' }) => now({ timezone }).isAfter(toMoment(date, { timezone }), timeUnit);
export const isDateInTheFuture = (date, { timezone, timeUnit = 'day' }) => toMoment(date, { timezone }).isAfter(now({ timezone }), timeUnit);

export function formatTimestamp(date, { timezone = findLocalTimezone() }) {
  let displayFormat = 'EMAIL_CARD_TIMESTAMP_DEFAULT';
  const commMoment = toMoment(date, { timezone });

  const today = now({ timezone });

  const systemTz = findLocalTimezone();

  const isSameDayInSystemTz = () => now({ timezone: findLocalTimezone() }).format(DATE_ONLY_FORMAT) === commMoment.format(DATE_ONLY_FORMAT);

  if (!today.isSame(commMoment, 'year')) {
    displayFormat = 'EMAIL_CARD_TIMESTAMP_WITH_YEAR';
  } else if (today.isSame(commMoment, 'day') && isSameDayInSystemTz()) {
    displayFormat = 'EMAIL_CARD_TIMESTAMP_FOR_TODAY';
  }

  let d = commMoment.format(t(displayFormat));

  if (systemTz !== timezone) {
    d = `${d} ${commMoment.zoneAbbr()}`;
  }

  return d;
}

export function formatDay(date, timezone) {
  const commMoment = toMoment(date, { timezone });

  const yesterday = now({ timezone }).subtract(1, 'day');
  if (yesterday.isSame(commMoment, 'day')) {
    return t('EMAIL_CARD_DATE_YESTERDAY');
  }

  const today = now({ timezone });
  if (today.isSame(commMoment, 'day')) {
    return t('EMAIL_CARD_DATE_TODAY');
  }

  const dateFormat = today.isSame(commMoment, 'year') ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
  return commMoment.format(dateFormat);
}

/**
 * Validate if a specific date is betweem two dates, this validation
 * will compare using the same offset for of them.
 * using this approach it possible to validate a concessions in a property from Los Angeles
 *   current time in Los Angeles 2017-08-31T23:59:59.000-07:00
 *   last day to get the concession 2017-08-31T00:00:00.000Z (from database)
 *   it will convert to 2017-08-31T23:59:59.999-07:00
 *   now we can be sure the property current time(2017-08-31T23:59:59.000-07:00) is before than
 *   (2017-08-31T23:59:59.999-07:00)
 * to get more details please check
 * common/helpers/__tests__/date-utils-test.js
 * @method dateInBetween
 * @param {string} start - Start date with format 2017-08-20T00:00:00.000Z
 * @param {string} end - End Date with format 2017-08-31T00:00:00.000Z
 * @param {string} date - Date to compare with timezone, format 2017-08-20T00:00:00-07:00
 * @param {boolean} inclusive - takes the start and end date in the date range, by default true
 * @return {boolean} result
 */
export const dateInBetween = (startDate, endDate, date, inclusive = true, timezone = undefined) => {
  if (!date) throw new TypeError('Date is required');

  date = toMoment(date, { timezone });
  endDate = endDate ? toMoment(endDate, { timezone }) : null;
  startDate = startDate ? toMoment(startDate, { timezone }) : null;

  const inclusiveStr = inclusive ? '[]' : '()';
  return date.isBetween(startDate, endDate, 'second', inclusiveStr);
};

export const formatDateAgo = (date, timezone) => {
  const today = now({ timezone }).startOf('day');
  const dateMoment = toMoment(date, { timezone }).startOf('day');

  if (dateMoment.isSame(today, 'day')) return t('DATETIME_TODAY');

  const daysDifference = today.diff(dateMoment, 'days');
  if (daysDifference === 1) return t('DATETIME_YESTERDAY');
  if (daysDifference < 6) {
    return t('DATETIME_DAYS_AGO', { days: daysDifference });
  }

  return `${t('ON')} ${formatDay(dateMoment, timezone)}`;
};

// This function rounds up or down to the closest 30 min, it returns the minutes to add to the currentDateTime
export const getClosestThirtyMinutesDelta = currentDateTime => {
  const currentMinutes = currentDateTime.minutes();
  const thirtyMinutes = 30;
  const differenceToThirtyMinutes = currentMinutes > thirtyMinutes ? currentMinutes - thirtyMinutes : currentMinutes;
  if (differenceToThirtyMinutes >= 15) {
    return thirtyMinutes - differenceToThirtyMinutes;
  }

  return -differenceToThirtyMinutes;
};

export const roundDateToThirtyMinutes = (currentDate, timezone) => {
  const date = toMoment(currentDate, { timezone });
  return date.minute() >= 30 ? date.startOf('hour').add(30, 'm') : date.startOf('hour');
};

export const roundDateUpToThirtyMinutes = (currentDate, timezone) => {
  const date = toMoment(currentDate, { timezone });
  const startOfHour = date.clone().startOf('hour');
  if (date.minute() === 0) return startOfHour;
  return date.minute() > 30 ? startOfHour.add(1, 'h') : startOfHour.add(30, 'm');
};

const dayPastMinutes = (currentDate, timezone) => {
  const date = toMoment(currentDate, { timezone });
  const startOfDay = date.clone().startOf('day');
  return date.diff(startOfDay, 'minutes');
};

export const roundDateUpForCalendarSlot = (currentDate, slotDuration, timezone) => {
  const date = toMoment(currentDate, { timezone });
  const minutesFromStartOfDay = dayPastMinutes(currentDate, timezone);
  const numberOfSlots = Math.ceil(minutesFromStartOfDay / slotDuration);
  return date.startOf('day').add(numberOfSlots * slotDuration, 'minutes');
};

export const roundDateDownForCalendarSlot = (currentDate, slotDuration, timezone) => {
  const date = toMoment(currentDate, { timezone });
  const minutesFromStartOfDay = dayPastMinutes(currentDate, timezone);
  const numberOfSlots = Math.floor(minutesFromStartOfDay / slotDuration);
  return date.startOf('day').add(numberOfSlots * slotDuration, 'minutes');
};

export const isDateAfterDate = (date1, date2, timeUnit = 'day') => toMoment(date1).isAfter(toMoment(date2), timeUnit);

export const isDateBeforeDate = (date1, date2, timeUnit = 'day') => toMoment(date1).isBefore(toMoment(date2), timeUnit);

export const getPastFormattedDateFromDelta = (delta = 0, timeFrame = 'hours', date = new Date()) =>
  toMoment(date).subtract(Math.abs(delta), timeFrame).format();

export const hasCorrectFormat = (date, format) => toMoment(date, { parseFormat: format }).isValid();

export const isDateInTheCurrentYear = (date, timezone) => toMoment(date, { timezone }).isSame(now({ timezone }), 'year');

export const isMomentInInterval = (date, startDate, endDate) => toMoment(startDate).isSameOrBefore(date) && date.isSameOrBefore(toMoment(endDate));

export const isExpiredDate = (date, timezone, expirationDays) => now().diff(toMoment(date, { timezone }), 'days') > expirationDays;
