/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import {
  testCtx as ctx,
  createAnInventory,
  createAInventoryGroup,
  createAFee,
  createAProperty,
  setAssociatedFees,
  saveUnitsRevaPricing,
} from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { getComplimentsPriceByInventoryIds, getInventoriesStateAndStateStartDate } from '../inventoryRepo';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('dal/inventoryRepo', () => {
  describe('When calling getInventoriesStateAndStateStartDate function', () => {
    let inventories;

    beforeEach(async () => {
      const objects = [
        {
          name: 'test-inventory-name-1',
          description: 'test-inventory-description-1',
        },
        {
          name: 'test-inventory-name-2',
          description: 'test-inventory-description-2',
        },
      ];
      inventories = await Promise.all(objects.map(inventory => createAnInventory(inventory)));
    });

    it('should return an array of inventory objects when the inventory exist', async () => {
      const [firstInventory] = inventories;
      const { name, propertyId, buildingId, state, stateStartDate } = firstInventory;
      const results = await getInventoriesStateAndStateStartDate(ctx, [{ data: firstInventory }]);
      expect(results).to.have.lengthOf(1);
      expect(results).to.deep.include({ name, propertyId, buildingId, state, stateStartDate });
    });

    it('should return an array of inventory objects when the inventories exist', async () => {
      const [firstInventory, secondInventory] = inventories;
      const results = await getInventoriesStateAndStateStartDate(ctx, [{ data: firstInventory }, { data: secondInventory }]);
      expect(results).to.have.lengthOf(2);
      const expectedMembers = [firstInventory, secondInventory].map(({ name, propertyId, buildingId, state, stateStartDate }) => ({
        name,
        propertyId,
        buildingId,
        state,
        stateStartDate,
      }));
      expect(results).to.have.deep.members(expectedMembers);
    });

    it("should return an empty array when an inventory doesn't exist", async () => {
      const [firstInventory] = inventories;
      const name = 'test-inventory-name-not-created';
      const results = await getInventoriesStateAndStateStartDate(ctx, [{ data: { ...firstInventory, name } }]);
      expect(results).to.have.lengthOf(0);
    });
  });

  describe('When calling getComplimentsPriceByInventoryIds function', () => {
    let inventory;
    let storage;

    beforeEach(async () => {
      const property = await createAProperty();

      const inventoryPrimaryFee = await createAFee({
        feeType: DALTypes.FeeType.INVENTORY_GROUP,
        feeName: 'MainFee-1',
        absolutePrice: 100,
        propertyId: property.id,
      });

      const storageRelatedFee = await createAFee({
        propertyId: property.id,
        absolutePrice: 37,
        feeName: 'Storage11x9',
        externalChargeCode: 'ADM',
        servicePeriod: 'month',
        feeType: 'inventoryGroup',
        quoteSectionName: 'storage',
        maxQuantityInQuote: 4,
      });

      await setAssociatedFees(inventoryPrimaryFee.id, storageRelatedFee.id, true);

      const inventoryGroupForStorage = await createAInventoryGroup({
        propertyId: property.id,
        feeId: storageRelatedFee.id,
        basePriceMonthly: 2200,
      });

      const firstInventoryGroup = await createAInventoryGroup({
        shouldCreateLeaseTerm: false,
        feeId: inventoryPrimaryFee.id,
      });

      inventory = await createAnInventory({
        name: 'test-inventory-name',
        description: 'test-inventory-description',
        propertyId: property.id,
        inventoryGroupId: firstInventoryGroup.id,
      });

      storage = await createAnInventory({
        name: 'test-storage',
        description: 'test-storage',
        propertyId: property.id,
        inventoryGroupId: inventoryGroupForStorage.id,
        parentInventory: inventory.id,
      });

      await saveUnitsRevaPricing([inventory, storage]);
    });

    it('should return the basePriceMonthly related complimentary prices for inventories', async () => {
      const inventoryIds = [inventory.id, storage.id];

      const results = await getComplimentsPriceByInventoryIds(ctx, inventoryIds);
      expect(results).to.have.lengthOf(1);

      const expected = [
        {
          inventoryId: inventory.id,
          basePriceMonthlyArray: [2200],
        },
      ];
      expect(results).to.have.deep.members(expected);
    });
  });
});
