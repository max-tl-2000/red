/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importMarketingAssets } from '../inventory/marketingAsset';
import { getMarketingAssets } from '../../dal/marketingAssetsRepo';
import { getOneWhere } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('import/marketingAssets', () => {
  describe('when importing a new marketingAsset', () => {
    it('will save the marketingAsset', async () => {
      const firstAsset = {
        name: 'firstAsset',
        type: '3D',
        url: 'firstasseturl.com',
        displayName: 'firstAsset DN',
        displayDescription: 'asset description',
        altTag: '',
      };

      const secondAsset = {
        name: 'secondAsset',
        type: 'video',
        url: 'secondasseturl.com',
        displayName: 'secondAsset DN',
        displayDescription: 'asset description',
        altTag: '',
      };

      const assetRows = [
        {
          data: firstAsset,
          index: 1,
        },
        {
          data: secondAsset,
          index: 2,
        },
      ];

      await importMarketingAssets(ctx, assetRows);

      const assets = await getMarketingAssets(ctx);
      expect(assets.length).to.equal(2);

      const dbFirstAsset = await getOneWhere(ctx.tenantId, 'MarketingAsset', { name: firstAsset.name });
      expect(dbFirstAsset.name).to.equal(firstAsset.name);
      expect(dbFirstAsset.displayName).to.equal(firstAsset.displayName);
      expect(dbFirstAsset.url).to.equal(firstAsset.url);
      expect(dbFirstAsset.displayDescription).to.equal(firstAsset.displayDescription);
      expect(dbFirstAsset.type).to.equal(DALTypes.MarketingAssetType.THREE_D);
    });
  });
  describe('when importing a valid, already imported asset', () => {
    it('will update the existing one', async () => {
      const assetRow = [
        {
          data: {
            name: 'firstAsset',
            type: '3D',
            url: 'firstasseturl.com',
            displayName: 'firstAsset DN',
            displayDescription: 'Group description',
            altTag: '',
          },
          index: 1,
        },
      ];

      await importMarketingAssets(ctx, assetRow);

      const updatedAssetRow = [
        {
          data: {
            name: 'firstAsset',
            type: '3D',
            url: 'updatedfirstasseturl.com',
            displayName: 'firstAsset DN updated',
            displayDescription: 'Group description updated',
            altTag: 'updated altTag',
          },
          index: 1,
        },
      ];

      await importMarketingAssets(ctx, updatedAssetRow);

      const assets = await getMarketingAssets(ctx);
      expect(assets.length).to.equal(1);
      expect(assets[0].displayName).to.equal('firstAsset DN updated');
      expect(assets[0].displayDescription).to.equal('Group description updated');
      expect(assets[0].url).to.equal('updatedfirstasseturl.com');
      expect(assets[0].altTag).to.equal('updated altTag');
    });
  });
});
