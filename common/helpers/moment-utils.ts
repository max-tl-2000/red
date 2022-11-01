/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import moment, { Moment } from 'moment-timezone'; // eslint-disable-line red/no-moment
import * as baseMoment from 'moment'; // eslint-disable-line red/no-moment
import { extendMoment } from 'moment-range';
import nullish from './nullish';
import { isString } from './type-of';
import { isNode } from './globals';

export type MomentType = Moment | string | Date;

interface IIsSameDayOptions {
  timezone?: string;
}

interface ILogWarningsArgs {
  msg?: any[];
}

interface IToMomentArgs {
  parseFormat?: string;
  timezone?: string;
  strict?: boolean;
}

interface IFormatMomentArgs {
  format?: string;
  timezone?: string;
  includeZone?: boolean;
  includeZoneStrict?: boolean;
}

interface INowArgs {
  timezone?: string;
}

interface IParseASInTimezoneArgs {
  format?: string;
  timezone?: string;
}

const runningInNode = isNode();

const momentFn = moment;
const { duration, max: momentMax, now: momentNow } = momentFn;

export const DATE_ISO_FORMAT = 'YYYY-MM-DD';

// this format is not correct the UTC formats with `Z` don't include +z
export const DATE_TIME_ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ss+z';

export const findLocalTimezone = (): string => momentFn.tz.guess();
export const isValidTimezone = (tz: string): boolean => !!momentFn.tz.zone(tz);

let momentUtilsFixedNow;

const logWarnings = ({ msg = [] }: ILogWarningsArgs = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction || !msg || msg.length === 0) {
    return;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  console.warn(...msg);

  if (isDevelopment && runningInNode) {
    const err = new Error();
    const LINES_TO_SKIP = 2;
    // we remove the 2 first lines which are meaningless for us
    // and also the lines that contains stack info from teh asyncGenerator babel transform
    const stackWithMeaningFulInfo = (err.stack || '')
      .split(/\n/)
      .slice(LINES_TO_SKIP)
      .filter(line => !line.match(/asyncToGenerator\.js/))
      .join('\n');

    console.warn(stackWithMeaningFulInfo);
  }
};

const checkIfDateIsISO = (date: MomentType): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction || !isString(date)) {
    return;
  }

  date = date as string; // cast needed to make typescript happy

  const ISO_8601_REGEX_FULL = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i;
  const ISO_8601_REGEX_PERMISSIVE = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i;

  if (date.match(ISO_8601_REGEX_FULL)) {
    return;
  }

  if (date.match(ISO_8601_REGEX_PERMISSIVE)) {
    // if it matches the permissive then we just inform it failed the full ISO validation
    logWarnings({ msg: ['>> `date` parameter is not in full ISO format', date] });
    return;
  }

  logWarnings({ msg: ['>> date parameter is not in any ISO format', date] });
};

export const toMoment = (date: MomentType, { parseFormat, timezone, strict = true }: IToMomentArgs = { strict: true }): Moment => {
  if (nullish(date) || date === '') {
    logWarnings({
      msg: ['>> date parameter is nullish or empty', date, '\n', '>> this will produce an invalid moment that will be formatted as empty string'],
    });

    const m = momentFn(null!);
    m.format = () => '';
    return m; // just return an invalid moment object
  }

  if (parseFormat !== undefined && typeof parseFormat !== 'string') {
    throw new TypeError('`parseFormat` must be a string');
  }

  checkIfDateIsISO(date);

  if (timezone !== undefined && !isString(timezone)) {
    throw new TypeError('timezone must be a string');
  }

  let dateAsMoment = parseFormat ? momentFn(date, parseFormat, strict) : momentFn(date);

  if (timezone) {
    dateAsMoment = dateAsMoment.tz(timezone);
  }

  return dateAsMoment;
};

export const formatMoment = (
  momentObj: Moment,
  { format, timezone, includeZone = true, includeZoneStrict = false }: IFormatMomentArgs = { includeZone: true, includeZoneStrict: false },
): string => {
  if (!timezone) {
    logWarnings({ msg: ['[formatMoment] called without timezone', momentObj] });
  }

  const m = momentObj ? toMoment(momentObj, { timezone }) : undefined;

  if (!m || !m.isValid()) {
    logWarnings({ msg: ['[formatMoment] attempt to format an invalid moment', momentObj] });
    return '';
  }

  const useAbbr = timezone && includeZone && timezone !== findLocalTimezone();

  const zone = useAbbr || includeZoneStrict ? ` ${m.zoneAbbr()}` : '';
  return `${m.format(format)}${zone}`;
};

export const now = ({ timezone = findLocalTimezone() }: INowArgs = { timezone: findLocalTimezone() }) => {
  if (momentUtilsFixedNow) {
    return momentUtilsFixedNow;
  }

  if (timezone !== undefined && typeof timezone !== 'string') {
    throw new TypeError('timezone must be a string');
  }

  let m = momentFn();
  if (timezone) {
    m = m.tz(timezone);
  }
  return m;
};

export const useFixedDateTimeForMomentUtilsNow = dateTime => {
  momentUtilsFixedNow = dateTime;

  return () => {
    momentUtilsFixedNow = undefined;
  };
};

export const parseAsInTimezone = (str: string, { format, timezone }: IParseASInTimezoneArgs = {}): Moment => {
  const args = [str];

  if (format) {
    args.push(format);
  }

  if (timezone) {
    args.push(timezone);
  } else {
    logWarnings({ msg: ['[parseAsInTimezone] error: missing `timezone`. In future versions this will throw an error'] });
  }

  // @ts-ignore: spread will work just fine in this case
  return momentFn.tz(...args);
};

export const isMoment = (m: any): boolean => momentFn.isMoment(m);

export const isSameDay = (date1, date2, { timezone }: IIsSameDayOptions = {}): boolean => {
  if (!timezone) {
    logWarnings({ msg: ['[isSameDay] called without timezone'] });
  }

  date1 = toMoment(date1, { timezone });
  date2 = toMoment(date2, { timezone });

  return !date1.isValid() || !date2.isValid() ? false : date1.isSame(date2, 'day');
};

export const isValidMoment = (m: any): boolean => m && isMoment(m) && m.isValid();

export const setDefaultTZ = (tz: string) => momentFn.tz.setDefault(tz);

export const getDurationBetweenMoments = (startDate: MomentType, endDate: MomentType): string => {
  const millisecondDifference = toMoment(endDate).diff(startDate);
  return moment.utc(millisecondDifference).format('mm:ss');
};

export const rangeMoment = extendMoment(baseMoment);

export const getTimezoneNames = (): Array<string> => momentFn.tz.names();

export const stringRepresentsADateWithoutTime = date => {
  if (typeof date !== 'string') {
    return false;
  }
  const POSIBLE_DATE = /^\d{4}-\d{1,2}-\d{1,2}$/g;
  return !!date.match(POSIBLE_DATE);
};

export const isWithinLastNDays = ({ date, days, timezone }) => toMoment(date, { timezone }).isSameOrAfter(now().add(days, 'days'), 'day');

export { duration, momentMax, momentNow };

export const today = ({ timezone = findLocalTimezone() }: INowArgs = { timezone: findLocalTimezone() }) =>
  now({ timezone }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
