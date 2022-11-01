/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importMarketingLayoutGroups } from '../inventory/marketingLayoutGroups';
import { getMarketingLayoutGroups } from '../../dal/marketingLayoutGroupsRepo';
import { getOneWhere } from '../../database/factory';

describe('import/marketingLayoutGroups', () => {
  describe('when importing a new marketingLayoutGroup', () => {
    it('will save the marketingLayoutGroup', async () => {
      const firstGroup = {
        name: 'studio',
        order: '',
        displayName: 'Studio',
        shortDisplayName: 'std',
        description: 'Group description',
      };

      const secondGroup = {
        name: '1bed',
        order: 1,
        displayName: '1 bedroom',
        shortDisplayName: '1 bed',
        description: 'Group description',
      };

      const groupRows = [
        {
          data: firstGroup,
          index: 1,
        },
        {
          data: secondGroup,
          index: 2,
        },
      ];

      await importMarketingLayoutGroups(ctx, groupRows);

      const groups = await getMarketingLayoutGroups(ctx);
      expect(groups.length).to.equal(2);

      const dbFirstGroup = await getOneWhere(ctx.tenantId, 'MarketingLayoutGroup', { name: firstGroup.name });
      expect(dbFirstGroup.name).to.equal(firstGroup.name);
      expect(dbFirstGroup.displayName).to.equal(firstGroup.displayName);
      expect(dbFirstGroup.shortDisplayName).to.equal(firstGroup.shortDisplayName);
      expect(dbFirstGroup.description).to.equal(firstGroup.description);
      expect(dbFirstGroup.order).to.equal(0);
    });
  });
  describe('when importing a valid, already imported group', () => {
    it('will update the existing one', async () => {
      const groupRow = [
        {
          data: {
            name: '1bed',
            order: 1,
            displayName: '1 bedroom',
            shortDisplayName: '1 bed',
            description: 'Group description',
          },
          index: 1,
        },
      ];

      await importMarketingLayoutGroups(ctx, groupRow);

      const updatedGroupRow = [
        {
          data: {
            name: '1bed',
            order: 2,
            displayName: '1 bedroom - updated',
            shortDisplayName: '1 bed-up',
            description: 'Updated group description',
          },
          index: 1,
        },
      ];

      await importMarketingLayoutGroups(ctx, updatedGroupRow);

      const groups = await getMarketingLayoutGroups(ctx);
      expect(groups.length).to.equal(1);
      expect(groups[0].displayName).to.equal('1 bedroom - updated');
      expect(groups[0].description).to.equal('Updated group description');
      expect(groups[0].order).to.equal(2);
      expect(groups[0].shortDisplayName).to.equal('1 bed-up');
    });
  });
});
