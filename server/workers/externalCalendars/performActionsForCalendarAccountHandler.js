/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import * as enterpriseService from '../../services/externalCalendars/cronofyEnterpriseService';
import { CalendarActionTypes, CalendarTargetType } from '../../../common/enums/calendarTypes';
import { getUserByExternalUniqueId } from '../../dal/usersRepo';
import { getTeamBy } from '../../dal/teamsRepo';
const logger = loggerModule.child({ subType: 'performActionsForCalendarAccountHandler' });
import { externalCalendarCleanupForUser, externalCalendarCleanupForTeam, externalCalendarDetachForTeam } from '../../services/externalCalendars/cronofyService';

const performActionsForUserCalendarAccount = async (ctx, payload) => {
  const { action, userExternalUniqueId: userExternalId } = payload;
  const user = await getUserByExternalUniqueId(ctx, userExternalId);
  const {
    externalCalendars: { calendarAccount },
  } = user;

  switch (action) {
    case CalendarActionTypes.REMOVE_ACCOUNT:
      await externalCalendarCleanupForUser(ctx, user, { externalCalendars: {} });
      break;
    case CalendarActionTypes.UPDATE_ACCOUNT:
      await externalCalendarCleanupForUser(ctx, user, { externalCalendars: { calendarAccount } });
      await enterpriseService.requestSingleDelegatedAccess(ctx, CalendarTargetType.USER, user);
      break;
    case CalendarActionTypes.ADD_ACCOUNT:
      await enterpriseService.requestSingleDelegatedAccess(ctx, CalendarTargetType.USER, user);
      break;
    default:
      logger.info({ ctx, ...payload }, 'performActionsForCalendarAccount - no action to be performed');
      break;
  }
};

const performActionsForTeamCalendarAccount = async (ctx, payload) => {
  const { action, teamName } = payload;
  const team = await getTeamBy(ctx, { name: teamName });
  const {
    externalCalendars: { calendarAccount, calendarName },
  } = team;

  switch (action) {
    case CalendarActionTypes.REMOVE_ACCOUNT:
      await externalCalendarCleanupForTeam(ctx, team, { externalCalendars: {} });
      break;
    case CalendarActionTypes.UPDATE_ACCOUNT:
      await externalCalendarCleanupForTeam(ctx, team, { externalCalendars: { calendarAccount, calendarName } });
      await enterpriseService.requestSingleDelegatedAccess(ctx, CalendarTargetType.TEAM, team);
      break;
    case CalendarActionTypes.RENAME_CALENDAR:
      await externalCalendarDetachForTeam(ctx, team, { externalCalendars: { calendarAccount, calendarName } });
      await enterpriseService.requestSingleDelegatedAccess(ctx, CalendarTargetType.TEAM, team);
      break;
    case CalendarActionTypes.ADD_ACCOUNT:
      await enterpriseService.requestSingleDelegatedAccess(ctx, CalendarTargetType.TEAM, team);
      break;
    default:
      logger.info({ ctx, ...payload }, 'performActionsForTeamCalendarAccount - no action to be performed');
      break;
  }
};

export const performActionsForCalendarAccount = async payload => {
  const { msgCtx } = payload;

  try {
    logger.info({ ctx: msgCtx, ...payload }, 'performActionsForCalendarAccount');
    if (payload.entityType === CalendarTargetType.USER) {
      await performActionsForUserCalendarAccount(msgCtx, payload);
    } else {
      await performActionsForTeamCalendarAccount(msgCtx, payload);
    }
    logger.info({ ctx: msgCtx, ...payload }, 'performActionsForCalendarAccount - done');
  } catch (error) {
    logger.error({ ctx: msgCtx, payload, error }, 'performActionsForCalendarAccount - error');
    return { processed: false };
  }
  return { processed: true };
};
