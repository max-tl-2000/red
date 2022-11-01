/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createJob } from '../../../dal/jobsRepo';
import { testCtx as ctx, createAnAdminUser } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe('API/jobs', () => {
  let adminUser;
  let adminAuthHeader;
  let job;

  beforeEach(async () => {
    adminUser = await createAnAdminUser({ tenantId: tenant.id });
    adminAuthHeader = getAuthHeader(tenant.id, adminUser.id);

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
      createdBy: adminUser.id,
    };
  });

  describe('when the jobs endpoint is called', () => {
    it('should return 401 when no auth token is passed', async () => {
      await request(app).get('/jobs').expect(401);
    });

    it('should return 403 when user is not authorized', async () => {
      await request(app).get('/jobs').set(getAuthHeader()).expect(403);
    });

    it('should respond with 400 and INVALID_JOB_ID token when an invalid job id is specified', async () => {
      await request(app)
        .get('/jobs/123456')
        .set(adminAuthHeader)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_JOB_ID'));
    });
  });

  describe('given several jobs', () => {
    it('retrieves all the jobs', async () => {
      const job2 = {
        name: 'Test Job 2',
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
        createdBy: adminUser.id,
      };

      await createJob(ctx, job);
      await createJob(ctx, job2);

      const result = await request(app).get('/jobs').set(adminAuthHeader);

      expect(result.status).to.equal(200);
      expect(result.body.length).to.equal(2);
      expect(result.body[0].name).to.equal('Test Job 2');
      expect(result.body[1].name).to.equal('Test Job');
    });

    it('retrieves a certain job', async () => {
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
        createdBy: adminUser.id,
      };

      await createJob(ctx, job);
      const jobToTest = await createJob(ctx, job2);

      const result = await request(app).get(`/jobs/${jobToTest.id}`).set(adminAuthHeader);

      expect(result.status).to.equal(200);
      expect(result.body.name).to.equal('Test Job 2');
      expect(result.body.createdBy).to.equal(adminUser.id);
    });
  });
});
