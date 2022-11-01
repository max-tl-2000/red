/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import {
  createJob,
  updateJobWithRetry,
  getJobsBy,
  saveJob,
  getProcessedJobsAfterTimeInterval,
  saveRecurringJob,
  getRecurringJobByName,
  disableRecurringJobsWithMigrationsTransactionByName,
  isRecurringJobActive,
  recurringJobKeys,
} from '../jobsRepo';
import { testCtx as ctx, createAUser } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';
import { getDBConnection } from '../../testUtils/setupTestGlobalContext';

const { Jobs, JobStatus } = DALTypes;

describe('dal/jobsRepo', () => {
  let user;
  let job;

  const expectedKeys = ['id', 'name', 'status', 'steps', 'metadata', 'category', 'createdBy', 'created_at', 'updated_at'];

  beforeEach(async () => {
    user = await createAUser();

    job = {
      name: 'Test Job',
      status: DALTypes.JobStatus.PENDING,
      category: DALTypes.JobCategory.MigrateData,
      steps: {
        step1: {
          status: DALTypes.JobStatus.PENDING,
          filePath: 'filePath 1',
          result: 'job result 1',
        },
        step2: {
          status: DALTypes.JobStatus.IN_PROGRESS,
          filePath: 'filePath 2',
          result: 'job result 2',
        },
      },
      createdBy: user.id,
    };
  });

  describe('create a job', () => {
    it('has partial job entity in response', async () => {
      const result = await createJob(ctx, job);
      expect(result).to.have.all.keys(expectedKeys);
      expect(result.name).to.equal('Test Job');
      expect(result.status).to.equal(DALTypes.JobStatus.PENDING);
      expect(result.steps.step1.status).to.equal(DALTypes.JobStatus.PENDING);
      expect(result.steps.step2.status).to.equal(DALTypes.JobStatus.IN_PROGRESS);
      expect(result.steps.step1.filePath).to.equal(job.steps.step1.filePath);
      expect(result.steps.step2.filePath).to.equal(job.steps.step2.filePath);
      expect(result.steps.step1.result).to.equal(job.steps.step1.result);
      expect(result.steps.step2.result).to.equal(job.steps.step2.result);
      expect(result.createdBy).to.equal(user.id);
    });

    describe('given a job without optional fields', () => {
      it('job is created without the optional params', async () => {
        const job2 = {
          name: 'Test Job',
        };

        const result = await createJob(ctx, job2);
        expect(result.name).to.equal('Test Job');
        expect(result.status).to.equal(DALTypes.JobStatus.PENDING);
      });
    });
  });

  describe('given several jobs', () => {
    it('retrieves jobs based on filter', async () => {
      const job2 = {
        name: 'Test Job 2',
        status: DALTypes.JobStatus.PENDING,
        steps: {
          step1: {
            status: DALTypes.JobStatus.PENDING,
            filePath: 'filePath 1',
            result: 'job result 1',
          },
          step2: {
            status: DALTypes.JobStatus.IN_PROGRESS,
            filePath: 'filePath 2',
            result: 'job result 2',
          },
        },
        createdBy: user.id,
      };

      await createJob(ctx, job);
      await createJob(ctx, job2);

      const [result] = await getJobsBy(ctx, {
        status: DALTypes.JobStatus.PENDING,
      });
      expect(result.name).to.equal(job2.name);
    });
  });

  describe('update an existing job', () => {
    it('updates the entity', async () => {
      const createdJob = await createJob(ctx, job);

      const jobToUpdate = {
        name: 'updated Job',
        steps: {
          step1: {
            status: DALTypes.JobStatus.PROCESSED,
            filePath: 'updated filePath 1',
            result: 'updated job result 1',
          },
          step2: {
            status: DALTypes.JobStatus.FAILED,
            filePath: 'updated filePath 2',
            result: 'updated job result 2',
          },
        },
      };

      const result = await updateJobWithRetry(ctx, createdJob.id, jobToUpdate);
      expect(result[0].name).to.equal('updated Job');
      expect(result[0].steps.step1.status).to.equal(DALTypes.JobStatus.PROCESSED);
      expect(result[0].steps.step2.status).to.equal(DALTypes.JobStatus.FAILED);
      expect(result[0].steps.step1.filePath).to.equal('updated filePath 1');
      expect(result[0].steps.step2.filePath).to.equal('updated filePath 2');
    });

    it('updates the stepStatus', async () => {
      const createdJob = await createJob(ctx, job);

      const jobToUpdate = {
        steps: {
          step1: {
            status: DALTypes.JobStatus.PROCESSED,
          },
        },
      };

      const result = await updateJobWithRetry(ctx, createdJob.id, jobToUpdate);
      expect(result[0].steps.step1.status).to.equal(DALTypes.JobStatus.PROCESSED);
    });

    it('updates the filesPath', async () => {
      const createdJob = await createJob(ctx, job);

      const jobToUpdate = {
        steps: {
          step1: {
            filePath: 'new filePath for step1',
          },
          step2: {
            filePath: 'new filePath for step2',
          },
        },
      };

      const result = await updateJobWithRetry(ctx, createdJob.id, jobToUpdate);
      expect(result[0].steps.step1.filePath).to.equal('new filePath for step1');
      expect(result[0].steps.step2.filePath).to.equal('new filePath for step2');
    });

    it('updates the jobErrors field', async () => {
      const createdJob = await createJob(ctx, job);

      const jobToUpdate = {
        steps: {
          step1: {
            errors: [
              {
                column: 0,
                row: 2,
                comment: 'INVALID_TEAM_SPECIFIED_FOR_MEMBER',
                sheetName: 'Team Members',
              },
            ],
          },
        },
      };

      const result = await updateJobWithRetry(ctx, createdJob.id, jobToUpdate);
      const firstIgnoredRow = result[0].steps.step1.errors[0];
      expect(firstIgnoredRow.column).to.equal(0);
      expect(firstIgnoredRow.row).to.equal(2);
      expect(firstIgnoredRow.comment).to.equal('INVALID_TEAM_SPECIFIED_FOR_MEMBER');
    });

    it('updates a certain step', async () => {
      const createdJob = await createJob(ctx, job);
      const jobDetails = {
        step: 'step1',
      };

      const updated = await updateJobWithRetry(ctx, createdJob.id, {
        steps: {
          [jobDetails.step]: {
            status: 'status upd',
            result: 'result upd',
            errors: [
              {
                column: 0,
                row: 2,
                comment: 'INVALID_TEAM_SPECIFIED_FOR_MEMBER',
                sheetName: 'Team Members',
              },
            ],
          },
        },
      });

      expect(updated[0].steps.step1.status).to.equal('status upd');
      expect(updated[0].steps.step1.result).to.equal('result upd');
      expect(updated[0].steps.step1.errors.length).to.equal(1);
    });
  });

  const mockJobsParameters = [
    { name: Jobs.ImportRmsFiles, status: JobStatus.PROCESSED, delta: 12 },
    { name: Jobs.ImportRmsFiles, status: JobStatus.PENDING, delta: 5 },
    { name: Jobs.ImportRmsFiles, status: JobStatus.IN_PROGRESS, delta: 48 },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 8 },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 23 },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 72 },
  ];

  const updateJobStatus = async (jobToUpdate, delta, status) => {
    jobToUpdate.created_at = now().add(-delta, 'hours');
    jobToUpdate.status = status;
    return await saveJob(ctx, jobToUpdate);
  };

  const initJobsData = async () =>
    await Promise.all(
      mockJobsParameters.map(async jobParams => {
        const { name, delta, status } = jobParams;
        const createdJob = await saveJob(ctx, { name });
        return await updateJobStatus(createdJob, delta, status);
      }),
    );

  describe('given a set of jobs', () => {
    it('should return a list of jobs matching the default 24 hour timeframe', async () => {
      await initJobsData();
      let matchingJobs = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportRmsFiles);
      expect(matchingJobs).to.not.be.undefined;
      expect(matchingJobs.length).to.equal(1);

      matchingJobs = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportUpdateDataFiles);
      expect(matchingJobs).to.not.be.undefined;
      expect(matchingJobs.length).to.equal(2);
    });

    it('should return a list of jobs matching a custom timeframe', async () => {
      await initJobsData();
      const eightHourInterval = { interval: 8, timeframe: 'HOURS' };
      let matchingJobs = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportRmsFiles, eightHourInterval);
      expect(matchingJobs).to.not.be.undefined;
      expect(matchingJobs.length).to.equal(0);

      const twelveHourInterval = { interval: 12, timeframe: 'HOURS' };
      matchingJobs = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportUpdateDataFiles, twelveHourInterval);
      expect(matchingJobs).to.not.be.undefined;
      expect(matchingJobs.length).to.equal(1);
    });
  });
});

