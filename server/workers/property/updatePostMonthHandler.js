/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { getPropertiesToRollForwardPostMonth, getPropertyCloseScheduleByRollForwardDate } from '../../dal/propertyCloseScheduleRepo';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { updatePostMonth as updatePostMonthService } from '../../services/properties';
import { getRecurringJobByName } from '../../services/jobs';
import { updateRecurringJob } from '../../dal/jobsRepo';

const logger = loggerModule.child({ subType: 'updatePostMonthHandler' });

const getDataRange = lastSuccessfulRun => {
  const toDay = now({ timezone: 'UTC' });
  const fromDay = lastSuccessfulRun;
  return { fromDay, toDay };
};

const updatePostMonthProperty = async (ctx, { year, month, propertyId }) => {
  // This new Post Month date should be in format: 'M/D/YYYY', because it should have the same format as the PropertySetup
  const newPostMonth = `${month}/1/${year}`;
  logger.trace({ ctx, year, month, propertyId, newPostMonth }, 'updatePostMonthProperty');

  try {
    await updatePostMonthService(ctx, propertyId, newPostMonth);
    logger.info({ ctx, propertyId, newPostMonth }, 'updated PostMonth successfully');
  } catch (error) {
    logger.error({ ctx, propertyId, newPostMonth, error }, 'updated PostMonth error');
  }
};

export const updatePostMonth = async ({ msgCtx: ctx, jobInfo: { name: jobName } }) => {
  logger.time({ ctx, jobName }, 'Recurring Jobs - updatePostMonth duration');

  const recurringJob = await getRecurringJobByName(ctx, jobName);
  const lastSuccessfulRun = recurringJob.metadata.lastSuccessfulRun
    ? toMoment(recurringJob.metadata.lastSuccessfulRun, { timezone: 'UTC' })
    : now({ timezone: 'UTC' });

  logger.trace({ ctx, lastSuccessfulRun }, 'getPropertiesToRollForwardPostMonth');
  const { fromDay, toDay } = getDataRange(lastSuccessfulRun);

  const propertiesToRollForwardPostMonth = await getPropertiesToRollForwardPostMonth(ctx, fromDay, toDay);
  logger.trace({ ctx, fromDay, toDay, propertiesToRollForwardPostMonth }, 'getPropertiesToRollForwardPostMonth result');

  const updatePostMonthPropertyMapFunc = async ({ propertyId, rollForwardDate }) => {
    const [propertyCloseSchedule] = await getPropertyCloseScheduleByRollForwardDate(ctx, propertyId, rollForwardDate);
    logger.trace({ ctx, propertyId, propertyCloseSchedule }, 'getPropertyCloseScheduleByRollForwardDate result');
    return await updatePostMonthProperty(ctx, propertyCloseSchedule);
  };

  await mapSeries(
    propertiesToRollForwardPostMonth,
    async ({ propertyId, rollForwardDate }) => await updatePostMonthPropertyMapFunc({ propertyId, rollForwardDate }),
  );

  if (recurringJob) {
    await updateRecurringJob(ctx, recurringJob.id, { metadata: { ...recurringJob.metadata, lastSuccessfulRun: toDay } });
  }

  logger.timeEnd({ ctx, jobName }, 'Recurring Jobs - updatePostMonth duration');

  return { processed: true };
};

// Utility function to execute update post month update
// Usage:
// node_modules/.bin/babel-node server/workers/property/updatePostMonthHandler.js [tenantId]
async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.log('Missing tenantId');
    return;
  }

  console.log('Execute update post month handler ');
  await updatePostMonth({ msgCtx: { tenantId }, jobInfo: { name: 'UpdatePostMonth' } });
  console.log('Update post month handler executed');
}

if (require.main === module) {
  main().catch(e => {
    console.log(e.stack);
  });
}
