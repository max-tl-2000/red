/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { expect } from 'chai';
const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);
const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';
import { readFileAsString } from '../../../../../common/helpers/file';
import xml2js from 'xml2js-es6-promise';

describe('given FADV mock scenarios using the screeing provider', () => {
  let postToScreeningProvider;

  const defaultMocks = () => ({
    createFadvRawRequest: jest.fn(() => ({ rawRequest: '', id: '' })),
    createAndStoreFadvRequest: jest.fn(() => ({ rawRequest: '', id: '' })),
    postXML: jest.fn(),
    knex: jest.fn(),
    getTenantData: jest.fn(() => ({ metadata: {} })),
    admin: jest.fn(),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../helpers/fadv-helper': {
        createFadvRawRequest: mocks.createFadvRawRequest,
        createAndStoreFadvRequest: mocks.createAndStoreFadvRequest,
      },
      '../../../../../common/helpers/postXML': mocks.postXML,
      '../../../../../server/database/factory': {
        knex: mocks.knex,
      },
      '../../../../../server/dal/tenantsRepo': {
        getTenantData: mocks.getTenantData,
      },
      '../../../../../server/common/schemaConstants': {
        admin: mocks.admin,
      },
    });
    const screeningProviderIntegration = require('../screening-provider-integration'); // eslint-disable-line global-require
    postToScreeningProvider = screeningProviderIntegration.postToScreeningProvider;
  };

  const evaluateScenario = async (propertyId, leaseTermsIn, applicantsIn, expectedResult) => {
    const ctx = { tenantId: newId() };
    const { response } = await postToScreeningProvider(ctx, propertyId, leaseTermsIn, {
      applicants: applicantsIn,
      customRecords: { screeningRequestId: newId() },
    });
    const responseXmlFromScenario = await readFileAsString(expectedResult, BASE_PATH);
    const expected = await xml2js(responseXmlFromScenario);
    expect(response.ApplicantScreening.Request).to.eql(expected.ApplicantScreening.Request);
  };

  beforeEach(() => {
    setupMocks(defaultMocks());
  });

  it('Ann and Bob have low income and it is DENIED', async () =>
    await evaluateScenario(
      '123456',
      { rent: 4577, leaseTermMonths: 12 },
      [
        { firstName: 'Ann', lastName: 'Smith' },
        { firstName: 'Bob', lastName: 'Smith' },
      ],
      'scenario-ann-bob-denied.xml',
    ));

  it('Bob and Ann have low income and it is DENIED', async () =>
    await evaluateScenario(
      '123456',
      { rent: 4577, leaseTermMonths: 12 },
      [
        { firstName: 'Bob', lastName: 'Smith' },
        { firstName: 'Ann', lastName: 'Smith' },
      ],
      'scenario-ann-bob-denied.xml',
    ));

  it('Edgar and Florence have low income and it is APPROVED', async () =>
    await evaluateScenario(
      '123456',
      { rent: 4582, leaseTermMonths: 12 },
      [
        { firstName: 'Edgar', lastName: 'Smith' },
        { firstName: 'Florence', lastName: 'Smith' },
      ],
      'scenario-edgar-florence-approved.xml',
    ));

  it('Florence and Edgar have low income and it is APPROVED', async () =>
    await evaluateScenario(
      '123456',
      { rent: 4582, leaseTermMonths: 12 },
      [
        { firstName: 'Florence', lastName: 'Smith' },
        { firstName: 'Edgar', lastName: 'Smith' },
      ],
      'scenario-edgar-florence-approved.xml',
    ));
});
