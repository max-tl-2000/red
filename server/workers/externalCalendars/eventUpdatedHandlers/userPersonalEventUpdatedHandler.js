/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import loggerModule from '../../../../common/helpers/logger';
import * as service from '../../../services/externalCalendars/cronofyService';
import { adjustDatesToTimezoneForCronofyEvent } from '../../../services/helpers/calendarHelpers';
import { getUserById } from '../../../dal/usersRepo';
import * as calendarEventsRepo from '../../../dal/calendarEventsRepo';
import { CalendarTargetType, CalendarUserEventType } from '../../../../common/enums/calendarTypes';
import { eventShouldBeIgnored, getChangesSince, notificationShouldBeIgnored } from './eventUpdatedHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'externalCalendarUserPersonalEventUpdatedHandler' });

const getEventMetadata = externalId => ({ id: externalId, type: CalendarUserEventType.PERSONAL });

const upsertEvent = async (ctx, userId, cronofyEvent) => {
  const timezone = await calendarEventsRepo.getTimezoneForUser(ctx, userId);
  const enhancedCronofyEvent = adjustDatesToTimezoneForCronofyEvent(ctx, cronofyEvent, timezone);
  const { start: startDate, end: endDate, event_uid: externalId, free_busy_status: freeBusyStatus } = enhancedCronofyEvent;
  const shouldBeIgnored = eventShouldBeIgnored({ freeBusyStatus, startDate, endDate });

  const dbEvent = await calendarEventsRepo.getPersonalUserEventByExternalId(ctx, userId, externalId);

  const metadata = getEventMetadata(externalId);
  const event = { userId, startDate, endDate, metadata };

  if (dbEvent) {
    return shouldBeIgnored ? (await calendarEventsRepo.removeUserEvent(ctx, metadata)) || {} : await calendarEventsRepo.updateUserEvent(ctx, event);
  }

  return shouldBeIgnored ? {} : await calendarEventsRepo.saveUserEvent(ctx, event);
};

const handleSickLeaveEventChanged = async (ctx, cronofyEvent, sickLeaveEvent) => {
  logger.trace({ ctx, ...cronofyEvent }, 'handleSickLeaveEventChanged');
  if (cronofyEvent.deleted) {
    const newMetadata = { ...sickLeaveEvent.metadata, deletedByType: DALTypes.CreatedByType.GUEST };
    return await calendarEventsRepo.markEventAsDeleted(ctx, sickLeaveEvent.id, newMetadata);
  }

  const timezone = sickLeaveEvent.metadata.timezone;
  const enhancedCronofyEvent = adjustDatesToTimezoneForCronofyEvent(ctx, cronofyEvent, timezone);
  const { start: startDate, end: endDate, free_busy_status: freeBusyStatus } = enhancedCronofyEvent;
  const shouldBeIgnored = eventShouldBeIgnored({ freeBusyStatus, startDate, endDate });

  const event = { ...sickLeaveEvent, startDate, endDate };

  return shouldBeIgnored ? {} : await calendarEventsRepo.updateUserEvent(ctx, event);
};

const handleEventChanges = async (ctx, userId, cronofyEvent) => {
  logger.trace({ ctx, ...cronofyEvent }, 'handle external calendar event changes');
  const { event_uid: externalId, deleted, event_id } = cronofyEvent;

  const sickLeaveEvent = event_id ? await calendarEventsRepo.getUserEventById(ctx, event_id) : {};

  if (sickLeaveEvent && sickLeaveEvent.metadata?.type === CalendarUserEventType.SICK_LEAVE) {
    return await handleSickLeaveEventChanged(ctx, cronofyEvent, sickLeaveEvent);
  }

  logger.trace({ ctx, ...cronofyEvent }, 'handlePersonalEventChanged');

  if (deleted) return (await calendarEventsRepo.removeUserEvent(ctx, getEventMetadata(externalId))) || {};
  return await upsertEvent(ctx, userId, cronofyEvent);
};

export const processEventUpdatedNotification = async payload => {
  const { msgCtx: ctx, userId, notificationData } = payload;
  logger.trace({ ctx, ...payload }, 'processing event updated notification');

  const {
    externalCalendars: { primaryCalendarId },
  } = await getUserById(ctx, userId);

  try {
    if (notificationShouldBeIgnored({ ctx, notificationData, calendarId: primaryCalendarId, entityId: userId, targetType: CalendarTargetType.USER })) {
      return { processed: true };
    }

    const target = { id: userId, type: CalendarTargetType.USER };
    const changesSince = await getChangesSince(ctx, notificationData.changes_since);
    const events = await service.getEventsModifiedSinceDate(ctx, { target, calendarId: primaryCalendarId, dateStringUTC: changesSince });
    logger.trace({ ctx, ...payload, changesSince, noOfEvents: events.length }, 'processEventUpdatedNotification - noOfEvents');

    await mapSeries(events, async event => await handleEventChanges(ctx, userId, event));

    logger.trace({ ctx, ...payload, changesSince }, 'event updated notification processed successfully');
  } catch (error) {
    logger.error({ ctx, payload, error }, 'error while processing event updated notification');
    return { processed: false };
  }

  return { processed: true };
};
