/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import * as cronofyService from './externalCalendars/cronofyService';
import { adjustDatesToTimezoneForCronofyEvent, TIMEZONE_SYNC as TIMEZONE, NUMBER_OF_DAYS_SYNC, NUMBER_OF_PAST_DAYS_SYNC } from './helpers/calendarHelpers';
import { now, DATE_ISO_FORMAT, DATE_TIME_ISO_FORMAT, toMoment } from '../../common/helpers/moment-utils';
import loggerModule from '../../common/helpers/logger';
import * as calendarEventsRepo from '../dal/calendarEventsRepo';
import { CalendarUserEventType } from '../../common/enums/calendarTypes';
import { getUsers } from '../dal/usersRepo';
import { getTeamsFromTenant } from '../dal/teamsRepo';
import { saveTenantMetadata, getTenantData } from '../dal/tenantsRepo';

const logger = loggerModule.child({ subType: 'services/calendarEvents' });

// eslint-disable-next-line camelcase
const externalEventToUserDbModel = ({ start, end, event_uid }, userId) => ({
  userId,
  startDate: start,
  endDate: end,
  metadata: { type: CalendarUserEventType.PERSONAL, id: event_uid },
});

// eslint-disable-next-line camelcase
const externalEventToTeamDbModel = ({ start, end, event_uid }, teamId) => ({
  teamId,
  startDate: start,
  endDate: end,
  externalId: event_uid,
});

const getStartOfDay = () => now({ timezone: TIMEZONE }).add(-1, 'days').startOf('day');

const getStartDate = isFirstSync => (isFirstSync ? getStartOfDay().add(-NUMBER_OF_PAST_DAYS_SYNC, 'days') : getStartOfDay()).format(DATE_ISO_FORMAT);

const getNumberOfDays = isFirstSync => (isFirstSync ? NUMBER_OF_PAST_DAYS_SYNC + NUMBER_OF_DAYS_SYNC : NUMBER_OF_DAYS_SYNC);

const isEventRescheduled = (dbEvent, cronofyEvent) =>
  !toMoment(dbEvent.startDate, { timezone: TIMEZONE }).isSame(toMoment(cronofyEvent.startDate, { timezone: TIMEZONE })) ||
  !toMoment(dbEvent.endDate, { timezone: TIMEZONE }).isSame(toMoment(cronofyEvent.endDate, { timezone: TIMEZONE }));

const excludeEventsWithNoDuration = events => events.filter(e => e.start !== e.end);

export const syncEventsForTeam = async (ctx, team, isFirstSync) => {
  const fieldsToLog = { teamId: team.id, calendarAccount: team.externalCalendars.calendarAccount };
  const startDate = getStartDate(isFirstSync);
  logger.trace({ ctx, ...fieldsToLog, startDate, isFirstSync }, 'syncEventsForTeam - start');

  try {
    const timezone = await calendarEventsRepo.getTimezoneForTeam(ctx, team.id);

    const cronofyTeamEvents = await cronofyService.getEventsForTeam(ctx, {
      teamId: team.id,
      startDate,
      numberOfDays: getNumberOfDays(isFirstSync),
    });
    const teamExternalEvents = excludeEventsWithNoDuration(cronofyTeamEvents);

    const dbEvents = await calendarEventsRepo.getTeamEvents(ctx, team.id, startDate);

    const eventsToRemove = dbEvents.filter(e => !teamExternalEvents.some(te => te.event_uid === e.externalId));
    if (eventsToRemove.length > 0) {
      logger.trace({ ctx, ...fieldsToLog, eventsToRemove }, 'syncEventsForTeam - eventsToRemove');
      const eventIdsToRemove = eventsToRemove.map(e => e.externalId);
      await calendarEventsRepo.removeTeamEventsByExternalIds(ctx, eventIdsToRemove);
    }

    const cronofyEvents = teamExternalEvents.map(e => {
      const event = adjustDatesToTimezoneForCronofyEvent(ctx, e, timezone);
      return externalEventToTeamDbModel(event, team.id);
    });

    await mapSeries(cronofyEvents, async event => {
      const dbEvent = dbEvents.find(e => e.externalId === event.externalId);
      if (!dbEvent) {
        logger.trace({ ctx, ...fieldsToLog, calendarEvent: event }, 'syncEventsForTeam - save event');
        await calendarEventsRepo.saveTeamEvent(ctx, event);
      } else if (isEventRescheduled(dbEvent, event)) {
        logger.trace({ ctx, ...fieldsToLog, dbEvent, calendarEvent: event }, 'syncEventsForTeam - update event');
        await calendarEventsRepo.updateTeamEvent(ctx, event);
      }
    });

    logger.trace({ ctx, ...fieldsToLog }, 'syncEventsForTeam - done');
  } catch (error) {
    logger.error({ ctx, ...fieldsToLog, error }, 'syncEventsForTeam - failed');
  }
};

