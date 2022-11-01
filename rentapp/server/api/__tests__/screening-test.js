/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
const { expect } = chai;

describe('screening', () => {
  let getScreeningReportSummary;
  const partyId = newId();
  const isLAAUser = role => role === 'LAA';
  const htmlReport = '<!DOCTYPE html> <html lang="en"><head><meta charset="utf-8"> <title>Hello World</title></head><body><p>Reva Tech test.</p></body></html>';
  const screeningResponse = { backgroundReport: htmlReport };

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../services/screening': {
        canUserViewFullReportSummary: mocks.canUserViewFullReportSummary,
        getScreeningReportSummary: mocks.getScreeningReportSummary,
      },
    });
    const screening = require('../actions/screening'); // eslint-disable-line global-require
    getScreeningReportSummary = screening.getScreeningReportSummary;
  };

  describe('getScreeningReportSummary', () => {
    let req;

    beforeEach(() => {
      req = {
        tenantId: newId(),
        authUser: {
          tenantId: newId(),
          quoteId: newId(),
          personId: newId(),
          personName: 'Harry Potter',
          tenantDomain: 'tenant.local.env.reva.tech',
        },
        params: {},
      };
    });

    it('should return bad request error when the partyId is missing', async () => {
      setupMocks({
        canUserViewFullReportSummary: jest.fn(() => isLAAUser('LAA')),
        getScreeningReportSummary: jest.fn(() => htmlReport),
      });

      try {
        await getScreeningReportSummary(req);
        // this should never happen
        throw new Error('This shall not happen!');
      } catch (error) {
        // instance of is broken, so this won't work either
        // expect(error instanceof BadRequestError).to.equal(true); // false!!!
        expect(error.name).to.equal('BadRequestError');
        expect(error.token).to.equal('MISSING_PARTY_ID');
      }
    });

    it('should return authorization data error when user who requested the get is NOT LAA', async () => {
      setupMocks({
        canUserViewFullReportSummary: jest.fn(() => isLAAUser('LA')),
        getScreeningReportSummary: jest.fn(() => htmlReport),
      });

      req.params = { partyId };

      try {
        await getScreeningReportSummary(req);
        // this should never happen
        throw new Error('This shall not happen!');
      } catch (error) {
        // instance of is broken, so this won't work either
        // expect(error instanceof BadRequestError).to.equal(true); // false!!!
        expect(error.name).to.equal('AuthorizationDataError');
        expect(error.token).to.equal('INVALID_LAA');
      }

      // rejections inside this block are not propagated these need to return the promise
      // in order for jest or mocha to be able to tell that a failure happened
      // that's why I prefer the async/await try/catch approach
      // expect(getScreeningReportSummary(req)).to.be.rejectedWith(AuthorizationDataError, 'INVALID_LAA');
    });

    it('should return type html and correct content when call the API with valid tenantId, valid partyId and user is LAA', async () => {
      setupMocks({
        canUserViewFullReportSummary: jest.fn(() => isLAAUser('LAA')),
        getScreeningReportSummary: jest.fn(() => screeningResponse),
      });
      req.params = { partyId };

      const result = await getScreeningReportSummary(req);
      expect(result.type).to.equal('html');
      expect(result.content).to.equal(htmlReport);
    });
  });
});
