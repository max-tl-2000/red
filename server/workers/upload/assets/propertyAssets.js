/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveAsset } from './assetsS3Upload';
import { DALTypes } from '../../../../common/enums/DALTypes';
import loggerModule from '../../../../common/helpers/logger';
import { parseMetadataInFilePath, parseMetadataInRxpFilePath } from '../../../helpers/assets-helper';
import { processMarketingAsset } from './marketingAssets';

const logger = loggerModule.child({ subType: 'fileUpload' });

const AMENITIES = 'Amenities';
const BUILDINGS = 'Buildings';
const LAYOUTS = 'Layouts';
const PROPERTY = 'Property';
const INVENTORY = 'Inventory';
const INVENTORY_GROUPS = 'Inventory Groups';
const LIFESTYLES = 'Lifestyles';
const PROPERTY_MARKETING = 'Property Marketing';
const MARKETING_LAYOUTS = 'Marketing Layouts';
const MARKETING_LAYOUTS_GROUPS = 'Marketing Layout Groups';
const ASSETS = 'Assets';
const RXP = 'rxp';

const processAmenity = async (ctx, filePath, propertyName, [category, name], rootDirectory) => {
  if (!category || !name) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.AMENITY,
    propertyName,
    category,
    name,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processBuilding = async (ctx, filePath, propertyName, buildingName, rootDirectory) => {
  if (!buildingName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.BUILDING,
    propertyName,
    name: buildingName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processBuildingInventory = async (ctx, filePath, propertyName, buildingName, inventoryName, rootDirectory) => {
  if (!buildingName || !inventoryName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.INVENTORY,
    name: inventoryName,
    buildingName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processInventory = async (ctx, filePath, propertyName, [inventoryName], rootDirectory) => {
  if (!inventoryName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.INVENTORY,
    name: inventoryName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processInventoryGroup = async (ctx, filePath, propertyName, [inventoryGroupName], rootDirectory) => {
  if (!inventoryGroupName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.INVENTORY_GROUP,
    name: inventoryGroupName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processLifestyle = async (ctx, filePath, propertyName, [lifestyleName], rootDirectory) => {
  if (!lifestyleName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.LIFESTYLE,
    name: lifestyleName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processLayout = async (ctx, filePath, propertyName, [layoutName], rootDirectory) => {
  if (!layoutName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.LAYOUT,
    name: layoutName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processMarketingLayoutGroup = async (ctx, filePath, propertyName, [layoutName], rootDirectory) => {
  if (!layoutName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.MARKETING_LAYOUT_GROUP,
    name: layoutName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processMarketingLayout = async (ctx, filePath, propertyName, [layoutName], rootDirectory) => {
  if (!layoutName) return;
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.MARKETING_LAYOUT,
    name: layoutName,
    propertyName,
    ...metadata,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processMarketingPropertyImage = async (ctx, filePath, propertyName, rootDirectory) => {
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.PROPERTY_MARKETING,
    name: propertyName,
    ...metadata,
  };

  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processPropertyImage = async (ctx, filePath, propertyName, rootDirectory) => {
  const metadata = parseMetadataInFilePath(filePath);
  const entity = {
    type: DALTypes.AssetType.PROPERTY,
    name: propertyName,
    ...metadata,
  };

  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const processRxpImage = async (ctx, { filePath, propertyName, category, rootDirectory }) => {
  const metadata = parseMetadataInRxpFilePath(ctx, filePath);
  const entity = {
    type: DALTypes.AssetType.PROPERTY_ASSET,
    app: RXP,
    propertyName,
    category,
    ...metadata,
  };

  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const handlers = {
  [AMENITIES]: processAmenity,
  [INVENTORY]: processInventory,
  [INVENTORY_GROUPS]: processInventoryGroup,
  [LAYOUTS]: processLayout,
  [LIFESTYLES]: processLifestyle,
  [MARKETING_LAYOUTS]: processMarketingLayout,
  [MARKETING_LAYOUTS_GROUPS]: processMarketingLayoutGroup,
};

export const processPropertyAssets = async (ctx, { filePath, folders: [propertyName, propertyItem, ...folders], rootDirectory }) => {
  if (propertyItem === PROPERTY) {
    return await processPropertyImage(ctx, filePath, propertyName, rootDirectory);
  }

  if (propertyItem === PROPERTY_MARKETING) {
    return await processMarketingPropertyImage(ctx, filePath, propertyName, rootDirectory);
  }

  if (propertyItem === BUILDINGS) {
    const [buildingName, category, name] = folders;
    if (category === INVENTORY) {
      return await processBuildingInventory(ctx, filePath, propertyName, buildingName, name, rootDirectory);
    }

    return await processBuilding(ctx, filePath, propertyName, buildingName, rootDirectory);
  }

  // "folders.length > 1" validates that we are not evaluating if the filename has "rxp" in it
  if (propertyItem === ASSETS && folders.length > 1 && folders[0] === RXP) {
    return await processRxpImage(ctx, { filePath, propertyName, category: folders[1], rootDirectory });
  }

  if (propertyItem === ASSETS) {
    return await processMarketingAsset(ctx, { filePath, propertyName, rootDirectory });
  }

  const handler = handlers[propertyItem];
  handler ? await handler(ctx, filePath, propertyName, folders, rootDirectory) : logger.warn('No handler was found for ', propertyItem);

  return Promise.resolve();
};
