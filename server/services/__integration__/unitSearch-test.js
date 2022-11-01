/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import v4 from 'uuid/v4';
import { getRankedUnits } from '../search';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { getMinAndMaxRentRangeForProperties } from '../../dal/propertyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import {
  createAnInventory,
  createABuilding,
  createALayout,
  createAInventoryGroup,
  addAmenityToBuilding,
  addAmenityToInventory,
  createAnAmenity,
  createAProperty,
  createAUser,
  testCtx as ctx,
  saveUnitsRevaPricing,
} from '../../testUtils/repoHelper';
import { refreshUnitSearchView } from '../../dal/searchRepo';

describe('unit search service tests', () => {
  let property;
  let layout;
  let building;
  let inventoryGroup;
  const propertySettings = { integration: { import: { unitPricing: false } } };
  beforeEach(async () => {
    property = await createAProperty(propertySettings, { name: 'swparkme' });
    layout = await createALayout({ name: 'Abbot', displayName: 'Abbot' });
    building = await createABuilding({ propertyId: property.id, name: '350 Arballo' });

    inventoryGroup = await createAInventoryGroup({
      propertyId: property.id,
    });

    const inventory = await createAnInventory({
      name: '1001',
      buildingId: building.id,
      layoutId: layout.id,
      propertyId: property.id,
      inventoryGroupId: inventoryGroup.id,
    });

    const inventory2 = await createAnInventory({
      name: '1002',
      buildingId: building.id,
      layoutId: layout.id,
      propertyId: property.id,
      inventoryGroupId: inventoryGroup.id,
    });

    await createAnAmenity({
      id: v4(),
      category: 'property',
      propertyId: property.id,
    });

    const buildingAmenity = await createAnAmenity({
      id: v4(),
      category: 'building',
      propertyId: property.id,
    });

    const inventoryAmenity = await createAnAmenity({
      id: v4(),
      propertyId: property.id,
    });

    await addAmenityToBuilding(ctx, building.id, buildingAmenity.id);
    await addAmenityToInventory(ctx, inventory.id, inventoryAmenity.id);
    await addAmenityToInventory(ctx, inventory2.id, inventoryAmenity.id);
    await saveUnitsRevaPricing([inventory, inventory2]);
    await refreshUnitSearchView({ tenantId: tenant.id });
  });

  describe('when the getUnits function is called', () => {
    const defaultFilters = {
      propertyIds: [],
      numBedrooms: {},
      numBathrooms: '0',
      moveInDate: { min: null, max: null },
      marketRent: { min: null, max: null },
      surfaceArea: { min: null, max: null },
      lifestyles: [],
      highValueAmenities: [],
      otherAmenities: [],
      floor: [],
      amenities: [],
    };

    const data = {
      tenantId: tenant.id,
    };

    let unitsLengthWithLimit = 0;

    it('should not return units if filters does not contain propertyIds, query or inventoryState', async () => {
      data.body = { ...defaultFilters };
      data.authUser = await createAUser();
      const units = await getRankedUnits(data);
      unitsLengthWithLimit = units.length;
      expect(unitsLengthWithLimit).to.be.equal(0);
    });

    it('should return the searchedUnits, using default filters plus withoutLimit ', async () => {
      const filters = { ...defaultFilters, withoutLimit: true };
      data.body = { ...filters };
      data.authUser = await createAUser();
      const units = await getRankedUnits(data);
      expect(units.length).to.be.at.least(unitsLengthWithLimit);
    });

    it('should return the searchedUnits, using default filters plus unitName', async () => {
      const filters = { ...defaultFilters, unitName: '1001' };
      data.body = { ...filters };
      data.authUser = await createAUser();
      const units = await getRankedUnits(data);
      expect(units.length).to.equal(1);
    });

    it('should return the searchedUnits, using default filters plus query', async () => {
      const filters = { ...defaultFilters, propertyIds: [property.id], query: '100' };
      data.body = { ...filters };
      data.authUser = await createAUser();
      const units = await getRankedUnits(data);
      expect(units.length).to.equal(2);
    });

    it('should return the searchedUnits, using default filters plus inventoryState', async () => {
      const filters = {
        ...defaultFilters,
        propertyIds: [property.id],
        inventoryStates: [DALTypes.InventoryState.MODEL],
      };

      const inventory = await createAnInventory({
        name: 'modelUnit',
        state: DALTypes.InventoryState.MODEL,
        buildingId: building.id,
        layoutId: layout.id,
        propertyId: property.id,
        inventoryGroupId: inventoryGroup.id,
      });

      await saveUnitsRevaPricing([inventory]);
      await refreshUnitSearchView({ tenantId: tenant.id });

      data.body = { ...filters };
      data.authUser = await createAUser();
      const units = await getRankedUnits(data);
      expect(units.length).to.equal(1);
    });
  });

  describe('given an array with property names', () => {
    it('should return the minimum and maximum market rent for all the units', async () => {
      const property2 = await createAProperty(propertySettings, { name: 'cove' });
      const inventoryGroup2 = await createAInventoryGroup({
        propertyId: property.id,
        basePriceMonthly: 5000,
      });

      const inventory = await createAnInventory({
        name: '1001',
        buildingId: building.id,
        layoutId: layout.id,
        propertyId: property2.id,
        inventoryGroupId: inventoryGroup2.id,
      });

      await saveUnitsRevaPricing([inventory]);
      await refreshUnitSearchView({ tenantId: tenant.id });

      const marketRents = await getMinAndMaxRentRangeForProperties({ tenantId: tenant.id }, ['swparkme', 'cove']);
      const [minimumMarketRent, maximumMarketRent] = marketRents;
      expect(marketRents.length).to.be.equal(2);
      expect(minimumMarketRent.marketRent).to.be.above(0);
      expect(maximumMarketRent.marketRent).to.be.above(minimumMarketRent.marketRent);
    });
  });
});
