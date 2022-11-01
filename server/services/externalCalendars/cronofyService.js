/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable camelcase */
import { mapSeries, map as promiseMap } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { getUserById, getUsers, updateUser } from '../../dal/usersRepo';
import { getTeamById, updateTeam, getTeamsUsingCalendarAccount } from '../../dal/teamsRepo';
import { getTimezoneForParty } from '../../dal/partyRepo';
import { getTenantData } from '../../dal/tenantsRepo';
import { removeAllExternalUserEvents, removeTeamEventsByTeamId } from '../../dal/calendarEventsRepo';
import { getCalendarOps } from './providerApiOperations';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { CalendarTargetType, CalendarPermissionLevel, EventStatus } from '../../../common/enums/calendarTypes';
import * as helper from './cronofyServiceHelper';
import { NUMBER_OF_DAYS_SYNC, getDateRangeForSync, getAppointmentAddress } from '../helpers/calendarHelpers';
import { AppointmentEmailType } from '../../../common/enums/enums';
import { ServiceError } from '../../common/errors';

const logger = loggerModule.child({ subType: 'cronofyService' });

const MAX_CONCURRENT_REQUESTS = 12;

export const isCalendarIntegrationEnabled = async ctx => {
  const { metadata } = await getTenantData(ctx);
  return (metadata.externalCalendars || {}).integrationEnabled;
};

const checkForBatchCallErrors = ({ ctx, options, target, result, throwError }) => {
  const batchResult = result?.batch?.filter(b => b.status !== 202);
  if (batchResult && batchResult.length > 0) {
    logger.error({ ctx, options, target, errors: batchResult }, 'errors in processing batch operations');
    if (throwError) {
      throw new ServiceError({
        token: 'ERROR_CALLING_CRONOFY_BATCH',
      });
    }
  }
};

// IMPORTANT: all cronofy functions that use an access_token, should be called through this function
// target: { id: uuid, type: 'user'/'team' }
const callCronofyFunction = async (ctx, { func, options, target, throwError = false }) => {
  let result;

  try {
    const { access_token: accessToken } = await helper.getExternalCalendarData(ctx, target);
    if (Array.isArray(options)) {
      result = await func({ options, accessToken });
    } else {
      result = await func({ ...options, accessToken });
    }
    checkForBatchCallErrors({ ctx, options, target, result, throwError });
  } catch (error) {
    if (error.statusCode === 401) {
      const { refresh_token } = await helper.getExternalCalendarData(ctx, target);
      logger.trace({ ctx, options, target }, 'refreshing the access token');
      const requestResult = await getCalendarOps().refreshAccessToken(ctx, refresh_token);
      await helper.saveAccessToken(ctx, target, requestResult);
      result = await func({ ...options, accessToken: requestResult.access_token });
    } else {
      logger.error({ ctx, options, target, error }, 'failed to call the cronofy function');
      if (throwError) throw error;
    }
  }

  return result;
};

const getInviteCommonOptions = ({ method, recipientsEmails, appointmentId, clientSecret, callbackUrl }) => ({
  smart_invite_id: appointmentId,
  client_secret: clientSecret,
  method,
  recipients: recipientsEmails.map(email => ({ email, status: 'accepted' })),
  callback_url: callbackUrl,
});

export const getCreateInviteOptions = ({
  appointment,
  clientSecret,
  externalCalendarRsvpNotificationUrl,
  recipientsEmails,
  summary,
  description,
  metadata,
  partyTimeZone,
  propertyAddress,
  organizer,
}) => ({
  ...getInviteCommonOptions({
    method: 'request',
    recipientsEmails,
    appointmentId: appointment.id,
    clientSecret,
    callbackUrl: externalCalendarRsvpNotificationUrl,
  }),
  event: {
    summary,
    description,
    start: metadata.startDate,
    end: metadata.endDate,
    tzid: partyTimeZone,
    location: {
      description: propertyAddress,
    },
  },
  organizer: {
    name: organizer,
  },
});

export const getCancelInviteOptions = ({ appointment, recipientsEmails, clientSecret, externalCalendarRsvpNotificationUrl }) =>
  getInviteCommonOptions({
    method: 'cancel',
    recipientsEmails,
    appointmentId: appointment.id,
    clientSecret,
    callbackUrl: externalCalendarRsvpNotificationUrl,
  });

