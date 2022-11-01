/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';

const { mockModules } = require('test-helpers/mocker').default(jest);

// this constants should be moved out of these modules
// the above mock was to prevent the connection to the db
// that happens just by including these files
const { LEASE_NAMES_FIELD, INVALID_LEASE_NAMES } = require('../../services/leaseTerms.js');
const { AMENITIES_FIELD, INVALID_AMENITIES } = require('../../services/amenities.js');
const { LAYOUTS_FIELD, INVALID_LAYOUTS } = require('../../services/layouts.js');
const { BUILDINGS_FIELD, INVALID_BUILDINGS } = require('../../services/buildings.js');
const { INVALID_FEES } = require('../../services/fees.js');

describe('concession import', () => {
  let updateWithValidLeaseNames;
  let updateWithValidLayouts;
  let updateWithValidBuildings;
  let updateWithValidAmenities;
  let updateWithValidFees;
  let APPLIED_TO_FEES_FIELD;

  beforeEach(() => {
    jest.resetModules();

    mockModules({
      '../../services/leaseTerms.js': {
        validateLeaseNames: sinon.stub().returns({
          error: {
            name: LEASE_NAMES_FIELD,
            message: `${INVALID_LEASE_NAMES}: townhouse`,
          },
        }),
      },
      '../../services/layouts.js': {
        validateLayouts: sinon.stub().returns({
          error: {
            name: LAYOUTS_FIELD,
            message: `${INVALID_LAYOUTS}: abbot`,
          },
        }),
      },
      '../../services/buildings.js': {
        validateBuildings: sinon.stub().returns({
          error: {
            name: BUILDINGS_FIELD,
            message: `${INVALID_BUILDINGS}: 102, 350ar`,
          },
        }),
      },
      '../../services/amenities.js': {
        validateAmenities: sinon.stub().returns({
          error: {
            name: AMENITIES_FIELD,
            message: `${INVALID_AMENITIES}: test`,
          },
        }),
      },
      '../../services/fees.js': {
        validateFees: sinon.stub().returns({
          error: {
            name: APPLIED_TO_FEES_FIELD,
            message: `${INVALID_FEES}: test`,
          },
        }),
      },
      '../../database/factory.js': {
        knex: {
          withSchema: sinon.stub(),
          raw: sinon.stub(),
        },
      },
    });

    const concession = require('../inventory/concession.js'); // eslint-disable-line

    APPLIED_TO_FEES_FIELD = concession.APPLIED_TO_FEES_FIELD;
    updateWithValidLeaseNames = concession.updateWithValidLeaseNames;
    updateWithValidLayouts = concession.updateWithValidLayouts;
    updateWithValidBuildings = concession.updateWithValidBuildings;
    updateWithValidAmenities = concession.updateWithValidAmenities;
    updateWithValidFees = concession.updateWithValidFees;
  });

  it('should return error when invalid layouts are associated to the concession', async () => {
    const concessionObj = {
      name: '3FreePeriod',
      property: 'swparkme',
      displayName: 'Lease Incentive - 2 month free',
      layouts: 'Abigton, Ballantine, Abbot',
      propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
    };

    const result = await updateWithValidLayouts('tenantId', concessionObj);
    expect(result.name).equal(LAYOUTS_FIELD);
    expect(result.message).equal(`${INVALID_LAYOUTS}: abbot`);
  });

  it('should return error when invalid leaseNames are associated to the concession', async () => {
    const concessionObj = {
      name: '3FreePeriod',
      property: 'swparkme',
      displayName: 'Lease Incentive - 2 month free',
      leaseNames: 'Unit Standard, Townhouse',
      propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
    };

    const result = await updateWithValidLeaseNames('tenantId', concessionObj);
    expect(result.name).equal(LEASE_NAMES_FIELD);
    expect(result.message).equal(`${INVALID_LEASE_NAMES}: townhouse`);
  });

  it('should return error when invalid buildings are associated to the concession', async () => {
    const concessionObj = {
      name: '3FreePeriod',
      property: 'swparkme',
      displayName: 'Lease Incentive - 2 month free',
      buildings: '102, 350AR',
      propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
    };

    const result = await updateWithValidBuildings('tenantId', concessionObj);
    expect(result.name).equal(BUILDINGS_FIELD);
    expect(result.message).equal(`${INVALID_BUILDINGS}: 102, 350ar`);
  });

  it('should return error when invalid amenities are associated to the concession', async () => {
    const concessionObj = {
      name: '3FreePeriod',
      property: 'swparkme',
      displayName: 'Lease Incentive - 2 month free',
      amenities: 'Elevator, Test',
      propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
    };

    const result = await updateWithValidAmenities('tenantId', concessionObj);
    expect(result.name).equal(AMENITIES_FIELD);
    expect(result.message).equal(`${INVALID_AMENITIES}: test`);
  });

  it('should return error when invalid fees are associated to the concession', async () => {
    const concessionObj = {
      name: '3FreePeriod',
      property: 'swparkme',
      displayName: 'Lease Incentive - 2 month free',
      appliedToFees: 'Apartment, Test',
      propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
    };

    const result = await updateWithValidFees('tenantId', concessionObj);
    expect(result.name).equal(APPLIED_TO_FEES_FIELD);
    expect(result.message).equal(`${INVALID_FEES}: test`);
  });
});
