/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { read } from '../../../../common/helpers/xfs';
import {
  personId,
  application,
  rent,
  tenantId,
  applicationWithMissingNotRequiredElements,
  applicationWithMissingRequiredElements,
  applicationWithApplicantAndGuarantor,
  applicationWithExistingScreeningRequest,
} from '../../helpers/__tests__/fixtures/fadv-test-data';

const { mockModules } = require('test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
const { expect } = chai;

const DEFAULT_TEST_TIMEOUT = 10000;
const submissionRequestResult = {
  id: application.customRecords.screeningRequestId,
};
mockModules({
  '../../../../server/services/properties.js': {
    getPropertyById: jest.fn(() => ({
      name: 'Test Data - My Properties',
      settings: {
        screening: {
          propertyName: 'e94b3393-0ff3-55a7-0aed-1b56e450dd66',
        },
      },
    })),
  },
  '../../../../server/dal/tenantsRepo.js': {
    getTenantScreeningSettings: jest.fn(() => ({
      screening: {
        originatorId: '26694',
        username: 'Reuser1',
        password: 'Winter2016',
      },
    })),
  },
  '../../dal/fadv-submission-repo': {
    createSubmissionRequest: jest.fn(() => submissionRequestResult),
    updateSubmissionRequest: jest.fn(() => submissionRequestResult),
  },
  '../screening/screening-helper': {
    getPreviousTenantIdFromLatestNewRequest: jest.fn(ctx => ctx.tenantId),
  },
});

const createFadvRawRequest = require('../screening/screening-handler-request.ts').createFadvRawRequest; // eslint-disable-line global-require
describe('FADV Helper', () => {
  describe('FADV Helper load the xml request template', () => {
    it(
      'Should fill successfully the data into the xml request template',
      async () => {
        const ctx = { tenantId };
        const { rawRequest: result } = await createFadvRawRequest(ctx, personId, rent, application);
        expect(result).to.be.a('string');
        const mockFadvRequest = await read('./rentapp/server/helpers/__tests__/fixtures/fadv-request-template-test-missing-data.xml');
        expect(result).to.equal(mockFadvRequest.toString());
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });

  describe('FADV Helper load the xml request template', () => {
    it(
      'Should not include empty non required fields into the xml request template.',
      async () => {
        const ctx = { tenantId };
        const { rawRequest: result } = await createFadvRawRequest(ctx, personId, rent, applicationWithMissingNotRequiredElements);
        expect(result).to.be.a('string');
        expect(result).not.to.contain('MiddleName');
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });

  describe('FADV Helper load the xml request template', () => {
    it(
      'Should throw an error because a required field was not passed.',
      () => {
        const ctx = { tenantId };
        const p = createFadvRawRequest(ctx, personId, rent, applicationWithMissingRequiredElements);

        // when using chai-as-promised
        // always return the promise so the test can be resolved or rejected
        // without returning it the test is actually not testing what you might expect
        return expect(p).to.be.rejectedWith(Error, 'Cannot createFADVRequest due to missing applicant data.');
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });

  describe('FADV Helper load the xml request template', () => {
    it(
      'Should fill successfully the data into the xml request template when there are applicant and guarantor.',
      async () => {
        const ctx = { tenantId };
        const { rawRequest: result } = await createFadvRawRequest(ctx, personId, rent, applicationWithApplicantAndGuarantor);
        expect(result).to.be.a('string');
        const mockFadvRequest = await read('./rentapp/server/helpers/__tests__/fixtures/fadv-request-template-application-with-guarantor.xml');
        expect(result).to.equal(mockFadvRequest.toString());
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });

  describe('FADV Helper load the xml request template', () => {
    it(
      'Should fill successfully the data into the xml request template when there is an existing screeening response.',
      async () => {
        const ctx = { tenantId };
        const { rawRequest: fadvRequest } = await createFadvRawRequest(ctx, personId, rent, applicationWithExistingScreeningRequest, {
          requestType: 'Modify',
          reportId: applicationWithExistingScreeningRequest.externalId,
        });
        expect(fadvRequest).to.be.a('string');
        const mockFadvRequest = await read('./rentapp/server/helpers/__tests__/fixtures/fadv-request-template-test-modify-request.xml');
        expect(fadvRequest).to.equal(mockFadvRequest.toString());
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });
});