const getSmartInvite = async (ctx, { appointment, propertyAddress, partyTimeZone, recipientsEmails, summary, description = '', organizer, type }) => {
  const { clientSecret, externalCalendarRsvpNotificationUrl } = await getCronofyConfigs(ctx);
  const { metadata } = appointment;

  switch (type) {
    case AppointmentEmailType.CREATE:
    case AppointmentEmailType.UPDATE: {
      const options = getCreateInviteOptions({
        appointment,
        clientSecret,
        externalCalendarRsvpNotificationUrl,
        recipientsEmails,
        summary,
        description,
        metadata,
        partyTimeZone,
        propertyAddress,
        organizer,
      });

      return await getCalendarOps().createSmartInvite(options);
    }
    case AppointmentEmailType.CANCEL: {
      const options = getCancelInviteOptions({ appointment, recipientsEmails, clientSecret, externalCalendarRsvpNotificationUrl });
      return await getCalendarOps().cancelSmartInvite(options);
    }
    default:
      logger.error({ ctx, appointment, type }, 'unknown type action on generating appointment invite');
      throw new Error(`Unknown type action ${type} on generating appointment invite'`);
  }
};

export const generateIcsSmartInvite = async (
  ctx,
  { appointment, propertyAddress, partyTimeZone, recipientsEmails, summary, description = '', organizer, type },
) => {
  logger.trace(
    { ctx, appointment, propertyAddress, partyTimeZone, recipientsEmails, summary, description, organizer, type },
    'generateIcsSmartInvite - params',
  );
  const smartInvite = await getSmartInvite(ctx, { appointment, propertyAddress, partyTimeZone, recipientsEmails, summary, description, organizer, type });

  return smartInvite.attachments.icalendar;
};

export const requestAccessToken = async (ctx, singleUseCode, id, type) => {
  logger.trace({ ctx, type, id }, 'requestAccessToken - input');

  const cronofyConfigs = await getCronofyConfigs(ctx);
  const requestResult = await getCalendarOps().requestAccessToken(ctx, singleUseCode, cronofyConfigs.delegatedAccessUrl);
  await helper.saveAccessToken(ctx, { id, type }, requestResult);

  logger.trace({ ctx, type, id }, 'requestAccessToken - done');
};

export const getUserExternalCalendars = async (ctx, userId) => {
  logger.trace({ ctx, userId }, 'getExternalCalendarsForUser - input');

  const funcParams = {
    func: getCalendarOps().getExternalCalendars,
    options: {},
    target: {
      id: userId,
      type: CalendarTargetType.USER,
    },
  };

  const calendars = await callCronofyFunction(ctx, funcParams);
  const filteredCalendars = calendars.filter(calendar => !calendar.calendar_deleted);
  logger.trace({ ctx, filteredCalendars }, 'getExternalCalendarsForUser - result');
  return filteredCalendars;
};

export const getTeamExternalCalendars = async (ctx, teamId) => {
  logger.trace({ ctx, teamId }, 'getExternalCalendarsForTeam - input');

  const funcParams = {
    func: getCalendarOps().getExternalCalendars,
    options: {},
    target: {
      id: teamId,
      type: CalendarTargetType.TEAM,
    },
  };

  const calendars = await callCronofyFunction(ctx, funcParams);
  const filteredCalendars = calendars.filter(calendar => !calendar.calendar_deleted);
  logger.trace({ ctx, filteredCalendars }, 'getExternalCalendarsForTeam - result');
  return filteredCalendars;
};

const getParamsForCreateCalendar = (externalCalendars, calendarName, target) => ({
  func: getCalendarOps().createRevaCalendar,
  options: {
    profile_id: externalCalendars.linking_profile.profile_id,
    name: calendarName,
    color: '#FF0000', // red
  },
  target,
  throwError: true,
});

