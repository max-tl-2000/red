/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import path from 'path';
import { readJSON } from '../../../../../common/helpers/xfs';

const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);

describe('Enable SSN Submission', () => {
  let buildApplicantsToEnableSsnSubmission;

  // revaApplicantid: sendSsnEnabled
  const applicantIdsHash = {
    '9834dc8a-fe8e-492f-b74b-962eb23dc386': false,
    '5850d06b-28af-4d3d-8010-26d7f30cb8ad': false,
    '50f690d7-2004-4ee9-815e-356794269c01': false,
  };

  const ssnSubmissionMocks = ids => ({
    getPersonApplicationsByApplicantIds: jest.fn((ctx, applicantIds) =>
      applicantIds.map(applicantId => ({
        id: newId(),
        applicantId,
        sendSsnEnabled: ids[applicantId],
      })),
    ),
    enableSSNSubmissionForApplicants: jest.fn(),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../dal/person-application-repo': {
        getPersonApplicationsByApplicantIds: mocks.getPersonApplicationsByApplicantIds,
        enableSSNSubmissionForApplicants: mocks.enableSSNSubmissionForApplicants,
      },
    });

    const screeningHelper = require('../screening-helper');  // eslint-disable-line
    buildApplicantsToEnableSsnSubmission = screeningHelper.buildApplicantsToEnableSsnSubmission;
  };

  const getParsedFadvResponse = async (fileName = 'v2-fadv-response.json') =>
    await readJSON(path.resolve(path.dirname(__dirname), '__tests__', 'resources', fileName));

  const ctx = { tenantId: newId(), trx: newId() };

  describe('When applicants has a suspicious Ssn OR not established credit OR a credit score of 0', () => {
    it('And all of them has disabled the sendSsnEnabled, should enable ssn submission for applicants', async () => {
      const mocks = ssnSubmissionMocks(applicantIdsHash);
      setupMocks(mocks);
      const screeningResponse = await getParsedFadvResponse();
      const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);

      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls).toHaveLength(1);
      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls[0][1]).toHaveLength(2);
      expect(ssnSubmissionBuilder.enableSsnSubmission).toEqual(true);
      await ssnSubmissionBuilder.updateApplicants();

      expect(mocks.enableSSNSubmissionForApplicants.mock.calls).toHaveLength(1);
      expect(mocks.enableSSNSubmissionForApplicants.mock.calls[0][1]).toHaveLength(2);
    });

    it('And one of them has disabled the sendSsnEnabled, should enable ssn submission for applicants', async () => {
      const mocks = ssnSubmissionMocks({
        ...applicantIdsHash,
        '9834dc8a-fe8e-492f-b74b-962eb23dc386': true,
      });
      setupMocks(mocks);
      const screeningResponse = await getParsedFadvResponse();
      const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);

      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls).toHaveLength(1);
      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls[0][1]).toHaveLength(2);
      expect(ssnSubmissionBuilder.enableSsnSubmission).toEqual(true);
      await ssnSubmissionBuilder.updateApplicants();

      expect(mocks.enableSSNSubmissionForApplicants.mock.calls).toHaveLength(1);
      expect(mocks.enableSSNSubmissionForApplicants.mock.calls[0][1]).toHaveLength(1);
    });

    it('And any of them has disabled the sendSsnEnabled, should not enable ssn submission for applicants', async () => {
      const mocks = ssnSubmissionMocks({
        ...applicantIdsHash,
        '9834dc8a-fe8e-492f-b74b-962eb23dc386': true,
        '5850d06b-28af-4d3d-8010-26d7f30cb8ad': true,
      });
      setupMocks(mocks);
      const screeningResponse = await getParsedFadvResponse();
      const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);

      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls).toHaveLength(1);
      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls[0][1]).toHaveLength(2);
      expect(ssnSubmissionBuilder.enableSsnSubmission).toEqual(false);
      await ssnSubmissionBuilder.updateApplicants();

      expect(mocks.enableSSNSubmissionForApplicants.mock.calls).toHaveLength(0);
    });
  });

  describe('When a specific member results have a required SSN response', () => {
    it('And some of them has disabled the SSN submission, should enable ssn submission for applicants', async () => {
      const mocks = ssnSubmissionMocks(applicantIdsHash);
      setupMocks(mocks);

      const screeningResponse = await getParsedFadvResponse('required-ssn-response.json');
      const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);

      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls).toHaveLength(1);
      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls[0][1]).toHaveLength(1);
      expect(ssnSubmissionBuilder.enableSsnSubmission).toEqual(true);
      await ssnSubmissionBuilder.updateApplicants();

      expect(mocks.enableSSNSubmissionForApplicants.mock.calls).toHaveLength(1);
      expect(mocks.enableSSNSubmissionForApplicants.mock.calls[0][1]).toHaveLength(1);
    });

    it('And all of them has already enabled the SSN submission, should not try to enable ssn submission for applicants', async () => {
      const mocks = ssnSubmissionMocks({
        ...applicantIdsHash,
        '50f690d7-2004-4ee9-815e-356794269c01': true,
      });
      setupMocks(mocks);

      const screeningResponse = await getParsedFadvResponse('required-ssn-response.json');
      const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);

      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls).toHaveLength(1);
      expect(mocks.getPersonApplicationsByApplicantIds.mock.calls[0][1]).toHaveLength(1);
      expect(ssnSubmissionBuilder.enableSsnSubmission).toEqual(false);
      await ssnSubmissionBuilder.updateApplicants();

      expect(mocks.enableSSNSubmissionForApplicants.mock.calls).toHaveLength(0);
    });
  });
});
