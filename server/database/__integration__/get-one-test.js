/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getOne } from '../factory';
import { testCtx as ctx, createAnInventoryItem } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';

describe('factory/getOne', () => {
  let inventory;

  const inventoryFields = [
    'buildingId',
    'created_at',
    'description',
    'floor',
    'layoutId',
    'id',
    'multipleItemTotal',
    'name',
    'propertyId',
    'type',
    'updated_at',
  ];

  beforeEach(async () => {
    inventory = await createAnInventoryItem();
  });

  it('should select the required fields', async () => {
    const fields = ['id', 'name'];
    inventory = await getOne(ctx, 'Inventory', inventory.id, {}, fields);
    expect(inventory).to.contain.all.keys(fields);
  });

  it('should retrieve * if no fields are specified', async () => {
    inventory = await getOne(ctx, 'Inventory', inventory.id);
    expect(inventory).to.contain.all.keys(inventoryFields);
  });

  it('should behave as a simple select if fksToExpand is not provided', async () => {
    inventory = await getOne(ctx, 'Inventory', inventory.id);
    expect(inventory).to.contain.all.keys(inventoryFields);
  });

  context('fks expansion', () => {
    const fksToExpand = {
      propertyId: {
        repr: 'property',
        rel: 'Property',
      },
    };

    const propertyFields = [
      'created_at',
      'updated_at',
      'id',
      'name',
      'propertyLegalName',
      'owner',
      'operator',
      'propertyGroupId',
      'addressId',
      'startDate',
      'endDate',
      'APN',
      'MSANumber',
      'MSAName',
      'description',
      'website',
      'displayName',
    ];

    it('should expand the provided fks', async () => {
      inventory = await getOne(ctx, 'Inventory', inventory.id, fksToExpand);
      expect(inventory).to.contain.all.keys(...inventoryFields, 'property');
    });

    it('should expand the provided fks and retrive * from the relation', async () => {
      inventory = await getOne(ctx, 'Inventory', inventory.id, fksToExpand);
      expect(inventory.property).to.contain.all.keys(propertyFields);
    });

    it('should expand the provided fks and retrive only the specified fields per relation', async () => {
      const fields = ['id', 'name', 'displayName'];
      const fksToExpandWithField = {
        propertyId: {
          repr: 'property',
          rel: 'Property',
          fields,
        },
      };
      inventory = await getOne(ctx, 'Inventory', inventory.id, fksToExpandWithField);
      expect(inventory.property).to.contain.all.keys(fields);
    });

    it('should fail with invalid relations', async () => {
      const fakeFksToExpand = {
        fooId: {
          repr: 'foo',
          rel: 'Foo',
        },
      };

      try {
        inventory = await getOne(ctx, 'Inventory', inventory.id, fakeFksToExpand);
      } catch (e) {
        expect(e.message).to.match(/Foo" does not exist/);
      }
    });
  });
});