const createCalendar = async (ctx, { externalCalendars, calendarNames, target }) => {
  try {
    const funcParams = getParamsForCreateCalendar(externalCalendars, calendarNames.primary, target);
    return await callCronofyFunction(ctx, funcParams);
  } catch (error) {
    logger.error({ ctx, error, externalCalendars, calendarNames, target }, 'failed to create the calendar');
    try {
      const funcParams = getParamsForCreateCalendar(externalCalendars, calendarNames.secondary, target);
      return await callCronofyFunction(ctx, funcParams);
    } catch (error2) {
      logger.error({ ctx, error2, externalCalendars, calendarNames, target }, 'failed to create the calendar (2nd attempt)');
      const funcParams = getParamsForCreateCalendar(externalCalendars, calendarNames.tertiary, target);
      return await callCronofyFunction(ctx, funcParams);
    }
  }
};

export const setCalendarPermissionToUnrestricted = async (ctx, calendar, target) => {
  if (calendar.permission_level === CalendarPermissionLevel.UNRESTRICTED) return;

  logger.trace({ ctx, calendarId: calendar.calendar_id }, 'setCalendarPermissionToUnrestricted');

  const funcParams = {
    func: getCalendarOps().setCalendarPermissionToUnrestricted,
    options: { calendarId: calendar.calendar_id },
    target,
  };

  await callCronofyFunction(ctx, funcParams);
  logger.trace({ ctx, calendarId: calendar.calendar_id }, 'setCalendarPermissionToUnrestricted - completed successfully');
};

export const createRevaUserCalendar = async (ctx, userId) => {
  logger.trace({ ctx, userId }, 'createRevaUserCalendar - input');
  const { externalCalendars } = await getUserById(ctx, userId);
  const calendarNames = helper.getRevaUserCalendarNames();

  const calendars = await getUserExternalCalendars(ctx, userId);
  const existingCalendar = helper.getExistingCalendar(calendarNames, calendars);

  if (existingCalendar) {
    await setCalendarPermissionToUnrestricted(ctx, existingCalendar, { id: userId, type: CalendarTargetType.USER });
    return existingCalendar.calendar_id;
  }

  const calendar = await createCalendar(ctx, { externalCalendars, calendarNames, target: { id: userId, type: CalendarTargetType.USER } });
  logger.trace({ ctx, userId, calendar }, 'createCalendarForAccount - result');
  return calendar.calendar_id;
};

export const createRevaTeamCalendar = async (ctx, teamId) => {
  logger.trace({ ctx, teamId }, 'createCalendarForTeamAccount - input');
  const { externalCalendars, displayName } = await getTeamById(ctx, teamId);
  const calendarNames = helper.getRevaTeamCalendarNames(displayName, externalCalendars.calendarName);

  const calendars = await getTeamExternalCalendars(ctx, teamId);
  const existingCalendar = helper.getExistingCalendar(calendarNames, calendars);

  if (existingCalendar) {
    await setCalendarPermissionToUnrestricted(ctx, existingCalendar, { id: teamId, type: CalendarTargetType.TEAM });
    return existingCalendar.calendar_id;
  }

  const calendar = await createCalendar(ctx, {
    externalCalendars,
    calendarNames,
    target: { id: teamId, type: CalendarTargetType.TEAM },
  });

  logger.trace({ ctx, teamId, calendar }, 'createCalendarForTeamAccount - result');
  return calendar.calendar_id;
};

const getNextPagesEvents = async (ctx, page, target) => {
  let personalEvents = [];

  const getEvents = async nextPage => {
    logger.trace({ ctx, page: nextPage }, 'getNextPagesEvents');

    const { next_page: nextPageUrl = '' } = nextPage;
    if (nextPageUrl) {
      const funcParams = {
        func: getCalendarOps().getEvents,
        options: {
          next_page: nextPageUrl,
        },
        target,
        throwError: true,
      };

      const { pages, events } = await callCronofyFunction(ctx, funcParams);
      personalEvents = [...personalEvents, ...events];
      pages.next_page && (await getEvents(pages));
    }
  };

  await getEvents(page);
  return personalEvents;
};

