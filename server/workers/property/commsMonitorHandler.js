/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { now, parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { getIncomingCommunicationsStats } from '../../dal/communicationRepo';

const logger = loggerModule.child({ subType: 'commsMonitor' });

const TIMEZONE = 'America/Los_Angeles';

const shouldCheckComms = () => {
  const _now = now({ timezone: TIMEZONE });
  const morning = parseAsInTimezone('10:30:00', { format: 'H:m:s', timezone: TIMEZONE });
  const afternoon = parseAsInTimezone('17:00:00', { format: 'H:m:s', timezone: TIMEZONE });

  return _now.isBetween(morning, afternoon);
};

const hasAtLeastOneCommTypeMissing = commStats => Object.keys(commStats).reduce((acc, key) => (!acc && !commStats[key] ? true : acc), false);

export const commsMonitor = async ctx => {
  logger.time({ ctx }, 'Recurring Jobs - Running commsMonitor duration');

  if (shouldCheckComms()) {
    logger.trace({ ctx }, 'Checking tenant incoming communications');
    const commStats = await getIncomingCommunicationsStats(ctx);
    const level = hasAtLeastOneCommTypeMissing(commStats) ? 'warn' : 'info';
    logger[level]({ ctx, commStats }, 'Tenant incoming communications stats');
  }

  logger.timeEnd({ ctx }, 'Recurring Jobs - Running commsMonitor duration');
  return { processed: true };
};
