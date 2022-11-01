/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import * as service from '../../services/externalCalendars/cronofyService';
import { getUserById, updateUser } from '../../dal/usersRepo';
import { getTeamById, updateTeam } from '../../dal/teamsRepo';
import { getTenantData } from '../../dal/tenantsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTasksForUserByCategory } from '../../dal/tasksRepo';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { syncEventsForUser, syncEventsForTeam } from '../../services/calendarEvents';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';

const logger = loggerModule.child({ subType: 'performIntegrationSetupForCalendarAccount' });

export const getNotificationUrlForUser = async (ctx, userId, isForPersonalCalendar) => {
  const { userRevaEventUpdatedUrl, userPersonalEventUpdatedUrl } = await getCronofyConfigs(ctx);
  const url = isForPersonalCalendar ? userPersonalEventUpdatedUrl : userRevaEventUpdatedUrl;
  return `${url}&userId=${userId}`;
};

const getNotificationUrlForTeam = async (ctx, teamId) => {
  const { teamEventUpdatedUrl } = await getCronofyConfigs(ctx);
  return `${teamEventUpdatedUrl}&teamId=${teamId}`;
};

const performIntegrationSetupForUser = async payload => {
  const { msgCtx, code, id: userId, type } = payload;
  logger.info({ ctx: msgCtx, ...payload }, 'performIntegrationSetupForUser');

  try {
    await service.requestAccessToken(msgCtx, code, userId, type);
    const revaCalendarId = await service.createRevaUserCalendar(msgCtx, userId);
    const calendars = await service.getUserExternalCalendars(msgCtx, userId);
    const primaryCalendar = calendars.find(c => c.calendar_primary);
    const primaryCalendarId = primaryCalendar.calendar_id;

    const revaCalendarNotificationChannel = await service.createNotificationChannel(msgCtx, {
      targetId: userId,
      targetType: CalendarTargetType.USER,
      calendarId: revaCalendarId,
      notificationUrl: await getNotificationUrlForUser(msgCtx, userId, false),
    });

    const primaryCalendarNotificationChannel = await service.createNotificationChannel(msgCtx, {
      targetId: userId,
      targetType: CalendarTargetType.USER,
      calendarId: primaryCalendarId,
      notificationUrl: await getNotificationUrlForUser(msgCtx, userId, true),
    });

    const user = await getUserById(msgCtx, userId);
    const delta = {
      ...user.externalCalendars,
      revaCalendarId,
      primaryCalendarId,
      calendars,
      notificationChannels: [revaCalendarNotificationChannel, primaryCalendarNotificationChannel],
    };

    await updateUser(msgCtx, userId, { externalCalendars: delta });
    const appointments = await getTasksForUserByCategory(msgCtx, userId, DALTypes.TaskCategories.APPOINTMENT);
    const oneMonthBeforeNow = now({ timezone: 'UTC' }).subtract(30, 'day');

    const filteredAppointments = appointments.filter(task => toMoment(task.metadata.startDate).isAfter(oneMonthBeforeNow, 'day'));
    await service.bulkCreateEvents(msgCtx, filteredAppointments);

    const tenant = await getTenantData(msgCtx);
    const isFirstSync = !tenant.metadata.externalCalendars.lastSyncDate;
    await syncEventsForUser(msgCtx, user, isFirstSync);

    logger.info({ ctx: msgCtx, ...payload }, 'performIntegrationSetupForUser - done');
  } catch (error) {
    logger.error({ ctx: msgCtx, ...payload, error }, 'error while requesting the access for user account');
    return { processed: false };
  }

  return { processed: true };
};

const performIntegrationSetupForTeam = async payload => {
  const { msgCtx, code, id: teamId, type } = payload;
  logger.info({ ctx: msgCtx, teamId }, 'performIntegrationSetupForTeamAccount');

  try {
    await service.requestAccessToken(msgCtx, code, teamId, type);
    const teamCalendarId = await service.createRevaTeamCalendar(msgCtx, teamId);
    const calendars = await service.getTeamExternalCalendars(msgCtx, teamId);
    const team = await getTeamById(msgCtx, teamId);

    const teamCalendarNotificationChannel = await service.createNotificationChannel(msgCtx, {
      targetId: teamId,
      targetType: CalendarTargetType.TEAM,
      calendarId: teamCalendarId,
      notificationUrl: await getNotificationUrlForTeam(msgCtx, teamId),
    });

    const delta = {
      ...team.externalCalendars,
      teamCalendarId,
      calendars,
      notificationChannels: [teamCalendarNotificationChannel],
    };
    await updateTeam(msgCtx, teamId, { externalCalendars: delta });

    const tenant = await getTenantData(msgCtx);
    const isFirstSync = !tenant.metadata.externalCalendars.lastSyncDate;
    await syncEventsForTeam(msgCtx, team, isFirstSync);

    logger.info({ ctx: msgCtx, teamId, teamCalendarId }, 'performIntegrationSetupForTeam - done');
  } catch (error) {
    logger.error({ ctx: msgCtx, teamId, error }, 'error while requesting the access for team account');
    return { processed: false };
  }

  return { processed: true };
};

export const performIntegrationSetupForAccount = async payload =>
  payload.type === CalendarTargetType.USER ? await performIntegrationSetupForUser(payload) : await performIntegrationSetupForTeam(payload);