const getEventsForDates = async (ctx, { startDate, numberOfDays, calendarIds = [], target, extraOptions = {}, onlyBusyEvents = true }) => {
  const { from, to } = getDateRangeForSync(startDate, numberOfDays);

  const options = {
    calendar_ids: calendarIds,
    from,
    to,
    ...extraOptions,
  };
  const func = getCalendarOps().getEvents;

  const funcParams = {
    func,
    options,
    target,
    throwError: true,
  };

  const { pages, events } = await callCronofyFunction(ctx, funcParams);
  const nextPagesEvents = await getNextPagesEvents(ctx, pages, target);
  const allEvents = [...events, ...nextPagesEvents];

  return onlyBusyEvents ? allEvents.filter(e => e.free_busy_status === EventStatus.BUSY) : allEvents;
};

export const getEventsModifiedSinceDate = async (ctx, { target, calendarId, dateStringUTC }) => {
  logger.trace({ ctx, target, calendarId, dateStringUTC }, 'getEventsModifiedSinceDate');
  const extraOptions = {
    include_managed: true,
    last_modified: dateStringUTC,
    include_deleted: true,
    include_free: true,
  };

  // note: all full day events will come as dates but non full day events will come as datetime
  // all of them are saved in the database as datetime but the full day events are saved as midnight in UTC
  const events = await getEventsForDates(ctx, {
    startDate: dateStringUTC,
    numberOfDays: NUMBER_OF_DAYS_SYNC,
    calendarIds: [calendarId],
    target,
    extraOptions,
    onlyBusyEvents: false,
  });

  return events;
};

export const getEventsForUser = async (ctx, { userId, startDate, numberOfDays }) => {
  const empty = [];

  if (!(await isCalendarIntegrationEnabled(ctx))) return empty;
  logger.trace({ ctx, userId, startDate, numberOfDays }, 'getEventsForUser - input');

  const {
    externalCalendars: { primaryCalendarId },
  } = await getUserById(ctx, userId);
  if (!primaryCalendarId) return empty;

  const events = await getEventsForDates(ctx, {
    startDate,
    numberOfDays,
    calendarIds: [primaryCalendarId],
    target: { id: userId, type: CalendarTargetType.USER },
    onlyBusyEvents: true,
  });
  logger.trace({ ctx, userId, primaryCalendarId, numberOfEvents: events.length }, 'getEventsForUser - result');
  return events;
};

export const getEventsForTeam = async (ctx, { teamId, startDate, numberOfDays }) => {
  logger.trace({ ctx, teamId }, 'getEventsForTeam - input');

  const {
    externalCalendars: { teamCalendarId },
  } = await getTeamById(ctx, teamId);
  if (!teamCalendarId) return [];

  const events = await getEventsForDates(ctx, {
    startDate,
    numberOfDays,
    calendarIds: [teamCalendarId],
    target: { id: teamId, type: CalendarTargetType.TEAM },
    onlyBusyEvents: true,
  });
  logger.trace({ ctx, teamId, teamCalendarId, numberOfEvents: events.length }, 'getEventsForTeam - result');
  return events;
};

const constructEventData = async (ctx, { appointment, propertyAddress = '', actionType = 'add' }) => {
  const userId = appointment.userIds[0];
  const {
    externalCalendars: { revaCalendarId },
  } = await getUserById(ctx, userId);
  if (!revaCalendarId) return {};
  logger.trace({ ctx, appointment, actionType, propertyAddress }, 'adding event to external calendar');

  const description = await helper.getExternalCalendarEventDescription(ctx, appointment);
  const timezone = await getTimezoneForParty(ctx, appointment.partyId);

  return {
    eventId: appointment.id,
    event_id: appointment.id,
    calendarId: revaCalendarId,
    description,
    start: appointment.metadata.startDate,
    end: appointment.metadata.endDate,
    tzid: timezone,
    summary: await helper.getCalendarSummary(ctx, appointment),
    location: {
      description: propertyAddress,
    },
  };
};

