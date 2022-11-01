/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('leaseTerm import', () => {
  let validateAdjustmentValues;
  let LEASE_NAME;
  let INVALID_LEASE_NAME_APPLIED;
  let LEASE_ADJUSTMENT;
  let INVALID_LEASE_ADJUSTMENT;
  let validatePropertyLeaseNameConstraint;

  beforeEach(() => {
    mockModules({
      '../../dal/leaseTermRepo.js': {
        getLeaseByNameAndPropertyName: sinon.stub().returns([]),
      },
      // important always mock the knex instance
      // otherwise the tests won't exit if a database
      // exists on the machine where the tests are executed
      '../../database/factory.js': {
        knex: {
          raw: sinon.stub(),
        },
      },
    });

    const leaseTerm = require('../inventory/leaseTerm.js'); // eslint-disable-line

    validateAdjustmentValues = leaseTerm.validateAdjustmentValues;
    LEASE_NAME = leaseTerm.LEASE_NAME;

    INVALID_LEASE_NAME_APPLIED = leaseTerm.INVALID_LEASE_NAME_APPLIED;
    LEASE_ADJUSTMENT = leaseTerm.LEASE_ADJUSTMENT;
    INVALID_LEASE_ADJUSTMENT = leaseTerm.INVALID_LEASE_ADJUSTMENT;
    validatePropertyLeaseNameConstraint = leaseTerm.validatePropertyLeaseNameConstraint;
  });

  it('should return error when the Lease Name associated with a property doesnt exist', async () => {
    const leaseTerm = {
      leaseName: 'Condo',
      property: 'cove',
    };

    const result = validatePropertyLeaseNameConstraint('tenantId', leaseTerm, []);
    expect(result.length).to.equal(1);
    expect(result[0].name).equal(LEASE_NAME);
    expect(result[0].message).equal(INVALID_LEASE_NAME_APPLIED);
  });

  it('should return error when relative adjusment and absolute adjusment value are presents for the same Lease Term', async () => {
    const leaseTerm = {
      relativeAdjustment: 20,
      absoluteAdjustment: 200,
    };

    const resultTest1 = validateAdjustmentValues(leaseTerm);
    expect(resultTest1.length).to.equal(1);
    expect(resultTest1[0].name).equal(LEASE_ADJUSTMENT);
    expect(resultTest1[0].message).equal(INVALID_LEASE_ADJUSTMENT);
  });
});
