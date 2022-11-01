/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('inventory import', () => {
  let validateParentInventory;
  let PARENT_NAME;
  let INVALID_PARENT_NAME;
  let AMBIGUOUS_NAME_PARENT_INVENTORY;
  let numberOfMatchingInventories;

  const inventories = [
    {
      data: {
        name: '1010',
        property: 'propertyTestA',
        building: 'buildingTestX',
      },
    },
    {
      data: {
        name: '1013',
        property: 'propertyTestB',
        building: 'buildingTestB',
      },
    },
    {
      data: {
        name: '1013',
        property: 'propertyTestB',
        building: 'buildingTestC',
      },
    },
  ];

  beforeEach(() => {
    mockModules({
      '../../dal/buildingRepo.js': {
        getBuildingByNameAndPropertyName: sinon.stub().returns({ floorCount: 3 }),
      },
      '../../database/factory.js': {
        knex: {
          raw: sinon.stub(),
        },
      },
    });

    const inventory = require('../inventory/inventory'); // eslint-disable-line

    validateParentInventory = inventory.validateParentInventory;
    PARENT_NAME = inventory.PARENT_NAME;
    INVALID_PARENT_NAME = inventory.INVALID_PARENT_NAME;
    AMBIGUOUS_NAME_PARENT_INVENTORY = inventory.AMBIGUOUS_NAME_PARENT_INVENTORY;
    numberOfMatchingInventories = inventory.numberOfMatchingInventories;
  });

  const validateError = (result, errorName, errorMsg) => {
    expect(result.length).to.equal(1);
    expect(result[0].name).equal(errorName);
    expect(result[0].message).equal(errorMsg);
  };

  describe('numberOfMatchingInventories', () => {
    it('should find results when data types are different', () => {
      [1013, '1013'].forEach(name => expect(numberOfMatchingInventories(name, 'propertyTestB', inventories)).to.be.ok);
    });
  });

  describe('validateParentInventory', () => {
    it('should return error when inventory has an invalid inventory as parentInventory', async () => {
      const inventory = {
        name: 'p100',
        property: 'propertyTestA',
        building: 'buildingTestA',
        parentInventory: '1012',
      };

      const result = await validateParentInventory('tenantId', inventory, inventories, []);
      validateError(result, PARENT_NAME, INVALID_PARENT_NAME);
    });

    it('should return error when the inventory has an invalid building+inventory as parentInventory', async () => {
      const inventory = {
        name: 'p100',
        property: 'propertyTestB',
        building: 'buildingTestA',
        parentInventory: 'buildingTestX-1013',
      };

      const result = await validateParentInventory('tenantId', inventory, inventories, []);
      validateError(result, PARENT_NAME, INVALID_PARENT_NAME);
    });

    it('should return error when the inventory has an ambiguous name as parentInventory', async () => {
      const inventory = {
        name: 'p100',
        property: 'propertyTestB',
        building: 'buildingTestA',
        parentInventory: '1013',
      };
      const result = await validateParentInventory('tenantId', inventory, inventories);
      validateError(result, PARENT_NAME, AMBIGUOUS_NAME_PARENT_INVENTORY);
    });
  });
});
