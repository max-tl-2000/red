/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EventStatus, NotificationType } from '../../../../common/enums/calendarTypes';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { getRecurringJobByName } from '../../../dal/jobsRepo';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'externalCalendarEventUpdatedHandler' });

export const eventShouldBeIgnored = ({ freeBusyStatus, startDate, endDate }) => {
  const isFreeEvent = freeBusyStatus !== EventStatus.BUSY;
  const hasNoDuration = startDate === endDate;
  return isFreeEvent || hasNoDuration;
};

export const notificationShouldBeIgnored = ({ ctx, notificationData, calendarId, entityId, targetType }) => {
  if (!calendarId) {
    logger.trace({ ctx, notificationData, entityId, targetType }, 'Calendar account has already been removed but notification channel is still open');
    return true;
  }
  if (notificationData.type !== NotificationType.CHANGE) {
    logger.trace({ ctx, notificationData }, 'ignoring notification');
    return true;
  }
  return false;
};

export const getChangesSince = async (ctx, notificationChangeDateUtc) => {
  const { lastRunAt } = await getRecurringJobByName(ctx, DALTypes.Jobs.SyncExternalCalendarEvents);
  const lastRunAtUtc = toMoment(lastRunAt, { timezone: 'UTC' });

  if (toMoment(notificationChangeDateUtc).isBefore(lastRunAtUtc, 'second')) {
    logger.trace(
      { ctx, notificationChangeDateUtc, lastRunAtUtc: lastRunAtUtc.format() },
      'use SyncExternalCalendarEvents.lastRunAt instead of notificationChangeDateUtc',
    );
    return lastRunAtUtc.format();
  }

  return notificationChangeDateUtc;
};
