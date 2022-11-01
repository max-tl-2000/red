/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import v4 from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import {
  createAnInventory,
  createABuilding,
  createALayout,
  createAInventoryGroup,
  addAmenityToBuilding,
  addAmenityToInventory,
  createAnAmenity,
  createAProperty,
  testCtx as ctx,
  saveUnitsRevaPricing,
} from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';
import { refreshUnitSearchView } from '../../../dal/searchRepo';

describe('Inventories', () => {
  async function _createInventory(withBuilding = true) {
    const property = await createAProperty();
    const layout = await createALayout({});

    const building = await createABuilding({ propertyId: property.id });

    const inventoryGroup = await createAInventoryGroup({
      propertyId: property.id,
    });

    const inventory = await createAnInventory({
      buildingId: (withBuilding && building.id) || null,
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

    await refreshUnitSearchView(ctx);

    return inventory;
  }

  const _createInventoryByInventoryGroup = async (multipleItemTotal = 0) => {
    const property = await createAProperty();
    const layout = await createALayout({});

    const inventoryGroup = await createAInventoryGroup({
      propertyId: property.id,
    });

    const inventoryName = '1001';
    const similarBuildingName = 'Bui';
    const buildingName = `${similarBuildingName}3`;
    const similarBuildingDisplayName = 'Building ';
    const buildingDisplayName = `${similarBuildingDisplayName}B3`;

    const similarInventoryName = 'Test Item ';
    const oneResultInventoryName = `${similarInventoryName}2`;
    const multipleFieldQuery = `${oneResultInventoryName} ${buildingDisplayName} ${buildingName}`;
    const notMatchingQuery = 'Not matching query';

    const building = await createABuilding({
      name: `${similarBuildingName}1`,
      displayName: `${similarBuildingDisplayName}B1`,
      propertyId: property.id,
    });

    const secondBuilding = await createABuilding({
      name: `${similarBuildingName}2`,
      displayName: `${similarBuildingDisplayName}B2`,
      propertyId: property.id,
    });

    const thirdBuilding = await createABuilding({
      name: buildingName,
      displayName: buildingDisplayName,
      propertyId: property.id,
    });

    const differentBuildingInventories = [
      await createAnInventory({
        name: inventoryName,
        buildingId: building.id,
        layoutId: layout.id,
        propertyId: property.id,
        inventoryGroupId: inventoryGroup.id,
        multipleItemTotal,
      }),
      await createAnInventory({
        name: inventoryName,
        buildingId: secondBuilding.id,
        layoutId: layout.id,
        propertyId: property.id,
        inventoryGroupId: inventoryGroup.id,
        multipleItemTotal,
      }),
    ];

    const oneResultInventory = await createAnInventory({
      name: oneResultInventoryName,
      buildingId: thirdBuilding.id,
      layoutId: layout.id,
      propertyId: property.id,
      inventoryGroupId: inventoryGroup.id,
      multipleItemTotal,
    });

    const sameBuildingInventories = [
      await createAnInventory({
        name: `${similarInventoryName}3`,
        buildingId: thirdBuilding.id,
        layoutId: layout.id,
        propertyId: property.id,
        inventoryGroupId: inventoryGroup.id,
        multipleItemTotal,
      }),
      oneResultInventory,
    ];

    const similarNameInventories = [
      await createAnInventory({
        name: `${similarInventoryName}4`,
        buildingId: secondBuilding.id,
        layoutId: layout.id,
        propertyId: property.id,
        inventoryGroupId: inventoryGroup.id,
        multipleItemTotal,
      }),
      ...sameBuildingInventories,
    ];

    const inventories = [...differentBuildingInventories, ...similarNameInventories];

    return {
      inventoryGroup,
      inventories,
      inventoryName,
      buildingName,
      buildingDisplayName,
      notMatchingQuery,
      multipleFieldQuery,
      differentBuildingInventories,
      sameBuildingInventories,
      oneResultInventoryName,
      oneResultInventory,
      similarBuildingName,
      similarBuildingDisplayName,
      similarInventoryName,
      similarNameInventories,
    };
  };

  context('GET api/inventories/:inventoryId/details', () => {
    it('should return 200 if the inventory exists', async () => {
      const inventory = await _createInventory();
      await saveUnitsRevaPricing([inventory]);
      await refreshUnitSearchView(ctx);

      const expectedKeys = [
        'building',
        'created_at',
        'description',
        'floor',
        'inventoryGroupId',
        'id',
        'layout',
        'multipleItemTotal',
        'name',
        'property',
        'type',
        'updated_at',
        'amenities',
        'address',
        'inventoryAddress',
        'complimentaryItems',
        'externalId',
        'rmsExternalId',
        'inventorygroup',
        'marketRent',
        'renewalMarketRent',
        'specials',
        'imageUrl',
        // these will be removed
        // 'data',
        'buildings',
        'availabilityDate',
        'layouts',
        'inventoryTypes',
        'parentInventory',
        'state',
        'stateStartDate',
        'nextStateExpectedDate',
        'leasePartyMembers',
        'inactive',
        'leaseTerm',
        'lossLeaderUnit',
      ];

      await request(app)
        .get(`/inventories/${inventory.id}/details`)
        .send({ id: inventory.id })
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.have.all.keys(expectedKeys);
          expect(res.body.amenities.length).to.equal(3);
          expect(res.body.building.amenities.length).to.equal(1);
          expect(res.body.property.amenities.length).to.equal(1);
        });
    });
  });

  context('GET api/inventories', () => {
    it('should return a list of inventories', async () => {
      const inventories = [await _createInventory(), await _createInventory(), await _createInventory()];
      await saveUnitsRevaPricing(inventories);

      await request(app)
        .get('/inventories')
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body.length).to.equal(inventories.length);

          const expectedIds = inventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });
  });

  context('GET api/inventories/:inventoryId', () => {
    it('should return an inventory given an id', async () => {
      const inventory = await _createInventory();

      const expectedKeys = [
        'buildingId',
        'created_at',
        'description',
        'floor',
        'id',
        'layoutId',
        'multipleItemTotal',
        'name',
        'propertyId',
        'type',
        'updated_at',
        'parentInventory',
        'state',
        'stateStartDate',
        'externalId',
        'rmsExternalId',
      ];

      // this returns an array!
      await request(app)
        .get(`/inventories/${inventory.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).not.to.be.an('array');
          expect(res.body.id).to.equal(inventory.id);
          expect(res.body).to.contain.all.keys(expectedKeys);
        });
    });

    it('should return 404 if the inventory does not exist', async () => {
      await request(app).get(`/inventories/${v4()}`).set(getAuthHeader()).expect(404);
    });
  });

  context('GET api/inventories/:inventoryId/amenities', () => {
    it('should retrieve all amenities for the inventory', async () => {
      const inventory = await _createInventory();
      await request(app)
        .get(`/inventories/${inventory.id}/amenities`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(3);
        });
    });

    it('should retrieve all amenities for the inventory when it has no associated building', async () => {
      const inventory = await _createInventory(false);
      await request(app)
        .get(`/inventories/${inventory.id}/amenities`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(2);
        });
    });
  });

  context('GET api/inventories?inventoryGroupId={inventoryGroupId}&query={query}', () => {
    it('should retrieve all inventory items for that inventory group', async () => {
      const { inventoryGroup, inventories } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(inventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(5);
          const expectedIds = inventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that match the inventory name', async () => {
      const { inventoryGroup, oneResultInventory, oneResultInventoryName } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing([oneResultInventory]);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${oneResultInventoryName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(1);
          const expectedIds = [oneResultInventory.id];
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that match the inventory name with different buildings', async () => {
      const { inventoryGroup, differentBuildingInventories, inventoryName } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(differentBuildingInventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${inventoryName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(2);
          const expectedIds = differentBuildingInventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that has a similar inventory name', async () => {
      const { inventoryGroup, similarNameInventories, similarInventoryName } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(similarNameInventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${similarInventoryName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(3);
          const expectedIds = similarNameInventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that match the building name', async () => {
      const { inventoryGroup, buildingName, sameBuildingInventories } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(sameBuildingInventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${buildingName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(2);
          const expectedIds = sameBuildingInventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that has a similar building name', async () => {
      const { inventoryGroup, similarBuildingName, inventories } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(inventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${similarBuildingName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(5);
          const expectedIds = inventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that match the building display name', async () => {
      const { inventoryGroup, buildingDisplayName, sameBuildingInventories } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(sameBuildingInventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${buildingDisplayName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(2);
          const expectedIds = sameBuildingInventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve all inventory items for that inventory group that has a similar building display name', async () => {
      const { inventoryGroup, similarBuildingDisplayName, inventories } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing(inventories);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${similarBuildingDisplayName}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(5);
          const expectedIds = inventories.map(x => x.id);
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should retrieve only one inventory item for that inventory group that match the multiple field query', async () => {
      const { inventoryGroup, multipleFieldQuery, oneResultInventory } = await _createInventoryByInventoryGroup();
      await saveUnitsRevaPricing([oneResultInventory]);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${multipleFieldQuery}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(1);
          const expectedIds = [oneResultInventory.id];
          expect(res.body.map(x => x.id)).to.have.members(expectedIds);
        });
    });

    it('should return an empty array if the query does not match', async () => {
      const { inventoryGroup, notMatchingQuery } = await _createInventoryByInventoryGroup();
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}&query=${notMatchingQuery}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(0);
        });
    });

    it('should return an empty array if the inventory is part of an inventory pool', async () => {
      const { inventoryGroup } = await _createInventoryByInventoryGroup(3);
      await request(app)
        .get(`/inventories?inventoryGroupId=${inventoryGroup.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.equal(0);
        });
    });

    it('should return 400 if the inventory group id is invalid', async () => {
      await request(app).get('/inventories?inventoryGroupId=1').set(getAuthHeader()).expect(400);
    });

    it('should return 404 if the inventory group id does not exists', async () => {
      await request(app).get(`/inventories?inventoryGroupId=${v4()}`).set(getAuthHeader()).expect(404);
    });
  });
});
