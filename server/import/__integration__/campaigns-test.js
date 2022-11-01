/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importCampaigns } from '../inventory/campaigns';
import { getCampaigns } from '../../dal/campaignsRepo';
import { getOneWhere } from '../../database/factory';

describe('inventory/campaigns', () => {
  describe('when importing a new campaign', () => {
    it('will save the campaign', async () => {
      const firstCampaign = {
        name: 'Campaign1',
        displayName: 'Campaign1DN',
        description: 'Campaign description',
      };

      const secondCampaign = {
        name: 'Campaign2',
        displayName: 'Campaign2DN',
        description: 'Campaign description',
      };

      const campaignRows = [
        {
          data: firstCampaign,
          index: 1,
        },
        {
          data: secondCampaign,
          index: 2,
        },
      ];
      await importCampaigns(ctx, campaignRows);

      const campaigns = await getCampaigns(ctx);
      expect(campaigns.length).to.equal(2);

      const dbFirstCampaign = await getOneWhere(ctx.tenantId, 'Campaigns', { name: firstCampaign.name });
      expect(dbFirstCampaign.name).to.equal(firstCampaign.name);
      expect(dbFirstCampaign.displayName).to.equal(firstCampaign.displayName);
      expect(dbFirstCampaign.description).to.equal(firstCampaign.description);
    });
  });

  describe('when importing an already imported campaign', () => {
    it('will update the existing one', async () => {
      const campaignRow = [
        {
          data: {
            name: 'Campaign1',
            displayName: 'Campaign1DN',
            description: 'Campaign description',
          },
          index: 1,
        },
      ];
      await importCampaigns(ctx, campaignRow);

      const updatedCampaignRow = [
        {
          data: {
            name: 'Campaign1',
            displayName: 'Campaign1DN',
            description: 'Campaign description updated',
          },
          index: 1,
        },
      ];

      await importCampaigns(ctx, updatedCampaignRow);

      const campaigns = await getCampaigns(ctx);
      expect(campaigns.length).to.equal(1);
      expect(campaigns[0].description).to.equal('Campaign description updated');
    });
  });
});