describe('dal/jobsRepo - RecurringJobs', () => {
  const jobName1 = 'Recurring Job 1';
  const recurringJob = {
    name: jobName1,
    lastRunAt: now().toJSON(),
    metadata: {},
    schedule: '0 */3 * * * *',
    timezone: 'America/Los_Angeles',
    notes: 'Run every 3 minutes',
    status: 'Idle',
  };

  describe('saveRecurringJob()', () => {
    it('should create a recurring job', async () => {
      await saveRecurringJob(ctx, recurringJob);

      const savedJob = await getRecurringJobByName(ctx, jobName1);
      expect(savedJob).to.have.all.keys(recurringJobKeys);
      expect(savedJob.name).to.equal(jobName1);
    });
  });

  describe('disableRecurringJobsWithMigrationsTransactionByName()', () => {
    it('should disable a list of recurring jobs', async () => {
      const jobName2 = 'Recurring Job 2';
      const jobName3 = 'Recurring Job 3';

      await saveRecurringJob(ctx, recurringJob);
      await saveRecurringJob(ctx, { ...recurringJob, name: jobName2 });
      await saveRecurringJob(ctx, { ...recurringJob, name: jobName3 });

      await disableRecurringJobsWithMigrationsTransactionByName(getDBConnection(), ctx, [jobName1, jobName3]);

      const isJob1Active = await isRecurringJobActive(ctx, jobName1);
      const isJob2Actve = await isRecurringJobActive(ctx, jobName2);
      const isJob3Active = await isRecurringJobActive(ctx, jobName3);
      expect(isJob1Active).to.equal(false);
      expect(isJob2Actve).to.equal(true);
      expect(isJob3Active).to.equal(false);

      const recurringJob1 = await getRecurringJobByName(ctx, jobName1);
      expect(recurringJob1).to.have.all.keys(recurringJobKeys);
      expect(recurringJob1.name).to.equal(jobName1);
      expect(recurringJob1.inactiveSince).to.not.be.null;

      const recurringJob2 = await getRecurringJobByName(ctx, jobName2);
      expect(recurringJob2).to.have.all.keys(recurringJobKeys);
      expect(recurringJob2.name).to.equal(jobName2);
      expect(recurringJob2.inactiveSince).to.be.null;

      const recurringJob3 = await getRecurringJobByName(ctx, jobName3);
      expect(recurringJob3).to.have.all.keys(recurringJobKeys);
      expect(recurringJob3.name).to.equal(jobName3);
      expect(recurringJob3.inactiveSince).to.not.be.null;
    });
  });
});
