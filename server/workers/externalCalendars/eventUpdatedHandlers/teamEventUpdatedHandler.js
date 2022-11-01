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
import { getTeamById } from '../../../dal/teamsRepo';
import * as calendarEventsRepo from '../../../dal/calendarEventsRepo';
import { CalendarTargetType } from '../../../../common/enums/calendarTypes';
import { eventShouldBeIgnored, getChangesSince, notificationShouldBeIgnored } from './eventUpdatedHelper';

const logger = loggerModule.child({ subType: 'externalCalendarTeamEventUpdatedHandler' });

const upsertEvent = async (ctx, teamId, cronofyEvent) => {
  const timezone = await calendarEventsRepo.getTimezoneForTeam(ctx, teamId);
  const enhancedCronofyEvent = adjustDatesToTimezoneForCronofyEvent(ctx, cronofyEvent, timezone);
  const { start: startDate, end: endDate, event_uid: externalId, free_busy_status: freeBusyStatus } = enhancedCronofyEvent;
  const shouldBeIgnored = eventShouldBeIgnored({ freeBusyStatus, startDate, endDate });

  const dbEvent = await calendarEventsRepo.getTeamEventByExternalId(ctx, externalId);

  if (dbEvent) {
    return shouldBeIgnored
      ? (await calendarEventsRepo.removeTeamEventByExternalId(ctx, externalId)) || {}
      : await calendarEventsRepo.updateTeamEvent(ctx, { startDate, endDate, externalId });
  }

  return shouldBeIgnored ? {} : await calendarEventsRepo.saveTeamEvent(ctx, { teamId, startDate, endDate, externalId });
};

const handleEventChanges = async (ctx, teamId, cronofyEvent) => {
  logger.trace({ ctx, ...cronofyEvent }, 'handle external calendar event changes');
  const { event_uid: externalId, deleted } = cronofyEvent;

  if (deleted) return (await calendarEventsRepo.removeTeamEventByExternalId(ctx, externalId)) || {};
  return await upsertEvent(ctx, teamId, cronofyEvent);
};

export const processEventUpdatedNotification = async payload => {
  const { msgCtx: ctx, teamId, notificationData } = payload;
  logger.trace({ ctx, ...payload }, 'processing event updated notification');

  const {
    externalCalendars: { teamCalendarId },
  } = await getTeamById(ctx, teamId);

  try {
    if (notificationShouldBeIgnored({ ctx, notificationData, calendarId: teamCalendarId, entityId: teamId, targetType: CalendarTargetType.TEAM })) {
      return { processed: true };
    }

    const target = { id: teamId, type: CalendarTargetType.TEAM };
    const changesSince = await getChangesSince(ctx, notificationData.changes_since);
    const events = await service.getEventsModifiedSinceDate(ctx, { target, calendarId: teamCalendarId, dateStringUTC: changesSince });
    logger.trace({ ctx, ...payload, changesSince, noOfEvents: events.length }, 'processEventUpdatedNotification - noOfEvents');

    await mapSeries(events, async event => await handleEventChanges(ctx, teamId, event));

    logger.trace({ ctx, ...payload, changesSince }, 'event updated notification processed successfully');
  } catch (error) {
    logger.error({ ctx, payload, error }, 'error while processing event updated notification');
    return { processed: false };
  }

  return { processed: true };
};
