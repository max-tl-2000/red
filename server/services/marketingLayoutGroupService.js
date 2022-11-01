/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import { mapSeries } from 'bluebird';
import loggerModule from '../../common/helpers/logger';
import { getMarketingInventoriesWithDetails, sortInventoryAvailabilityDateAndState } from './marketingInventoryService';
import { getMarketingLayoutsDetails } from '../dal/marketingLayoutsRepo';
import { getInventoriesOnHold } from '../dal/inventoryRepo';
import { formatAssetUrl } from '../workers/upload/uploadUtil';
import { getPropertyById, getPropertySettingsByKey } from '../dal/propertyRepo';
import { getMinValue } from '../../common/helpers/number';

const logger = loggerModule.child({ subType: 'marketingLayoutGroup' });

const getMarketingLayoutBaseInfo = marketingLayout => ({
  propertyId: marketingLayout.propertyId,
  marketingLayoutId: marketingLayout.id,
  name: marketingLayout.name,
  displayName: marketingLayout.displayName,
  description: marketingLayout.description,
  numBedrooms: marketingLayout.numBedrooms,
  numBathrooms: marketingLayout.numBathrooms,
  surfaceArea: { min: marketingLayout.minSurfaceArea, max: marketingLayout.maxSurfaceArea },
});

const getAvailableInventoryIds = (inventoriesOnHold, inventoryIds) =>
  inventoryIds.filter(id => !inventoriesOnHold.find(heldInventory => heldInventory.inventoryId === id));

export const respondToMarketingLayoutGroupRequest = async (ctx, { propertyId, marketingLayoutGroupId, limit }) => {
  logger.trace({ ctx, propertyId, marketingLayoutGroupId, limit, readOnlyServer: ctx.readOnlyServer }, 'handling marketing layout group request');
  const property = await getPropertyById(ctx, propertyId);
  const daughterPropertiesIds = property.daughterProperties;
  const allPropertiesIds = [property.id, ...daughterPropertiesIds];

  const marketingLayouts = await getMarketingLayoutsDetails(ctx, { propertyIds: allPropertiesIds, marketingLayoutGroupId });

  const { setting } = (await getPropertySettingsByKey(ctx, propertyId, 'marketing')) || {};
  const { maxVacantReadyUnits, maxUnitsInLayout } = setting || {};

  const maxVacantReadyUnitsForProperty = daughterPropertiesIds.length ? Math.ceil(maxVacantReadyUnits / daughterPropertiesIds.length + 1) : maxVacantReadyUnits;
  const maxUnitsInLayoutForProperty = daughterPropertiesIds.length ? Math.ceil(maxUnitsInLayout / daughterPropertiesIds.length + 1) : maxUnitsInLayout;

  const inventoriesOnHold = await getInventoriesOnHold(ctx);

  const allMarketingLayouts = await mapSeries(marketingLayouts, async ml => ({
    ...getMarketingLayoutBaseInfo(ml),
    imageUrl: ml.assetId && formatAssetUrl(ctx.tenantId, ml.assetId),
    inventory: await getMarketingInventoriesWithDetails(ctx, {
      inventoryIds: getAvailableInventoryIds(inventoriesOnHold, ml.inventoryIds),
      unitsInLayout: true,
      maxVacantReadyUnits: maxVacantReadyUnitsForProperty,
      limit: getMinValue(limit, maxUnitsInLayoutForProperty),
    }),
  }));

  const allMarketingLayoutNames = uniq(allMarketingLayouts.map(ml => ml.name));
  const results = [];

  allMarketingLayoutNames.forEach(name => {
    const marketingLayoutsByName = allMarketingLayouts.filter(ml => ml.name === name);
    const marketingLayout = marketingLayoutsByName.find(ml => ml.name === name);
    const allInventories = flatten(marketingLayoutsByName.map(ml => ml.inventory));
    const sortedInventories = allInventories.sort(sortInventoryAvailabilityDateAndState);

    if (marketingLayout) {
      results.push({
        ...marketingLayout,
        inventory: sortedInventories,
      });
    }
  });

  return results;
};
