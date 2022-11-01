/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { saveTenantMetadata } from '../../dal/tenantsRepo';
import { getUsers } from '../../dal/usersRepo';
import { getTeamsFromTenant } from '../../dal/teamsRepo';
import { removeAllTeamEvents } from '../../dal/calendarEventsRepo';
import loggerModule from '../../../common/helpers/logger';
import { externalCalendarCleanupForUser, externalCalendarCleanupForTeam } from '../../services/externalCalendars/cronofyService';
const logger = loggerModule.child({ subType: 'cleanupCalendarAccountsHandler' });

export const cleanupCalendarAccounts = async payload => {
  const { msgCtx, tenantId } = payload;
  logger.trace({ ctx: msgCtx }, 'cleanupCalendarAccounts');

  try {
    const users = await getUsers(msgCtx);
    const teams = await getTeamsFromTenant(msgCtx.tenantId, false);
    const usersWithExternalCalendars = users.filter(u => u.externalCalendars.calendarAccount && u.externalCalendars.revaCalendarId);
    const teamsWithExternalCalendars = teams.filter(t => t.externalCalendars.calendarAccount && t.externalCalendars.teamCalendarId);

    await removeAllTeamEvents(msgCtx);

    await mapSeries(usersWithExternalCalendars, async user => {
      logger.trace({ ctx: msgCtx, userId: user.id, calendarAccount: user.externalCalendars.calendarAccount }, 'account cleanup for user');
      await externalCalendarCleanupForUser(msgCtx, user, { externalCalendars: {} });
    });

    await mapSeries(teamsWithExternalCalendars, async team => {
      logger.trace({ ctx: msgCtx, teamId: team.id, calendarAccount: team.externalCalendars.calendarAccount }, 'account cleanup for team');
      await externalCalendarCleanupForTeam(msgCtx, team, { externalCalendars: {} });
    });

    await saveTenantMetadata(msgCtx, tenantId, { externalCalendars: { integrationEnabled: false } });
    logger.trace({ ctx: msgCtx, ...payload }, 'cleanupCalendarAccounts - done');
  } catch (error) {
    logger.error({ ctx: msgCtx, payload, error }, 'cleanupCalendarAccounts - error');
    return { processed: false };
  }

  return { processed: true };
};