export const createEvent = async (ctx, { appointment, propertyAddress = '', actionType = 'add' }) => {
  try {
    if (!(await isCalendarIntegrationEnabled(ctx))) return;

    const userId = appointment.userIds[0];
    const eventData = await constructEventData(ctx, { appointment, propertyAddress, actionType });
    if (!eventData.calendarId) return;

    const funcParams = {
      func: getCalendarOps().createEvent,
      options: eventData,
      target: {
        id: userId,
        type: CalendarTargetType.USER,
      },
    };

    await callCronofyFunction(ctx, funcParams);

    logger.trace({ ctx, appointment, userId, actionType }, 'event added successfully to external calendar');
  } catch (error) {
    logger.error({ ctx, appointment, actionType, error }, 'failed to add event to the external calendar');
  }
};
/*
example response for batch call
{
"batch": [
  { "status": 202 },
  {
    "status": 422,
    "data": {
      "errors": {
        "summary": [
          { "key": "errors.required", "description": "summary must be specified" }
        ]
      }
    }
  }
]
}

When an OAuth refresh_token is available then it should be used to request a replacement auth_token before the request is retried.
*/
const callbatchEventsFunction = async (ctx, data, userId) => {
  logger.trace({ ctx, data }, 'calling cronofy batch for data');
  const funcParams = {
    func: getCalendarOps().batchOperations,
    options: data,
    target: {
      id: userId,
      type: CalendarTargetType.USER,
    },
  };

  await await callCronofyFunction(ctx, funcParams);
  logger.trace({ ctx, data }, 'finished calling cronofy batch for data');
};

export const createSickLeaveEvent = async (ctx, sickLeave, calendarId) => {
  try {
    if (!(await isCalendarIntegrationEnabled(ctx))) return;
    logger.trace({ ctx, sickLeave, calendarId }, 'createSickLeaveEvent - input');
    const eventData = {
      eventId: sickLeave.id,
      calendarId,
      description: sickLeave.metadata.notes,
      start: sickLeave.startDate,
      end: sickLeave.endDate,
      tzid: sickLeave.metadata.timezone,
      summary: 'Sick leave',
    };

    const userId = sickLeave.userId;

    const funcParams = {
      func: getCalendarOps().createEvent,
      options: eventData,
      target: {
        id: userId,
        type: CalendarTargetType.USER,
      },
    };

    await callCronofyFunction(ctx, funcParams);

    logger.trace({ ctx, sickLeave, userId }, 'sickLeave added successfully to external calendar');
  } catch (error) {
    logger.error({ ctx, sickLeave, error }, 'failed to add sickLeave to the external calendar');
  }
};

export const bulkCreateEvents = async (ctx, appointments) => {
  if (!(await isCalendarIntegrationEnabled(ctx)) || appointments.length === 0) return;

  logger.trace({ ctx, appointments }, 'bulkCreateEvents - start');
  const userId = appointments[0].userIds[0];
  const {
    externalCalendars: { primaryCalendarId },
  } = await getUserById(ctx, userId);

  if (!primaryCalendarId) return;
  let requests = [];
  await mapSeries(appointments, async appointment => {
    // the batch endpoint allowes up to 50 requests at once
    if (requests.length === 50) {
      await callbatchEventsFunction(ctx, requests, userId);
      requests = [];
    }
    const propertyAddress = await getAppointmentAddress(ctx, appointment);
    const data = await constructEventData(ctx, { appointment, propertyAddress });
    const item = {
      method: 'POST',
      relative_url: `/v1/calendars/${data.calendarId}/events`,
      data,
    };
    requests = [...requests, item];
  });

  if (requests.length > 0) {
    await callbatchEventsFunction(ctx, requests, userId);
  }
  logger.trace({ ctx, appointments }, 'bulkCreateEvents - end');
};

export const updateEvent = async (ctx, { appointment, propertyAddress }) => await createEvent(ctx, { appointment, propertyAddress, actionType: 'update' });

const getFuncParamsForRemoveEvent = ({ userId, calendarId, eventId, isExternalEvent }) => {
  const eventData = {
    calendarId,
    eventId,
  };

  return {
    func: isExternalEvent ? getCalendarOps().removeExternalEvent : getCalendarOps().removeEvent,
    options: eventData,
    target: {
      id: userId,
      type: CalendarTargetType.USER,
    },
  };
};

