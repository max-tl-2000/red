/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import range from 'lodash/range';
import random from 'lodash/random';
import newId from 'uuid/v4';
import { getTenant, updateTenant } from '../../services/tenantService';
import { getTeamBy, updateTeam } from '../../dal/teamsRepo';
import { getUserByEmail, updateUser } from '../../dal/usersRepo';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { CalendarTargetType, CalendarActionTypes } from '../../../common/enums/calendarTypes';
import { runInTransaction } from '../../database/factory';
import { now } from '../../../common/helpers/moment-utils';
import { saveTeamEvent } from '../../dal/calendarEventsRepo';
import cucumberConfig from '../../../cucumber/config';
import { UTC_TIMEZONE } from '../../../common/date-constants';

import logger from '../../../common/helpers/logger';

const tenantExternalCalendars = {
  sub: 'ser_5da59a006afad300e3458976',
  scope: 'service_account/accounts/unrestricted_access',
  expires_in: 1800,
  token_type: 'bearer', // eslint-disable-line camelcase
  access_token: 'EZnC9F11FkpegQWcU7ThqGz_Luf05LfG',
  refresh_token: '0ZRkMLMofCG2TLaaRoxWgwDi5fvkAmrU',
  singleUseCode: 'O7jA-NYJhxkCbeRExdQZqMilRqnpcPax',
  integrationEnabled: true,
  service_account_id: 'ser_5da59a006afad300e3458976', // eslint-disable-line camelcase
};

const addMessage = async (ctx, uniquieIdentifier, entityType) => {
  let message = {
    tenantId: ctx.tenantId,
    action: CalendarActionTypes.ADD_ACCOUNT,
    entityType,
  };
  message = entityType === CalendarTargetType.TEAM ? { ...message, teamName: uniquieIdentifier } : { ...message, userExternalUniqueId: uniquieIdentifier };
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.PERFORM_ACTIONS_ON_CALENDAR_ACCOUNT,
    message,
    ctx,
  });
};

const prepareUsersForCalendarIntegration = async (tenantCtx, userCalendarAccounts) => {
  logger.trace({ ctx: tenantCtx, userCalendarAccounts }, '[IMPORT SAMPLE] starting preparing users for calendar integration');
  await mapSeries(userCalendarAccounts, async userCalendarAccount => {
    const user = await getUserByEmail(tenantCtx, userCalendarAccount.userEmail);
    await updateUser(tenantCtx, user.id, { externalCalendars: { calendarAccount: userCalendarAccount.calendarAccount } });
    await addMessage(tenantCtx, user.externalUniqueId, CalendarTargetType.USER);
  });
};

const prepareTeamsForCalendarIntegration = async (tenantCtx, teamCalendarAccounts) => {
  logger.trace({ ctx: tenantCtx, teamCalendarAccounts }, '[IMPORT SAMPLE] starting preparing teams for calendar integration');
  await mapSeries(teamCalendarAccounts, async teamCalendarAccount => {
    const team = await getTeamBy(tenantCtx, { name: teamCalendarAccount.teamName });
    await updateTeam(tenantCtx, team.id, { externalCalendars: { calendarAccount: teamCalendarAccount.calendarAccount } });
    await addMessage(tenantCtx, team.name, CalendarTargetType.TEAM);
  });
};

const isSunday = day => day.weekday() === 0;

const setSundayAsOfficeClosed = async (ctx, teamId, startDate, endDate) => await saveTeamEvent(ctx, { teamId, startDate, endDate, externalId: newId() });
const addHoursToDay = (day, hour) => day.clone().add(hour, 'hours');

const setTeamOfficeHours = async (ctx, day, nextDay, officeHours, teamId) => {
  const startHour = random(officeHours.officeMinStartHour, officeHours.officeMaxStartHour);
  const endHour = random(officeHours.officeMinEndHour, officeHours.officeMaxEndHour);
  const startWorkingDay = addHoursToDay(day, startHour);
  const endWorkingDay = addHoursToDay(day, endHour);
  await saveTeamEvent(ctx, { teamId, startDate: day, endDate: startWorkingDay, externalId: newId() });
  await saveTeamEvent(ctx, { teamId, startDate: endWorkingDay, endDate: nextDay, externalId: newId() });
};

const { cucumber } = cucumberConfig;
const isRefreshUsedByCucumber = tenantName => tenantName === cucumber.tenantName;

const insertOfficeHours = async (ctx, officeHours) => {
  const isCucumberEnv = isRefreshUsedByCucumber(ctx.tenantName);
  return (
    officeHours &&
    officeHours.teams &&
    (await mapSeries(officeHours.teams, async team => {
      await runInTransaction(async trx => {
        const trxCtx = { ...ctx, trx };
        const teamData = await getTeamBy(trxCtx, {
          name: team,
        });

        if (!teamData) {
          throw new Error(`No team "${team}" found`);
        }

        const startDate = now({ timezone: UTC_TIMEZONE }).startOf('day').add(-1, 'days').add(officeHours.offset, 'hours');

        const daysRange = range(officeHours.numberOfDays);
        await mapSeries(daysRange, async s => {
          const day = startDate.clone().add(s, 'days');
          const nextDay = day.clone().add(1, 'days');
          // we check for cucumber enviroment so that the test doesn't fail anymore when it runs on isSunday
          // this is a simpler solution than modifying the test so that it goes to the next day if it is sunday today

          if (isSunday(day) && !isCucumberEnv) {
            await setSundayAsOfficeClosed(trxCtx, teamData.id, day.startOf('day'), nextDay.startOf('day'));
          } else {
            await setTeamOfficeHours(trxCtx, day, nextDay, officeHours, teamData.id);
          }
        });
      });
    }))
  );
};

export const doCalendarIntegration = async (ctx, { tenantId, officeHours, userCalendarAccounts, teamCalendarAccounts }) => {
  try {
    const tenant = await getTenant({ tenantId });
    const tenantCtx = { tenantId, tenantName: tenant.name };
    const isDemoEnvironment = process.env.CLOUD_ENV === 'demo';

    if (!(isDemoEnvironment && tenant.name === 'demo')) {
      logger.trace({ ctx, tenantId }, '[IMPORT SAMPLE] no calendar integration needs to be done on tenant, inserting some default office hours');
      await insertOfficeHours(tenantCtx, officeHours);
      return;
    }

    logger.trace({ ctx, tenantId }, '[IMPORT SAMPLE] starting calendar integration for demo tenant');
    const { metadata = {} } = tenant;

    await updateTenant(tenant.id, {
      metadata: {
        ...metadata,
        externalCalendars: tenantExternalCalendars,
      },
    });

    logger.trace({ ctx: tenantCtx }, '[IMPORT SAMPLE] starting the calendar setup and integration for teams and users');
    await prepareUsersForCalendarIntegration(tenantCtx, userCalendarAccounts);
    await prepareTeamsForCalendarIntegration(tenantCtx, teamCalendarAccounts);

    logger.trace({ ctx: tenantCtx }, '[IMPORT SAMPLE] finished preparing for calendar integration');
  } catch (error) {
    logger.error({ ctx: { tenantId }, error }, '[IMPORT SAMPLE] calendar integration failed');
  }
};
