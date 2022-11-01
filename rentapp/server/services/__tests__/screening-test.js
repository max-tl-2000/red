/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

describe('screening', () => {
  let getPrevSubmissionRequestData;

  const defaultMocks = () => ({
    getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm: jest.fn(() => ({})),
    getPrevSubmissionRequestData: jest.fn(() => ({})),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../dal/fadv-submission-repo': {
        getPrevSubmissionRequestData: mocks.getPrevSubmissionRequestData,
        getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm: mocks.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm,
      },
    });
    const screening = require('../screening'); // eslint-disable-line global-require
    getPrevSubmissionRequestData = screening.getPrevSubmissionRequestData;
  };

  describe('when calling getPrevSubmissionRequestData()', () => {
    let mocks;
    const ctx = {
      tenantId: getUUID(),
    };

    beforeEach(() => {
      jest.resetModules();
    });

    describe('with quote and lease term', () => {
      it('should return previous request without quote and lease term', async () => {
        mocks = defaultMocks();
        setupMocks(mocks);

        await getPrevSubmissionRequestData(ctx, getUUID());
        expect(mocks.getPrevSubmissionRequestData).toHaveBeenCalled();
        expect(mocks.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm.mock.calls.length).toEqual(0);
      });
    });

    describe('without quote and lease term', () => {
      it('should return previous request using quote and lease term', async () => {
        mocks = defaultMocks();
        setupMocks(mocks);

        await getPrevSubmissionRequestData(ctx, getUUID(), { quoteId: getUUID(), leaseTermMonths: 12 });
        expect(mocks.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm).toHaveBeenCalled();
        expect(mocks.getPrevSubmissionRequestData.mock.calls.length).toEqual(0);
      });
    });

    describe('without quote or lease term', () => {
      it('should return previous request without quote and lease term', async () => {
        mocks = defaultMocks();
        setupMocks(mocks);

        await getPrevSubmissionRequestData(ctx, getUUID(), { leaseTermMonths: 12 });
        expect(mocks.getPrevSubmissionRequestData).toHaveBeenCalled();
        expect(mocks.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm.mock.calls.length).toEqual(0);

        await getPrevSubmissionRequestData(ctx, getUUID(), { quoteId: getUUID() });
        expect(mocks.getPrevSubmissionRequestData).toHaveBeenCalled();
        expect(mocks.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm.mock.calls.length).toEqual(0);
      });
    });
  });
});