export const removeEventByAppointment = async (ctx, appointment) => {
  const appointmentId = appointment.id;
  try {
    if (!(await isCalendarIntegrationEnabled(ctx))) return;
    logger.trace({ ctx, appointmentId }, 'removing event by appointment id');

    const userId = appointment.userIds[0];
    const {
      externalCalendars: { revaCalendarId },
    } = await getUserById(ctx, userId);

    if (!revaCalendarId) return;

    logger.trace({ ctx, appointmentId }, 'removing event by appointment id');
    const funcParams = getFuncParamsForRemoveEvent({ userId, calendarId: revaCalendarId, eventId: appointmentId, isExternalEvent: false });
    await callCronofyFunction(ctx, funcParams);

    logger.trace({ ctx, appointmentId, userId }, 'event removed successfully from the external calendar');
  } catch (error) {
    logger.error({ ctx, appointmentId, error }, 'failed to remove event from the external calendar');
  }
};

export const removeEventByExternalId = async (ctx, calendarId, externalId) => {
  if (!(await isCalendarIntegrationEnabled(ctx))) return;
  logger.trace({ ctx, calendarId, externalId }, 'removing event by external id');

  const users = await getUsers(ctx);
  const eventUser = users.find(item => item.externalCalendars.revaCalendarId === calendarId);
  const funcParams = getFuncParamsForRemoveEvent({ userId: eventUser.id, calendarId, eventId: externalId, isExternalEvent: true });
  await callCronofyFunction(ctx, funcParams);

  logger.trace({ ctx, calendarId, externalId }, 'event removed successfully from the external calendar');
};

export const removeEventByEventId = async (ctx, { userId, eventId, calendarId }) => {
  try {
    if (!(await isCalendarIntegrationEnabled(ctx))) return;
    logger.trace({ ctx, eventId }, 'removing event by event id');

    const funcParams = getFuncParamsForRemoveEvent({ userId, calendarId, eventId, isExternalEvent: false });
    await callCronofyFunction(ctx, funcParams);

    logger.trace({ ctx, eventId, userId }, 'event removed successfully from the calendar');
  } catch (error) {
    logger.error({ ctx, eventId, error }, 'failed to remove event from the calendar');
  }
};

export const createNotificationChannel = async (ctx, { targetId, targetType, calendarId, notificationUrl }) => {
  logger.trace({ ctx, targetId, targetType, calendarId, notificationUrl }, 'createNotificationChannel - input');

  const channelData = {
    calendarId,
    notificationUrl,
  };

  const funcParams = {
    func: getCalendarOps().createNotificationChannel,
    options: channelData,
    target: {
      id: targetId,
      type: targetType,
    },
  };

  const channel = await callCronofyFunction(ctx, funcParams);
  logger.trace({ ctx, targetId, targetType, calendarId, channel }, 'notification channel created successfully');
  return channel;
};

export const closeNotificationChannels = async (ctx, userId) => {
  logger.trace({ ctx, userId }, 'closeNotificationChannels - input');

  const {
    externalCalendars: { notificationChannels, account_id },
  } = await getUserById(ctx, userId);

  if (!notificationChannels?.length) {
    logger.trace({ ctx, userId }, 'there are no notification channels for the user');
    return;
  }

  await mapSeries(notificationChannels, async notificationChannel => {
    logger.trace({ ctx, userId, account_id, notificationChannel }, 'closing notification channel for user');
    const channelData = {
      channelId: notificationChannel.channel.channel_id,
    };

    const funcParams = {
      func: getCalendarOps().closeNotificationChannel,
      options: channelData,
      target: {
        id: userId,
        type: CalendarTargetType.USER,
      },
    };

    await callCronofyFunction(ctx, funcParams);
    logger.trace({ ctx, userId, notificationChannel }, 'notification channel closed successfully');
  });
};

const bulkRemoveEvents = async (ctx, user) => {
  const userId = user.id;
  try {
    logger.trace({ ctx, userId }, 'removing events from the external calendar');
    const {
      externalCalendars: { revaCalendarId },
    } = user;
    if (revaCalendarId) {
      const eventData = { calendarIds: [revaCalendarId] };
      const funcParams = {
        func: getCalendarOps().removeAllEvents,
        options: eventData,
        target: {
          id: userId,
          type: CalendarTargetType.USER,
        },
      };
      await callCronofyFunction(ctx, funcParams);
      logger.trace({ ctx, userId }, 'events removed successfully from the external calendar');
    } else {
      logger.trace({ ctx, userId }, 'external calendar already removed from user');
    }
  } catch (error) {
    logger.error({ ctx, userId, error }, 'failed to remove events from the external calendar');
  }
};

