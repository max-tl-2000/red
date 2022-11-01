/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { expandForeignKeys } from '../factory';
import { testCtx as ctx, createAnInventoryItem } from '../../testUtils/repoHelper';
import { getPropertyById } from '../../dal/propertyRepo';
import '../../testUtils/setupTestGlobalContext';

describe('factory/expandForeignKeys', () => {
  let inventory;

  beforeEach(async () => {
    inventory = await createAnInventoryItem();
  });

  it('should expand the provided fks', async () => {
    const fksToExpand = {
      propertyId: {
        repr: 'property',
        func: getPropertyById,
      },
    };

    expect(inventory).to.contain.all.keys('propertyId');
    expect(inventory).not.to.contain.all.keys('property');

    await expandForeignKeys(ctx.tenantId, inventory, fksToExpand);

    expect(inventory).to.contain.all.keys('property');
    expect(inventory).not.to.contain.all.keys('propertyId');
  });

  it('should do nothing if the given foreign keys are not present in the object', async () => {
    const fksToExpand = {
      fooId: {
        repr: 'foo',
        func: getPropertyById,
      },
    };

    await expandForeignKeys(ctx.tenantId, inventory, fksToExpand);

    expect(inventory).not.to.contain.all.keys('fooId', 'foo');
  });
});
