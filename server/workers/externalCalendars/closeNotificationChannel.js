/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { admin } from '../../common/schemaConstants';
import { closePool, knex } from '../../database/factory';
import { getUsers, updateUser } from '../../dal/usersRepo';
import { closeNotificationChannels, createNotificationChannel } from '../../services/externalCalendars/cronofyService';
import { getNotificationUrlForUser } from './accountIntegrationSetupHandler';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';

const logger = loggerModule.child({ subType: 'closeNotificationChannel' });

const getTenantContext = async () => {
  const tenantName = process.argv[2];
  if (!tenantName) {
    logger.error(`Usage: close_notification_channel.sh ${tenantName}`);
    return {};
  }
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    logger.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantCtx = await getTenantContext();
  const users = await getUsers(tenantCtx);
  const usersWithExternalCalendars = users.filter(u => u.externalCalendars.calendarAccount && u.externalCalendars.revaCalendarId);
  await mapSeries(usersWithExternalCalendars, async user => {
    const { notificationChannels, ...rest } = user.externalCalendars;
    if (notificationChannels) {
      await closeNotificationChannels(tenantCtx, user.id);

      const revaCalNotificationChannel = await createNotificationChannel(tenantCtx, {
        targetId: user.id,
        targetType: CalendarTargetType.USER,
        calendarId: user.externalCalendars.revaCalendarId,
        notificationUrl: await getNotificationUrlForUser(tenantCtx, user.id, false),
      });

      const primaryCalNotificationChannel = await createNotificationChannel(tenantCtx, {
        targetId: user.id,
        targetType: CalendarTargetType.USER,
        calendarId: user.externalCalendars.primaryCalendarId,
        notificationUrl: await getNotificationUrlForUser(tenantCtx, user.id, true),
      });

      const delta = {
        ...rest,
        notificationChannels: [primaryCalNotificationChannel, revaCalNotificationChannel],
      };
      await updateUser(tenantCtx, user.id, { externalCalendars: delta });
    }
  });
}
async function closeConns() {
  await closePool();
  await knex.destroy(); // close analytics connection
}

if (require.main === module) {
  main().then(closeConns).catch(closeConns);
}
