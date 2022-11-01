/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import nullish from '../../common/helpers/nullish';
import { now } from '../../common/helpers/moment-utils';
import { getTeamsForUser, getTeamById, getFirstTeamIdByModuleForProperty } from '../dal/teamsRepo';
import { isCalendarIntegrationEnabled } from './externalCalendars/cronofyService';
import { getTeamEventsForDatesByTeamId } from '../dal/calendarEventsRepo';
import { isMomentInInterval } from '../../common/helpers/date-utils';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'office-calendar-availability' });

export const isCreatedOnOfficeHours = (team, nowDate = now()) => {
  const getStartOfDayInTeamTimezone = () => nowDate.clone().tz(team.timeZone).startOf('day');

  const dayName = getStartOfDayInTeamTimezone().format('dddd');

  const officeHoursForDay = team.officeHours[dayName];

  if (!officeHoursForDay) {
    // office is closed if not office hours for a given day
    return false;
  }

  let { startTimeOffsetInMin: startOffset, endTimeOffsetInMin: endOffset } = officeHoursForDay;

  if (nullish(startOffset)) {
    startOffset = 0;
  }

  if (nullish(endOffset)) {
    endOffset = 24 * 60;
  }

  const startOfficeHours = getStartOfDayInTeamTimezone().add(startOffset, 'minutes');
  const endOfficeHours = getStartOfDayInTeamTimezone().add(endOffset, 'minutes');

  return nowDate.isSameOrAfter(startOfficeHours) && nowDate.isBefore(endOfficeHours);
};

export const isDuringOfficeHours = async (ctx, team, nowDate = now()) => {
  // from: https://momentjs.com/docs/
  // All moments are mutable. If you want a clone of a moment, you can do so implicitly or explicitly.
  const isIntegrationEnabled = await isCalendarIntegrationEnabled(ctx);

  if (isIntegrationEnabled && team.externalCalendars && team.externalCalendars.teamCalendarId) {
    const teamEventsForDay = await getTeamEventsForDatesByTeamId(ctx, { teamId: team.id, startDate: nowDate.clone().startOf('day'), noOfDays: 1 });
    if (teamEventsForDay.length > 0) {
      logger.trace({ ctx, teamId: team.id, numOfTeamEvents: teamEventsForDay.length }, 'team has events today');

      // there are external calendar events for the selected date
      return !teamEventsForDay.some(te => {
        const isTeamEventInInterval = isMomentInInterval(nowDate, te.startDate, te.endDate);

        isTeamEventInInterval &&
          logger.trace({ ctx, teamEventId: te.id, teamId: te.teamId, startDate: te.startDate, endDate: te.endDate }, 'team event is in time interval');

        return isTeamEventInInterval;
      });
    }
  }

  return isCreatedOnOfficeHours(team, nowDate);
};

export const shouldSendCalendarEmails = async (ctx, teamId) => {
  const team = await getTeamById(ctx, teamId);
  return team ? team.metadata.comms.sendCalendarCommsFlag : false;
};

export const doesUserBelongToACallCenter = async (ctx, userId) => {
  const userTeams = await getTeamsForUser(ctx, userId);
  return userTeams.some(team => team.metadata.callRoutingStrategy === DALTypes.CallRoutingStrategy.CALL_CENTER);
};

export const getFirstLeasingTeamIdForProperty = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getFirstLeasingTeamIdForProperty');

  return getFirstTeamIdByModuleForProperty(ctx, propertyId, DALTypes.ModuleType.LEASING);
};

export const getFirstResidentServicesTeamIdForProperty = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getFirstResidentServicesTeamIdForProperty');

  return getFirstTeamIdByModuleForProperty(ctx, propertyId, DALTypes.ModuleType.RESIDENT_SERVICES);
};
