/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../common/helpers/logger';
import { now, DATE_ISO_FORMAT, toMoment } from '../../common/helpers/moment-utils';
import * as calendarEventsRepo from '../dal/calendarEventsRepo';
import { getUserById, updateUser } from '../dal/usersRepo';
import { CalendarUserEventType, CalendarTargetType, CalendarPermissionLevel } from '../../common/enums/calendarTypes';
import { SHORT_DATE_FORMAT, DAY_OF_WEEK_FORMAT, TIME_MERIDIEM_FORMAT } from '../../common/date-constants';
import {
  isCalendarIntegrationEnabled,
  createSickLeaveEvent,
  setCalendarPermissionToUnrestricted,
  getUserExternalCalendars,
  removeEventByEventId,
} from './externalCalendars/cronofyService';
import { getOverlappingAppointments } from './calendar';
import { getAppointmentsWithAdditionalDetailsForUser } from '../dal/tasksRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { runInTransaction } from '../database/factory';
import { ServiceError } from '../common/errors';
import { isAllDayEvent } from './helpers/calendarHelpers';

const formatEvents = (events, appointments, timezone) =>
  events.map(event => {
    const startDateMoment = toMoment(event.startDate, { timezone });
    const endDateMoment = toMoment(event.endDate, { timezone });
    const isAllDay = isAllDayEvent(event, timezone);
    const conflictingAppointments = getOverlappingAppointments(appointments, [event], []);
    return {
      id: event.id,
      day: startDateMoment.format(SHORT_DATE_FORMAT),
      dayOfWeek: startDateMoment.format(DAY_OF_WEEK_FORMAT),
      isAllDay,
      startHour: startDateMoment.format(TIME_MERIDIEM_FORMAT),
      startDate: startDateMoment.toISOString(),
      endHour: endDateMoment.format(TIME_MERIDIEM_FORMAT),
      notes: event.metadata.notes,
      conflictEvents: conflictingAppointments,
    };
  });

const splitSickLeaveInIndividualDays = (sickLeave, timezone) => {
  const eventStartDateInUserCreationTz = toMoment(sickLeave.startDate, { timezone });
  const eventEndDateInUserCreationTz = toMoment(sickLeave.endDate, { timezone });

  const startOfFirstDay = eventStartDateInUserCreationTz.clone().startOf('day');
  const beginningOfLastDay = eventEndDateInUserCreationTz.clone().startOf('day');
  const endOfLastDay = eventEndDateInUserCreationTz.isSame(beginningOfLastDay) ? beginningOfLastDay : beginningOfLastDay.clone().add(1, 'days');

  const resultArray = [];
  let startOfDay = startOfFirstDay.clone();
  let endOfDay = startOfFirstDay.clone().add(1, 'days');

  while (endOfDay.isSameOrBefore(endOfLastDay)) {
    const dayStartDate = eventStartDateInUserCreationTz.isAfter(startOfDay) ? eventStartDateInUserCreationTz : startOfDay;
    const dayEndDate = eventEndDateInUserCreationTz.isBefore(endOfDay) ? eventEndDateInUserCreationTz : endOfDay;

    const sickLeaveDay = {
      ...sickLeave,
      startDate: dayStartDate.toISOString(),
      endDate: dayEndDate.toISOString(),
    };
    resultArray.push(sickLeaveDay);
    startOfDay = startOfDay.add(1, 'days');
    endOfDay = endOfDay.add(1, 'days');
  }
  return resultArray;
};

const flatMap = (fct, array) => array.reduce((acc, x) => acc.concat(fct(x)), []);

const constructFormattedEvents = async (ctx, events, userId, timezone) => {
  const sortedEvents = events.slice().sort((a, b) => toMoment(a.startDate).diff(toMoment(b.startDate)));
  const appointmentsForUser = await getAppointmentsWithAdditionalDetailsForUser(ctx, userId, DALTypes.TaskCategories.APPOINTMENT);
  const formattedEvents = formatEvents(sortedEvents, appointmentsForUser, timezone);
  logger.trace({ ctx, formattedEvents }, 'formatted sick leave events');
  return formattedEvents;
};

