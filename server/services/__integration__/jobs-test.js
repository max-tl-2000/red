/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { saveRecurringJob, isRecurringJobActive } from '../jobs';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { now } from '../../../common/helpers/moment-utils';
import { testCtx as ctx } from '../../testUtils/repoHelper';
import { saveRecurringJob as saveJob, recurringJobKeys, removeRecurringJob } from '../../dal/jobsRepo';

describe('jobs-test', () => {
  let jobResult;
  afterEach(async () => {
    if (jobResult) {
      await removeRecurringJob(ctx, { id: jobResult.id });
      jobResult = null;
    }
  });
  describe('recurringJobs selects', () => {
    describe('for inactivity status', () => {
      it('it should return true if the job is active', async () => {
        const jobName = 'Active Job';
        jobResult = await saveJob(ctx, { name: jobName, inactiveSince: null });
        const result = await isRecurringJobActive(ctx, jobName);
        expect(result).to.be.true;
      });

      it('it should return false if the job is inactive', async () => {
        const jobName = 'Inactive Job';
        jobResult = await saveJob(ctx, { name: jobName, inactiveSince: now().toJSON() });
        const result = await isRecurringJobActive(ctx, jobName);
        expect(result).to.be.false;
      });

      it('it should return false if the job does not exist', async () => {
        jobResult = await saveJob(ctx, { name: 'Recurring Job', inactiveSince: now().toJSON() });
        const result = await isRecurringJobActive(ctx, 'Non existing job');
        expect(result).to.be.false;
      });
    });
  });

  describe('recurringJobs updates', () => {
    describe('saving a recurring job', () => {
      let job;
      beforeEach(() => {
        job = {
          name: 'new_job',
          lastRunAt: new Date(),
        };
      });

      describe('when no job with the same name exists', () => {
        it('should return the saved job', async () => {
          const result = (jobResult = await saveRecurringJob(tenant.id, new Date(), job));
          expect(result).to.have.all.keys(recurringJobKeys);
          expect(result.name).to.equals(job.name);
        });
      });

      describe('when a job with the same name already exists', () => {
        beforeEach(async () => {
          jobResult = await saveRecurringJob(tenant.id, new Date(), job);
        });

        it('should return undefined', async () => {
          const result = (jobResult = await saveRecurringJob(tenant.id, new Date(), job));
          expect(result).to.equal(undefined);
        });
      });
    });

    describe('update a recurring job', () => {
      beforeEach(async () => {
        jobResult = await saveRecurringJob(tenant.id, new Date(), {
          name: 'new_job_test_update',
          lastRunAt: new Date(),
        });
      });

      describe('when no update already occured', () => {
        it('update succeeds', async () => {
          const lastOccurence = jobResult.lastRunAt;
          const lastRunAt = new Date();
          jobResult.lastRunAt = lastRunAt;
          const result = await saveRecurringJob(tenant.id, lastOccurence, jobResult);
          expect(result).to.have.all.keys(recurringJobKeys);
          expect(result.name).to.equals(jobResult.name);
          expect(result.lastRunAt.toISOString()).to.equals(lastRunAt.toISOString());
        });
      });

      describe('when a job update occured', () => {
        it('should return undefined', async () => {
          const lastOccurence = jobResult.lastRunAt;
          const lastRunAt = new Date();
          jobResult.lastRunAt = lastRunAt;
          const result = await saveRecurringJob(tenant.id, lastOccurence, jobResult);
          expect(result.name).to.equals(jobResult.name);

          const secondUpdateResult = await saveRecurringJob(tenant.id, lastOccurence, jobResult);
          expect(secondUpdateResult).to.equals(undefined);
        });
      });
    });
  });
});
