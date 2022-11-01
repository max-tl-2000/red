/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { CalendarActionTypes, CalendarTargetType } from '../../common/enums/calendarTypes';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE } from './message-constants';
import { sendMessage } from '../services/pubsub';

const getAction = ({ excelCalendarAccount, dbCalendarAccount, excelCalendarName, dbCalendarName, hasCalendar }) => {
  const accountUpdated = excelCalendarAccount && dbCalendarAccount && excelCalendarAccount !== dbCalendarAccount;
  const accountAdded = excelCalendarAccount && (!dbCalendarAccount || !hasCalendar);
  const accountRemoved = !excelCalendarAccount && dbCalendarAccount && hasCalendar;
  const calendarRenamed =
    hasCalendar && excelCalendarAccount && dbCalendarAccount && excelCalendarAccount === dbCalendarAccount && !dbCalendarName && excelCalendarName;

  if (accountUpdated) return CalendarActionTypes.UPDATE_ACCOUNT;
  if (accountAdded) return CalendarActionTypes.ADD_ACCOUNT;
  if (accountRemoved) return CalendarActionTypes.REMOVE_ACCOUNT;
  if (calendarRenamed) return CalendarActionTypes.RENAME_CALENDAR;
  return CalendarActionTypes.NO_ACTION;
};

export const getActionForCalendarSync = (importEntity, dbEntity, hasCalendar) => {
  const excelCalendarAccount = (importEntity.calendarAccount || '').toLowerCase();
  const excelCalendarName = importEntity.calendarName || '';
  const dbCalendarAccount = dbEntity?.externalCalendars?.calendarAccount;
  const dbCalendarName = dbEntity?.externalCalendars?.calendarName;

  return getAction({ excelCalendarAccount, dbCalendarAccount, excelCalendarName, dbCalendarName, hasCalendar });
};

const getExternalCalendarsForNewItem = (calendarAccount, calendarName) => (calendarAccount ? { calendarAccount, calendarName } : {});

const getExternalCalendarsForExistingItem = (calendarAccount, dbExternalCalendars, calendarName) => {
  if (!calendarAccount && !dbExternalCalendars.calendarAccount) return {}; // do nothing

  if (calendarAccount && !dbExternalCalendars.calendarAccount) return { ...dbExternalCalendars, calendarAccount, calendarName }; // add scenario

  return { ...dbExternalCalendars, calendarAccount, calendarName, oldCalendarAccount: dbExternalCalendars.calendarAccount }; // update/remove/rename calendar
};

export const getExternalCalendars = (calendarAccountValue, dbItem, calendarNameValue) => {
  const calendarAccount = (calendarAccountValue || '').trim().toLowerCase();
  const calendarName = (calendarNameValue || '').trim();
  return dbItem
    ? getExternalCalendarsForExistingItem(calendarAccount, dbItem.externalCalendars, calendarName)
    : getExternalCalendarsForNewItem(calendarAccount, calendarName);
};

export const addMessage = async (ctx, action, userExternalUniqueId) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.PERFORM_ACTIONS_ON_CALENDAR_ACCOUNT,
    message: {
      tenantId: ctx.tenantId,
      action,
      userExternalUniqueId,
      entityType: CalendarTargetType.USER,
    },
    ctx,
  });