export const getSickLeavesForUser = async (ctx, userId, timezone) => {
  logger.trace({ ctx, userId, timezone }, 'getSickLeavesForUser');
  const isIntegrationEnabled = await isCalendarIntegrationEnabled(ctx);
  const user = await getUserById(ctx, userId);
  if (!isIntegrationEnabled || !user.externalCalendars.revaCalendarId) return [];

  const startOfDay = now().startOf('day').format(DATE_ISO_FORMAT);

  const events = await calendarEventsRepo.getUserEventsByDateAndType(ctx, userId, startOfDay, CalendarUserEventType.SICK_LEAVE);
  const sickLeavesSplitByDay = flatMap(e => splitSickLeaveInIndividualDays(e, timezone), events);

  const formattedEvents = await constructFormattedEvents(ctx, sickLeavesSplitByDay, userId, timezone);

  return formattedEvents;
};

const updateCalendarPermissions = async (ctx, mainCalendar, user) => {
  if (mainCalendar && mainCalendar.permission_level !== CalendarPermissionLevel.UNRESTRICTED) {
    await setCalendarPermissionToUnrestricted(ctx, mainCalendar, { id: user.id, type: CalendarTargetType.USER });
    const calendarsUpdated = await getUserExternalCalendars(ctx, user.id);
    const delta = {
      ...user.externalCalendars,
      calendars: calendarsUpdated,
    };

    await updateUser(ctx, user.id, { externalCalendars: { ...delta } });
  }
};

export const addSickLeave = async (outerCtx, sickLeave) =>
  await runInTransaction(async trx => {
    const ctx = { trx, ...outerCtx };

    logger.trace({ ctx, sickLeave }, 'addSickLeave - params');

    const isIntegrationEnabled = await isCalendarIntegrationEnabled(ctx);
    if (!isIntegrationEnabled) return [];

    const user = await getUserById(ctx, sickLeave.userId);
    const {
      externalCalendars: { calendars, primaryCalendarId },
    } = user;
    const createdBy = (ctx.authUser && ctx.authUser.id) || ''; // for integration tests we don't have authenticated user

    if (!primaryCalendarId) {
      throw new ServiceError({
        token: 'INVALID_USER_FOR_SICK_LEAVE',
        status: 400,
      });
    }
    const mainCalendar = calendars.find(c => c.calendar_id === primaryCalendarId);
    await updateCalendarPermissions(ctx, mainCalendar, user);

    const calendarEvent = {
      userId: sickLeave.userId,
      metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: sickLeave.notes, timezone: sickLeave.timezone, createdBy },
      startDate: sickLeave.startDate,
      endDate: sickLeave.endDate,
    };

    const event = await calendarEventsRepo.saveUserEvent(ctx, calendarEvent);
    await createSickLeaveEvent(ctx, event, primaryCalendarId);
    const sickLeavesSplitByDay = splitSickLeaveInIndividualDays(event, sickLeave.timezone);

    const formattedEvents = await constructFormattedEvents(ctx, sickLeavesSplitByDay, user.id, sickLeave.timezone);
    logger.trace({ ctx, formattedEvents }, 'formatted sick leave events');
    return formattedEvents;
  }, outerCtx);

export const removeSickLeave = async (outerCtx, sickLeaveId) =>
  await runInTransaction(async trx => {
    const ctx = { trx, ...outerCtx };

    const sickLeave = await calendarEventsRepo.getUserEventById(ctx, sickLeaveId);
    if (!sickLeave) {
      throw new ServiceError({
        token: 'SICK_LEAVE_NOT_FOUND',
        status: 404,
      });
    }

    logger.trace({ ctx, sickLeave }, 'deleteSickLeave - params');
    const isIntegrationEnabled = await isCalendarIntegrationEnabled(ctx);
    if (!isIntegrationEnabled) return {};

    const user = await getUserById(ctx, sickLeave.userId);
    const {
      externalCalendars: { primaryCalendarId },
    } = user;

    const deletedBy = (ctx.authUser && ctx.authUser.id) || ''; // for integration tests we don't have authenticated user

    if (!primaryCalendarId) {
      throw new ServiceError({
        token: 'INVALID_USER_FOR_SICK_LEAVE',
        status: 400,
      });
    }

    const newMetadata = { ...sickLeave.metadata, deletedBy, deletedByType: DALTypes.CreatedByType.USER };
    const deletedSickLeave = await calendarEventsRepo.markEventAsDeleted(ctx, sickLeave.id, newMetadata);

    await removeEventByEventId(ctx, { userId: user.id, calendarId: primaryCalendarId, eventId: sickLeave.id });

    logger.trace({ ctx, deletedSickLeave }, 'deleteSickLeave - done');

    return deletedSickLeave;
  }, outerCtx);
