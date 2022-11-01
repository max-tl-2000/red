/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx, createAProperty, createAMarketingLayoutGroup } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importMarketingLayouts } from '../inventory/marketingLayouts';
import { getMarketingLayouts } from '../../dal/marketingLayoutsRepo';
import { getOneWhere } from '../../database/factory';

describe('import/marketingLayouts', () => {
  let property;
  let marketingLayoutGroup;
  beforeEach(async () => {
    property = await createAProperty();
    marketingLayoutGroup = await createAMarketingLayoutGroup();
  });

  describe('when importing a new marketing layout', () => {
    it('will save the marketing layout', async () => {
      const firstMarketingLayout = {
        name: 'firstName',
        property: property.name,
        displayName: 'DN1',
        order: '',
        description: 'Marketing layout description',
        marketingLayoutGroup: marketingLayoutGroup.name,
        inactiveFlag: 'X',
      };

      const secondMarketingLayout = {
        name: 'secondName',
        property: property.name,
        displayName: 'DN2',
        order: 2,
        description: 'Marketing layout description',
        marketingLayoutGroup: marketingLayoutGroup.name,
        inactiveFlag: 'TRUE',
      };

      const marketingLayoutRows = [
        {
          data: firstMarketingLayout,
          index: 1,
        },
        {
          data: secondMarketingLayout,
          index: 2,
        },
      ];

      await importMarketingLayouts(ctx, marketingLayoutRows);

      const marketingLayouts = await getMarketingLayouts(ctx);
      expect(marketingLayouts.length).to.equal(2);

      const dbFirstMarketingLayout = await getOneWhere(ctx.tenantId, 'MarketingLayout', { name: firstMarketingLayout.name });
      const dbSecondMarketingLayout = await getOneWhere(ctx.tenantId, 'MarketingLayout', { name: secondMarketingLayout.name });
      expect(dbFirstMarketingLayout.name).to.equal(firstMarketingLayout.name);
      expect(dbFirstMarketingLayout.propertyId).to.equal(property.id);
      expect(dbFirstMarketingLayout.displayName).to.equal(firstMarketingLayout.displayName);
      expect(dbFirstMarketingLayout.marketingLayoutGroupId).to.equal(marketingLayoutGroup.id);
      expect(dbFirstMarketingLayout.description).to.equal(firstMarketingLayout.description);
      expect(dbFirstMarketingLayout.order).to.equal(0);
      expect(dbFirstMarketingLayout.inactive).to.equal(true);
      expect(dbSecondMarketingLayout.order).to.equal(2);
      expect(dbSecondMarketingLayout.inactive).to.equal(true);
    });
  });

  describe('when importing a valid, already imported marketing layout', () => {
    it('will update the existing one', async () => {
      const secondMarketingLayoutGroup = await createAMarketingLayoutGroup();
      const marketingLayoutRow = [
        {
          data: {
            name: 'firstName',
            property: property.name,
            displayName: 'DN1',
            order: 1,
            description: 'Marketing layout description',
            marketingLayoutGroup: marketingLayoutGroup.name,
            inactiveFlag: 'X',
          },
          index: 1,
        },
      ];

      await importMarketingLayouts(ctx, marketingLayoutRow);

      const updatedMarketingLayoutRow = [
        {
          data: {
            name: 'firstName',
            property: property.name,
            displayName: 'Updated DN1',
            order: 2,
            description: 'Marketing layout updated description',
            marketingLayoutGroup: secondMarketingLayoutGroup.name,
            inactiveFlag: '',
          },
          index: 1,
        },
      ];

      await importMarketingLayouts(ctx, updatedMarketingLayoutRow);

      const marketingLayouts = await getMarketingLayouts(ctx);
      expect(marketingLayouts.length).to.equal(1);
      expect(marketingLayouts[0].displayName).to.equal('Updated DN1');
      expect(marketingLayouts[0].description).to.equal('Marketing layout updated description');
      expect(marketingLayouts[0].order).to.equal(2);
      expect(marketingLayouts[0].inactive).to.equal(false);
      expect(marketingLayouts[0].marketingLayoutGroupId).to.equal(secondMarketingLayoutGroup.id);
    });
  });

  describe('when importing an invalid marketing layout - with a wrong marketingLayoutGroup or property', () => {
    it('will not save the marketing layout', async () => {
      const firstMarketingLayout = {
        name: 'firstName',
        property: 'wrongPropertyName',
        displayName: 'DN1',
        order: '',
        description: 'Marketing layout description',
        marketingLayoutGroup: marketingLayoutGroup.name,
        inactiveFlag: 'X',
      };

      const secondMarketingLayout = {
        name: 'secondName',
        property: property.name,
        displayName: 'DN2',
        order: 2,
        description: 'Marketing layout description',
        marketingLayoutGroup: 'wrongGroupName',
        inactiveFlag: 'TRUE',
      };

      const groupRows = [
        {
          data: firstMarketingLayout,
          index: 1,
        },
        {
          data: secondMarketingLayout,
          index: 2,
        },
      ];

      await importMarketingLayouts(ctx, groupRows);

      const marketingLayouts = await getMarketingLayouts(ctx);
      expect(marketingLayouts.length).to.equal(0);
    });
  });

  describe('when importing two marketing layouts with the same name but a different property', () => {
    it('will save both marketing layouts', async () => {
      const secondProperty = await createAProperty({}, { name: 'swparkme' });
      const firstMarketingLayout = {
        name: 'firstName',
        property: property.name,
        displayName: 'DN1',
        order: '',
        description: 'Marketing layout description',
        marketingLayoutGroup: marketingLayoutGroup.name,
        inactiveFlag: 'X',
      };

      const secondMarketingLayout = {
        name: 'firstName',
        property: secondProperty.name,
        displayName: 'DN2',
        order: 2,
        description: 'Marketing layout description',
        marketingLayoutGroup: marketingLayoutGroup.name,
        inactiveFlag: 'TRUE',
      };

      const marketingLayoutRows = [
        {
          data: firstMarketingLayout,
          index: 1,
        },
        {
          data: secondMarketingLayout,
          index: 2,
        },
      ];

      await importMarketingLayouts(ctx, marketingLayoutRows);

      const marketingLayouts = await getMarketingLayouts(ctx);
      expect(marketingLayouts.length).to.equal(2);
    });
  });
});
