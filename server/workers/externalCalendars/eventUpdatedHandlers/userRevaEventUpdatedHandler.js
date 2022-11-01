/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import loggerModule from '../../../../common/helpers/logger';
import * as service from '../../../services/externalCalendars/cronofyService';
import { getExternalCalendarEventDescription, getCalendarSummary } from '../../../services/externalCalendars/cronofyServiceHelper';
import { getUserById } from '../../../dal/usersRepo';
import { getTaskById } from '../../../dal/tasksRepo';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { CalendarTargetType } from '../../../../common/enums/calendarTypes';
import { getAppointmentAddress } from '../../../services/helpers/calendarHelpers';
import { getChangesSince, notificationShouldBeIgnored } from './eventUpdatedHelper';

const logger = loggerModule.child({ subType: 'externalCalendarUserRevaEventUpdatedHandler' });

const wasEdited = async (ctx, cronofyEvent, appointment) => {
  const appointmentDetails = await getExternalCalendarEventDescription(ctx, appointment);
  return (
    cronofyEvent.description !== appointmentDetails ||
    cronofyEvent.summary !== (await getCalendarSummary(ctx, appointment)) ||
    !toMoment(cronofyEvent.start, { timezone: 'Etc/UTC' }).isSame(toMoment(appointment.metadata.startDate, { timezone: 'Etc/UTC' })) ||
    !toMoment(cronofyEvent.end, { timezone: 'Etc/UTC' }).isSame(toMoment(appointment.metadata.end, { timezone: 'Etc/UTC' }))
  );
};

const handleEventChanges = async (ctx, event) => {
  logger.trace({ ctx, ...event }, 'handle external calendar event changes');

  // events created by Reva will have two ids set: event_id and event_uid. event_id is the id from Reva db.
  // events created by the user in the external calendar will have only one id set: event_uid.
  const isExternalEvent = !event.event_id;

  if (isExternalEvent) {
    logger.trace({ ctx, ...event }, 'event was added by the user in the external calendar - removing the event');
    return await service.removeEventByExternalId(ctx, event.calendar_id, event.event_uid);
  }

  const dbAppointment = await getTaskById(ctx, event.event_id);

  if (!dbAppointment) {
    logger.trace({ ctx, ...event }, 'event does no longer exist in Reva db - removing the event');
    return await service.removeEventByExternalId(ctx, event.calendar_id, event.event_uid);
  }

  const propertyAddress = await getAppointmentAddress(ctx, dbAppointment);

  if (!event.deleted && (await wasEdited(ctx, event, dbAppointment))) {
    logger.trace({ ctx, ...event }, 'event was edited in the external calendar - reverting the event changes');
    return await service.updateEvent(ctx, { appointment: dbAppointment, propertyAddress });
  }

  if (event.deleted && dbAppointment) {
    logger.trace({ ctx, ...event }, 'event was removed from the external calendar - adding the event');
    return await service.createEvent(ctx, { appointment: dbAppointment, propertyAddress });
  }

  return {};
};

export const processEventUpdatedNotification = async payload => {
  const { msgCtx: ctx, userId, notificationData } = payload;
  logger.trace({ ctx, ...payload }, 'processing event updated notification');

  try {
    const {
      externalCalendars: { revaCalendarId },
    } = await getUserById(ctx, userId);

    if (notificationShouldBeIgnored({ ctx, notificationData, calendarId: revaCalendarId, entityId: userId, targetType: CalendarTargetType.USER })) {
      return { processed: true };
    }

    const target = { id: userId, type: CalendarTargetType.USER };
    const changesSince = await getChangesSince(ctx, notificationData.changes_since);
    const events = await service.getEventsModifiedSinceDate(ctx, { target, calendarId: revaCalendarId, dateStringUTC: changesSince });
    logger.trace({ ctx, ...payload, changesSince, noOfEvents: events.length }, 'processEventUpdatedNotification - noOfEvents');

    await mapSeries(events, async event => await handleEventChanges(ctx, event));

    logger.trace({ ctx, ...payload, changesSince }, 'event updated notification processed successfully');
  } catch (error) {
    logger.error({ ctx, payload, error }, 'error while processing event updated notification');
    return { processed: false };
  }

  return { processed: true };
};