const revokeAuthorization = async (ctx, target) => {
  logger.trace({ ctx, target }, 'revoking the authorization for account');

  try {
    const { refresh_token: refreshToken } = await helper.getExternalCalendarData(ctx, target);

    if (refreshToken) {
      const { clientId, clientSecret } = await getCronofyConfigs(ctx);

      const options = { clientId, clientSecret, refreshToken };
      await getCalendarOps().revokeAuthorization(options);
      logger.trace({ ctx, target }, 'authorization revoked successfully');
    } else {
      logger.trace({ ctx, target }, 'cannot revoke the authorization - missing refresh_token');
    }
  } catch (error) {
    logger.error({ ctx, target, error }, 'failed to revoke the authorization ');
  }
};

const revokeAuthorizationForUser = async (ctx, userId) => await revokeAuthorization(ctx, { type: CalendarTargetType.USER, id: userId });
const revokeAuthorizationForTeam = async (ctx, teamId) => await revokeAuthorization(ctx, { type: CalendarTargetType.TEAM, id: teamId });

export const externalCalendarCleanupForTeam = async (ctx, team, delta) => {
  logger.trace({ ctx, teamId: team.id, delta }, 'externalCalendarCleanupForTeam - params');
  const calendarAccountToRevoke = team.externalCalendars.oldCalendarAccount || team.externalCalendars.calendarAccount;

  // we can have multiple teams using the same account, so we should revoke the authorization only if the account is used by a single team
  const teamsUsingSameAccount = await getTeamsUsingCalendarAccount(ctx, calendarAccountToRevoke);
  if (teamsUsingSameAccount.length === 1) {
    await revokeAuthorizationForTeam(ctx, team.id);
  } else {
    logger.trace({ ctx, teamId: team.id, delta }, 'calendarAccount is used by other teams');
  }

  await updateTeam(ctx, team.id, delta);
  await removeTeamEventsByTeamId(ctx, team.id);

  logger.trace({ ctx, teamId: team.id, delta }, 'externalCalendarCleanupForTeam - done');
};

export const externalCalendarDetachForTeam = async (ctx, team, delta) => {
  logger.trace({ ctx, teamId: team.id, delta }, 'externalCalendarDetachForTeam - params');

  await updateTeam(ctx, team.id, delta);
  await removeTeamEventsByTeamId(ctx, team.id);

  logger.trace({ ctx, teamId: team.id, delta }, 'externalCalendarDetachForTeam - done');
};

export const externalCalendarCleanupForUser = async (ctx, user, delta) => {
  const {
    externalCalendars: { revaCalendarId },
  } = user;
  if (!revaCalendarId) return;
  try {
    logger.trace(
      { ctx, userId: user.id, calendarAccount: user.externalCalendars.calendarAccount || user.externalCalendars.oldCalendarAccount },
      'starting external calendars cleanup for user',
    );
    await bulkRemoveEvents(ctx, user);
    await closeNotificationChannels(ctx, user.id);
    await revokeAuthorizationForUser(ctx, user.id);
    await removeAllExternalUserEvents(ctx, user.id);
    await updateUser(ctx, user.id, delta);
    logger.trace({ ctx }, 'external calendar cleanup successfully done for user ', user.id);
  } catch (error) {
    logger.error(
      { ctx, error, userId: user.id, calendarAccount: user.externalCalendars.calendarAccount || user.externalCalendars.oldCalendarAccount },
      'failed to cleanup calendar account for user',
    );
  }
};

export const bulkRemoveEventsAllUsers = async ctx => {
  if (!(await isCalendarIntegrationEnabled(ctx))) return;
  const users = await getUsers(ctx);
  const usersWithExternalCalendars = users.filter(u => u.externalCalendars.calendarAccount && u.externalCalendars.revaCalendarId);

  await promiseMap(usersWithExternalCalendars, async user => await externalCalendarCleanupForUser(ctx, user, { externalCalendars: {} }), {
    concurrency: MAX_CONCURRENT_REQUESTS,
  });
};
