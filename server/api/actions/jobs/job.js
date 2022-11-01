/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAllJobs as getAllJobsFromDb, getJobsByCategory, getJobsBy, getAllRecurringJobsInProgress } from '../../../dal/jobsRepo';
import { uuid as validateUuid } from '../../helpers/validators';
import { ServiceError } from '../../../common/errors';
import config from '../../../config';
import sleep from '../../../../common/helpers/sleep';
import loggerInstance from '../../../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'jobs' });

const { apiToken } = config;

export const getAllJobs = async req => {
  validateUuid(req.tenantId, 'INVALID_TENANT_ID');

  const { limit } = req.query;
  return await getAllJobsFromDb(req, limit);
};

export const getFilteredJobs = async req => {
  validateUuid(req.tenantId, 'INVALID_TENANT_ID');

  const { category, limit } = req.query;
  if (category) {
    return await getJobsByCategory(req, category, limit);
  }
  return await getAllJobsFromDb(req, limit);
};

export const getJobById = async req => {
  validateUuid(req.tenantId, 'INVALID_TENANT_ID');
  validateUuid(req.params.jobId, 'INVALID_JOB_ID');

  const [result] = await getJobsBy(req, { id: req.params.jobId });
  return result;
};

let executionOfRecurringJobsAllowed = true;

export const canExecuteRecurringJobs = () => executionOfRecurringJobsAllowed;

export const enableExecutionOfCurrentJobs = () => {
  executionOfRecurringJobsAllowed = true;
};

export const enableRecurringJobs = async req => {
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }

  enableExecutionOfCurrentJobs();
};

export const stopExecutionOfRecurringJobs = async (req, { waitBetweenChecks = 1000 } = {}) => {
  executionOfRecurringJobsAllowed = false;

  let inProgressJobs = [];

  do {
    inProgressJobs = await getAllRecurringJobsInProgress(req);
    logger.debug({ jobs: inProgressJobs }, `disableRecurringJobs: Found ${inProgressJobs.length} jobs running`);
    if (inProgressJobs.length === 0) break;
    logger.debug({ jobs: inProgressJobs }, `wating ${waitBetweenChecks}ms to check again if there are any jobs running`);
    await sleep(waitBetweenChecks); // wait for recurring jobs running to stop
  } while (inProgressJobs.length > 0);
};

export const disableRecurringJobs = async req => {
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }

  await stopExecutionOfRecurringJobs(req, { waitBetweenChecks: 500 });
};
