/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { isCalendarIntegrationEnabled } from '../../services/externalCalendars/cronofyService';
import { syncCalendarEvents as syncEvents } from '../../services/calendarEvents';
const logger = loggerModule.child({ subType: 'syncCalendarEventsHandler' });
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { getMissingRevaEvents } from '../../dal/calendarEventsRepo';

// check if there are any appointments without a corresponding event in UserCalendarEvents table
const checkForMissingRevaEvents = async ctx => {
  logger.trace({ ctx }, 'checkForMissingRevaEvents - start');

  const missingEvents = await getMissingRevaEvents(ctx);
  missingEvents.length && logger.error({ ctx, missingEvents }, 'checkForMissingRevaEvents - error');

  logger.trace({ ctx }, 'checkForMissingRevaEvents - done');
};

export const syncCalendarEvents = async payload => {
  const { msgCtx, tenantId } = payload;
  const ctx = { tenantId, ...msgCtx };

  logger.time({ ctx, payload }, 'Recurring Jobs - syncCalendarEvents duration');

  let processed;
  const isIntegrationEnabled = await isCalendarIntegrationEnabled(ctx);

  try {
    isIntegrationEnabled && (await syncEvents(ctx));
    await checkForMissingRevaEvents(ctx);
    processed = true;
    logger.trace({ ctx }, 'syncCalendarEvents - done');
  } catch (error) {
    logger.error({ ctx, error }, 'syncCalendarEvents - error');
    processed = false;
  } finally {
    isIntegrationEnabled &&
      notify({
        ctx,
        event: eventTypes.SYNC_CALENDAR_DATA_COMPLETED,
        data: { successfully: processed, token: processed ? 'SUCCESSFULL_EXTERNAL_CALENDAR_DATA_SYNC' : 'FAILED_EXTERNAL_CALENDAR_DATA_SYNC' },
      });
  }

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - syncCalendarEvents duration');

  return { processed };
};
