/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getRecurringJobByName, getJobsInProgressByName, getPendingJobsByName } from '../jobs';
import { DALTypes } from '../../../common/enums/DALTypes';

export const jobIsInProgress = async (ctx, name) => {
  const { status: recurringJobStatus } = await getRecurringJobByName(ctx, name);
  const jobsInProgress = await getJobsInProgressByName(ctx, name);
  const pendingJobs = await getPendingJobsByName(ctx, name);
  return recurringJobStatus === DALTypes.JobStatus.IN_PROGRESS || jobsInProgress.length || pendingJobs.length;
};
