/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from './factory';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'DB_Monitor' });
const DB_LOCKS_THRESHOLD = 10;
const LOG_FIELD_MAX_LENGTH = 256;

const checkForLockedRequests = async ctx => {
  const query = 'SELECT * FROM public."monitor_locks"';

  const { rows } = await rawStatement(ctx, query);

  if (rows && rows.length >= DB_LOCKS_THRESHOLD) {
    rows.forEach(row => Object.keys(row).map(key => (row[key] = typeof row[key] === 'string' ? row[key].substring(0, LOG_FIELD_MAX_LENGTH) : row[key])));
    logger.error({ ctx, lockedRequests: rows }, 'DB_MONITOR locks detected');
  }
};

export const monitorDatabase = async msg => {
  const { msgCtx: ctx } = msg;

  logger.time({ ctx, msg }, 'Recurring Jobs - monitorDatabase duration');
  await checkForLockedRequests(ctx);
  logger.timeEnd({ ctx, msg }, 'Recurring Jobs - monitorDatabase duration');

  return { processed: true };
};
