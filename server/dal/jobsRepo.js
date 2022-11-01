/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import mergeWith from 'lodash/mergeWith';
import newId from 'uuid/v4';
import { initQuery, insertInto, update, rawStatement, updateJSONBField, insertOrUpdate } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';
import { prepareRawQuery } from '../common/schemaConstants';

const logger = loggerModule.child({ subtype: 'jobsRepo' });

export const recurringJobKeys = [
  'id',
  'name',
  'lastRunAt',
  'created_at',
  'updated_at',
  'metadata',
  'schedule',
  'timezone',
  'startDate',
  'endDate',
  'notes',
  'status',
  'inactiveSince',
];

export const getAllJobs = async (ctx, limit) => {
  let query = initQuery(ctx).from('Jobs').where({ category: DALTypes.JobCategory.MigrateData }).orderBy('created_at', 'desc');
  if (limit) {
    query = query.limit(limit);
  }

  return await query;
};

export const getJobsByCategory = async (ctx, category, limit) => {
  let query = initQuery(ctx).from('Jobs').where({ category }).orderBy('created_at', 'desc');
  if (limit) {
    query = query.limit(limit);
  }

  return await query;
};

export const getLastProcessedFiles = async ctx => {
  logger.trace({ ctx }, 'getLastProcessedFiles');

  const query = `SELECT metadata -> 'files' as "previousFiles" FROM db_namespace."Jobs"
      WHERE name = '${DALTypes.Jobs.ImportUpdateDataFiles}'
      AND status = '${DALTypes.JobStatus.PROCESSED}'
      ORDER BY created_at DESC
      LIMIT 1;`;

  const { rows } = await rawStatement(ctx, query);
  return rows[0] && rows[0].previousFiles;
};

export const getJobsBy = async (ctx, filter) => await initQuery(ctx).from('Jobs').where(filter).orderBy('created_at', 'desc');

export const getJobById = async (ctx, jobId) => await initQuery(ctx).from('Jobs').where({ id: jobId }).first();

export const createJob = async (ctx, body) => {
  const job = {
    ...body,
    status: DALTypes.JobStatus.PENDING,
  };

  return await insertInto(ctx, 'Jobs', job);
};

const customizer = (previousValue, nextValue) => {
  if (Array.isArray(previousValue)) {
    return nextValue || [];
  }
  return undefined;
};

const updateJob = async (ctx, query, delta, jobToUpdate) => await update(ctx.tenantId, 'Jobs', query, mergeWith(jobToUpdate, delta, customizer));

const updateJobById = async (ctx, jobId, delta) => {
  const jobToUpdate = await getJobById(ctx, jobId);
  return await updateJob(ctx, { id: jobId }, delta, jobToUpdate);
};

export const updateJobWithRetry = async (ctx, jobId, delta) => {
  let updatedJob;

  updatedJob = await updateJobById(ctx, jobId, delta);

  if (!updatedJob.length) {
    // this means that a conflict was detected and we need to retrigger the update.
    updatedJob = await updateJobById(ctx, jobId, delta);
  }

  return updatedJob;
};

export const saveJob = async (ctx, job) => (job.id ? await updateJobById(ctx, job.id, job) : await createJob(ctx, job));

export const getAllRecurringJobsLocked = async ctx => {
  const query = 'SELECT * FROM db_namespace."RecurringJobs" FOR UPDATE SKIP LOCKED';

  try {
    const { rows } = await rawStatement(ctx, query);
    return rows;
  } catch (err) {
    logger.warn({ ctx, err }, 'Cannot get all recurring jobs locked');
    return [];
  }
};

