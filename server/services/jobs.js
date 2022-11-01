/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import { DALTypes } from '../../common/enums/DALTypes';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import * as repo from '../dal/jobsRepo';
import { knex, runInTransaction } from '../database/factory';
import { prepareRawQuery } from '../common/schemaConstants';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'services/jobs' });
import { getAdminUser } from '../dal/usersRepo';

export const createRecurringJob = async (req, jobDetails) => {
  if (!jobDetails) return null;
  logger.trace({ ctx: req }, 'createRecurringJob');

  return await repo.createJob(req, {
    name: jobDetails.name,
    category: DALTypes.JobCategory.Recurring,
    status: DALTypes.JobStatus.IN_PROGRESS,
  });
};

export const createJob = async (req, files, jobDetails) => {
  logger.trace({ ctx: req }, 'createJob');
  const { status = DALTypes.JobStatus.PENDING } = jobDetails;

  const userId = (req.authUser || {}).id;
  const jobToSave = {
    name: jobDetails.name,
    category: jobDetails.category,
    steps: {
      ...(jobDetails.step && {
        [jobDetails.step]: {
          status,
        },
      }),
    },
    createdBy: userId,
  };

  if (files && files.length) {
    jobToSave.metadata = { files };
  }

  const job = await repo.createJob(req, jobToSave);

  const adminUserId = userId || ((await getAdminUser({ tenantId: req.tenantId })) || {}).id;

  if (jobDetails.name !== DALTypes.Jobs.ImportCohortFiles) {
    notify({ ctx: req, event: eventTypes.JOB_CREATED, data: { jobCategory: job.category }, routing: { users: [adminUserId] } });
  }

  return job;
};

export const updateJob = async (tenantId, jobDetails, jobStatus, result, errors) => {
  if (!jobDetails) return;

  let steps;
  if (jobDetails.step) {
    steps = {
      [jobDetails.step]: {
        status: jobStatus,
        result,
        errors,
      },
    };
  }

  const ctx = { tenantId };
  await repo.updateJobWithRetry(ctx, jobDetails.id, {
    status: jobStatus,
    steps,
    metadata: jobDetails.metadata,
  });

  const notifyData = {
    id: jobDetails.id,
    name: jobDetails.name,
    status: jobStatus,
  };

  const adminUserId = jobDetails.createdBy || ((await getAdminUser(ctx)) || {}).id;
  if (jobDetails.name !== DALTypes.Jobs.ImportCohortFiles) {
    notify({ ctx, event: eventTypes.JOB_UPDATED, data: notifyData, routing: { users: [adminUserId] } });
  }
};

export const updateJobStatus = async (tenantId, jobId, jobStatus) => {
  if (!jobId) return;

  const ctx = { tenantId };
  const { name, status, createdBy } = await repo.updateJobWithRetry(ctx, jobId, {
    status: jobStatus,
  });

  const notifyData = {
    id: jobId,
    name,
    status,
  };

  const adminUserId = createdBy || ((await getAdminUser(ctx)) || {}).id;
  notify({ ctx, event: eventTypes.JOB_UPDATED, data: notifyData, routing: { users: [adminUserId] } });
};

export const addOrUpdateJobStep = async (tenantId, jobId, step, status) => {
  if (!jobId) return;

  const ctx = { tenantId };
  const { name, steps, createdBy } = await repo.getJobById(ctx, jobId);
  steps[step] = { status };
  await repo.updateJobWithRetry(ctx, jobId, { steps });

  const notifyData = {
    id: jobId,
    name,
  };

  const adminUserId = createdBy || ((await getAdminUser(ctx)) || {}).id;
  notify({ ctx, event: eventTypes.JOB_UPDATED, data: notifyData, routing: { users: [adminUserId] } });
};

export const markJobAsFailed = async (tenantId, job) => {
  if (!job) return;
  await updateJob(tenantId, job, DALTypes.JobStatus.FAILED);
};

export const markJobAsProcessed = async (tenantId, job) => {
  if (!job) return;
  await updateJob(tenantId, job, DALTypes.JobStatus.PROCESSED);
};

export const getJobsByName = async (ctx, name) => await repo.getJobsBy(ctx, { name });

export const getJobsInProgressByName = async (ctx, name) => repo.getJobsBy(ctx, { name, status: DALTypes.JobStatus.IN_PROGRESS });

export const getPendingJobsByName = async (ctx, name) => repo.getJobsBy(ctx, { name, status: DALTypes.JobStatus.PENDING });

export const isRecurringJobActive = async (ctx, name) => repo.isRecurringJobActive(ctx, name);

export const saveJob = async (ctx, job) => await repo.saveJobInDb(ctx, job);

export const saveRecurringJob = async (tenantId, lastOccurence, job) => {
  const { name, lastRunAt } = job;

  // insert if no existing job with the same name
  if (!job.id) {
    const query = prepareRawQuery(
      `INSERT INTO db_namespace."RecurringJobs" ("id", "name", "lastRunAt")
                   SELECT :id, :name, :lastRunAt
                   WHERE NOT EXISTS (
                        SELECT * FROM db_namespace."RecurringJobs" WHERE name = :name
                    ) RETURNING *`,
      tenantId,
      name,
      lastRunAt,
    );

    return await runInTransaction(async trx => {
      const result = await knex
        .raw(query, {
          id: v4(),
          name,
          lastRunAt,
        })
        .transacting(trx);
      return result.rows.length === 1 ? result.rows[0] : undefined;
    });
  }

  // update if lastRunAt matches lastOccurence one
  return await runInTransaction(async trx => {
    const query = prepareRawQuery(
      `UPDATE db_namespace."RecurringJobs"
        SET "lastRunAt" = :lastRunAt, status = :inProgressStatus
        WHERE "id" = (
          SELECT "id"
            FROM db_namespace."RecurringJobs"
            WHERE id = :id AND status = :idleStatus
            AND "lastRunAt" = :lastOccurence
            FOR UPDATE SKIP LOCKED
            LIMIT 1 
        )
       RETURNING *`,
      tenantId,
    );

    const result = await knex
      .raw(query, {
        lastRunAt,
        lastOccurence,
        id: job.id,
        inProgressStatus: DALTypes.JobStatus.IN_PROGRESS,
        idleStatus: DALTypes.JobStatus.IDLE,
      })
      .transacting(trx);
    return result.rows.length === 1 ? result.rows[0] : undefined;
  });
};

export const getRecurringJobByName = async (ctx, name) => repo.getRecurringJobByName(ctx, name);
