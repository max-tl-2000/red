/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);
const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';
import { readFileAsString } from '../../../../../common/helpers/file';
import xml2js from 'xml2js-es6-promise';

describe('given FADV mock scenarios', () => {
  let postToFADV;
  const setupMocks = () => {
    jest.resetModules();
    mockModules({
      '../../../../../common/helpers/postXML': jest.fn(),
    });

    const fakeAdapter = require('../adapters/fake-fadv-service-adapter');  // eslint-disable-line
    postToFADV = fakeAdapter.postToFADV;
  };

  beforeEach(() => {
    setupMocks();
  });

  const evaluateScenario = async (propertyId, leaseTermsIn, applicantsIn, expectedResult) => {
    const tenantId = newId();
    const payload = {
      propertyId,
      rentData: leaseTermsIn,
      applicantData: {
        applicants: applicantsIn,
        tenantId,
        partyApplicationId: newId(),
        customRecords: { screeningRequestId: newId() },
      },
    };
    const ctx = { tenantId };
    const response = await postToFADV(ctx, payload);
    const responseXmlFromScenario = await readFileAsString(expectedResult, BASE_PATH);
    const expected = await xml2js(responseXmlFromScenario);
    expect(response.ApplicantScreening.Request).to.eql(expected.ApplicantScreening.Request);
  };

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
        { firstName: 'Edgar', lastName: 'Smith' },
        { firstName: 'Florence', lastName: 'Smith' },
      ],
      'scenario-edgar-florence-approved.xml',
    ));
});