export const getAllRecurringJobs = async ctx => {
  const query = 'SELECT * FROM db_namespace."RecurringJobs"';

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getAllRecurringJobsInProgress = async ctx => {
  const query = 'SELECT * FROM db_namespace."RecurringJobs" where "status" = ?';
  const { rows } = await rawStatement(ctx, query, [DALTypes.JobStatus.IN_PROGRESS]);
  return rows;
};

export const getRecurringJobByName = async (ctx, name) => await initQuery(ctx).from('RecurringJobs').where({ name }).first();

export const saveRecurringJob = async (ctx, job) => await insertOrUpdate(ctx, 'RecurringJobs', job);

export const isRecurringJobActive = async (ctx, name) => {
  const query = 'SELECT "inactiveSince" FROM db_namespace."RecurringJobs" WHERE name = :name';
  const { rows = [] } = await rawStatement(ctx, query, [{ name }]);
  const { inactiveSince } = rows[0] || {};
  return inactiveSince === null;
};

export const disableRecurringJobsWithMigrationsTransactionByName = async (conn, ctx, names = []) => {
  const { trx, tenantId } = ctx;
  const query = prepareRawQuery('UPDATE db_namespace."RecurringJobs" SET "inactiveSince" = NOW() WHERE name = ANY(:names)', tenantId);
  return await conn.raw(query, { names }).transacting(trx || conn);
};

export const disableRecurringJobByName = async (ctx, name) =>
  await rawStatement(ctx, 'UPDATE db_namespace."RecurringJobs" SET "inactiveSince" = NOW() WHERE name = :name', [{ name }]);

export const updateRecurringJob = async (ctx, id, recurringJob) => await update(ctx.tenantId, 'RecurringJobs', { id }, recurringJob, ctx.trx);

export const removeAllDataFromRecurringJobs = async ctx => {
  const query = 'DELETE from db_namespace."RecurringJobs"';
  await rawStatement(ctx, query);
};

export const removeRecurringJob = async (ctx, { id } = {}) => {
  if (!id) throw new Error('id is required to remove a recurring job');
  const query = 'DELETE from db_namespace."RecurringJobs" where id = :id';
  await rawStatement(ctx, query, [{ id }]);
};

export const updateRecurringJobMetadata = async (ctx, id, updateObject) =>
  await mapSeries(
    Object.keys(updateObject),
    async key => await updateJSONBField({ ctx, table: 'RecurringJobs', field: 'metadata', tableId: id, key, value: updateObject[key] }),
  );

export const getProcessedJobsAfterTimeInterval = async (ctx, jobName, options = { interval: 24, timeframe: 'HOURS', failedJobs: false }) => {
  const { interval, timeframe, failedJobs } = options;
  const params = [{ jobName, processed: DALTypes.JobStatus.PROCESSED, failed: DALTypes.JobStatus.FAILED }];

  let query = `SELECT *
    FROM db_namespace."Jobs"
    WHERE name = :jobName
    AND created_at > NOW() - INTERVAL '${interval} ${timeframe}'`;

  const filter = !failedJobs ? 'status = :processed' : '(status = :processed OR status = :failed)';
  query = `${query} AND ${filter}`;

  const { rows } = await rawStatement(ctx, query, params);
  return rows;
};

export const updateRecurringJobStatus = async (ctx, id, status) => {
  const query = 'UPDATE db_namespace."RecurringJobs" SET status = :status WHERE "id" = :id;';
  const {
    rows: [job],
  } = await rawStatement(ctx, query, [{ id, status }]);
  return job;
};

export const storeFileWithChecksum = async (ctx, file) => {
  const query = `INSERT INTO db_namespace."ImportFilesChecksums"
                 (id, "filename", "checksum") VALUES
                 (:id, :filename, :checksum)`;
  await rawStatement(ctx, query, [
    {
      id: newId(),
      filename: file.originalName,
      checksum: file.checksum,
    },
  ]);
};

export const getAlreadyImportedFiles = async (ctx, checksums) => {
  const query = `SELECT DISTINCT filename, checksum
    FROM db_namespace."ImportFilesChecksums"
    WHERE checksum IN (${checksums.map(checksum => '?').join(',')})`; // eslint-disable-line

  const { rows } = await rawStatement(ctx, query, [checksums]);
  return rows;
};

export const markRecurringJobsInProgress = async (ctx, jobNames, lastRunAt) => {
  logger.trace({ ctx, jobNames, lastRunAt }, 'markRecurringJobsInProgress');

  const { rows } = await rawStatement(
    ctx,
    `UPDATE db_namespace."RecurringJobs"
      SET "lastRunAt" = :lastRunAt, status = :inProgressStatus
      WHERE ARRAY[name] <@ :jobNames
     RETURNING *`,
    [
      {
        jobNames,
        lastRunAt,
        inProgressStatus: DALTypes.JobStatus.IN_PROGRESS,
      },
    ],
  );

  return rows;
};

export const getAllRecurringJobsFromAdmin = async ctx => {
  const query = 'SELECT * FROM admin."RecurringJobs"';

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