export const syncEventsForUser = async (ctx, user, isFirstSync) => {
  const fieldsToLog = { userId: user.id, calendarAccount: user.externalCalendars.calendarAccount };
  const startDate = getStartDate(isFirstSync);
  logger.trace({ ctx, ...fieldsToLog, startDate, isFirstSync }, 'syncEventsForUser - start');

  try {
    const timezone = await calendarEventsRepo.getTimezoneForUser(ctx, user.id);

    const cronofyUserEvents = await cronofyService.getEventsForUser(ctx, {
      userId: user.id,
      startDate,
      numberOfDays: getNumberOfDays(isFirstSync),
    });

    const userExternalEvents = excludeEventsWithNoDuration(cronofyUserEvents);
    const dbEvents = (await calendarEventsRepo.getUserEvents(ctx, user.id, startDate)).filter(e => e.metadata.type === CalendarUserEventType.PERSONAL);

    const eventsToRemove = dbEvents.filter(e => !userExternalEvents.some(ue => ue.event_uid === e.metadata.id));
    if (eventsToRemove.length > 0) {
      logger.trace({ ctx, ...fieldsToLog, eventsToRemove }, 'syncEventsForUser - eventsToRemove');
      const eventIdsToRemove = eventsToRemove.map(e => e.metadata.id);
      await calendarEventsRepo.removeUserExternalEventsByIds(ctx, user.id, eventIdsToRemove);
    }

    const cronofyEvents = userExternalEvents.map(e => {
      const event = adjustDatesToTimezoneForCronofyEvent(ctx, e, timezone);
      return externalEventToUserDbModel(event, user.id);
    });

    await mapSeries(cronofyEvents, async event => {
      const dbEvent = dbEvents.find(e => e.metadata.id === event.metadata.id);
      if (!dbEvent) {
        logger.trace({ ctx, ...fieldsToLog, dbEvent, calendarEvent: event }, 'syncEventsForUser - save event');
        await calendarEventsRepo.saveUserEvent(ctx, event);
      } else if (isEventRescheduled(dbEvent, event)) {
        logger.trace({ ctx, ...fieldsToLog, calendarEvent: event }, 'syncEventsForUser - update event');
        await calendarEventsRepo.updateUserEvent(ctx, event);
      }
    });

    logger.trace({ ctx, ...fieldsToLog }, 'finishing external calendars sync for user');
  } catch (error) {
    logger.error({ ctx, ...fieldsToLog, error }, 'syncEventsForUser - failed');
  }
};

export const syncCalendarEvents = async ctx => {
  logger.trace({ ctx }, 'syncCalendarEvents - start');
  const { tenantId } = ctx;

  const users = await getUsers(ctx);
  const teams = await getTeamsFromTenant(tenantId);
  const usersWithExternalCalendars = users.filter(u => u.externalCalendars.calendarAccount && u.externalCalendars.primaryCalendarId);
  const teamsWithExternalCalendars = teams.filter(t => t.externalCalendars.calendarAccount && t.externalCalendars.teamCalendarId);

  const tenant = await getTenantData(ctx);
  const isFirstSync = !tenant.metadata.externalCalendars.lastSyncDate;

  logger.trace({ ctx, isFirstSync }, 'sync events for users');
  await mapSeries(usersWithExternalCalendars, async user => await syncEventsForUser(ctx, user, isFirstSync));

  logger.trace({ ctx, isFirstSync }, 'sync events for teams');
  await mapSeries(teamsWithExternalCalendars, async team => await syncEventsForTeam(ctx, team, isFirstSync));

  await saveTenantMetadata(ctx, tenantId, { externalCalendars: { ...tenant.metadata.externalCalendars, lastSyncDate: now().format(DATE_TIME_ISO_FORMAT) } });

  logger.trace({ ctx }, 'syncCalendarEvents - done');
};
