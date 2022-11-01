/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import {
  getAssetsByEntityType,
  getAssetIdByEntityIdAndAssetType,
  getMarketingAssetByPath as getMarketingAssetByPathRepo,
  getMarketingAssetsByDirectoryPath as getMarketingAssetsByDirectoryPathRepo,
  getPropertyAssets as getPropertyAssetsRepo,
  getPropertyAssetsAssociatedWithUnits as getPropertyAssetsAssociatedWithUnitsRepo,
  getLogoAssetForProperty,
  getTenantRxpAssetByCategory,
  getPropertyRxpAssetByCategory,
} from '../dal/assetsRepo';
import { getUserByExternalUniqueId } from '../dal/usersRepo';
import { getPropertyByName } from '../dal/propertyRepo';
import { getAmenity, getLifestyle } from '../dal/amenityRepo';
import { getBuildingByNameAndPropertyName } from '../dal/buildingRepo';
import { getInventoryByPropertyAndBuilding, getInventoryByPropertyName } from '../dal/inventoryRepo';
import { getInventoryGroupByNameAndProperty } from '../dal/inventoryGroupRepo';
import { getLayoutByName } from '../dal/layoutRepo';
import { formatAssetUrl } from '../workers/upload/uploadUtil';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { formatEntityAssetUrl } from '../helpers/tenantContextConfigs';
import { AssetThemeTypes, AssetTheme } from '../../common/enums/enums';
import { ServiceError } from '../common/errors';
import config from '../config';
import { buildCloudinaryUrl } from '../../common/helpers/cloudinary';
import logger from '../../common/helpers/logger';

const validateEmployees = async (ctx, assetType) => {
  const assets = await getAssetsByEntityType(ctx, { type: assetType });
  const entities = await execConcurrent(assets, async asset => ({
    assetId: asset.uuid,
    physicalAssetId: asset.physicalAssetId,
    externalUniqueId: asset.entity.externalUniqueId,
    entity: await getUserByExternalUniqueId(ctx, asset.entity.externalUniqueId),
  }));

  const formatString = a => `uuid:${a.assetId} ${assetType} externalUniqueId:${a.externalUniqueId}`;
  const validationErrors = entities.filter(e => !e.physicalAssetId || !e.entity).reduce((acc, a) => [...acc, formatString(a)], []);

  return {
    type: assetType,
    validationErrors,
  };
};

const validateAmenities = async ctx => {
  const assets = await getAssetsByEntityType(ctx, {
    type: DALTypes.AssetType.AMENITY,
  });

  const amenities = await execConcurrent(assets, async asset => {
    const { name, category, propertyName } = asset.entity;
    const propertyId = ((await getPropertyByName(ctx, propertyName)) || {}).id;

    return {
      name,
      category,
      propertyName,
      physicalAssetId: asset.physicalAssetId,
      amenity: await getAmenity(ctx, name, category, propertyId),
    };
  });

  const formatString = a => `property:${a.propertyName} amenity:${a.name} category:${a.category} `;
  const validationErrors = amenities.filter(a => !a.physicalAssetId || !a.amenity).reduce((acc, a) => [...acc, formatString(a)], []);
  return {
    type: DALTypes.AssetType.AMENITY,
    validationErrors,
  };
};

const validateInventories = async ctx => {
  const assets = await getAssetsByEntityType(ctx, {
    type: DALTypes.AssetType.INVENTORY,
  });

  const inventories = await execConcurrent(assets, async asset => {
    const { name, propertyName, buildingName } = asset.entity;

    return {
      name,
      propertyName,
      buildingName,
      physicalAssetId: asset.physicalAssetId,
      inventory: buildingName
        ? await getInventoryByPropertyAndBuilding(ctx, name, propertyName, buildingName)
        : await getInventoryByPropertyName(ctx, name, propertyName),
    };
  });

  const formatString = i => `property:${i.propertyName} building:${i.buildingName || ''} inventory:${i.name}`;
  const validationErrors = inventories.filter(i => !i.physicalAssetId || !i.inventory).reduce((acc, i) => [...acc, formatString(i)], []);
  return {
    type: DALTypes.AssetType.INVENTORY,
    validationErrors,
  };
};

const validatePropertyAsset = async (ctx, assetType, repoFunc) => {
  const assets = await getAssetsByEntityType(ctx, { type: assetType });
  const entities = await execConcurrent(assets, async asset => {
    const { name, propertyName } = asset.entity;

    return {
      name,
      propertyName,
      physicalAssetId: asset.physicalAssetId,
      entity: await repoFunc(ctx, name, propertyName),
    };
  });

  const formatString = a => `property:${a.propertyName} ${assetType}:${a.name}`;
  const validationErrors = entities.filter(e => !e.physicalAssetId || !e.entity).reduce((acc, a) => [...acc, formatString(a)], []);
  return {
    type: assetType,
    validationErrors,
  };
};

const validateBuildings = async ctx => validatePropertyAsset(ctx, DALTypes.AssetType.BUILDING, getBuildingByNameAndPropertyName);
const validateLayouts = ctx => validatePropertyAsset(ctx, DALTypes.AssetType.LAYOUT, getLayoutByName);
const validateInventoryGroups = ctx => validatePropertyAsset(ctx, DALTypes.AssetType.INVENTORY_GROUP, getInventoryGroupByNameAndProperty);
const validateLifestyles = ctx => validatePropertyAsset(ctx, DALTypes.AssetType.LIFESTYLE, getLifestyle);
const validateProperty = ctx => validatePropertyAsset(ctx, DALTypes.AssetType.PROPERTY, getPropertyByName);

export const validateAssets = async ctx => {
  const results = await execConcurrent(
    [
      validateEmployees(ctx, DALTypes.AssetType.AVATAR),
      validateEmployees(ctx, DALTypes.AssetType.EMPLOYEE),
      validateAmenities(ctx),
      validateBuildings(ctx),
      validateLayouts(ctx),
      validateInventories(ctx),
      validateInventoryGroups(ctx),
      validateLifestyles(ctx),
      validateProperty(ctx),
    ],
    async promise => await promise,
  );

  return {
    results,
    isValid: results.every(r => !r.validationErrors.length),
  };
};

export const getAssetsUrls = (ctx, assets = []) => assets.map(a => ({ metadata: a.metadata, url: formatAssetUrl(ctx.tenantId, a.assetId) }));

export const getAssetUrlsByEntityId = async (ctx, { entityId, assetType, limit, getMetadata = false }) => {
  const assets = await getAssetIdByEntityIdAndAssetType(ctx, { entityId, assetType, limit, getMetadata });

  return getAssetsUrls(ctx, assets);
};

export const getMarketingAssetByPath = async (ctx, { assetType, propertyName, pathToFile }) => {
  const asset = await getMarketingAssetByPathRepo(ctx, { assetType, propertyName, pathToFile });

  return formatAssetUrl(ctx.tenantId, asset?.assetId);
};

export const getLogoForProperty = async (ctx, { propertyName } = {}) => {
  const asset = await getLogoAssetForProperty(ctx, { propertyName });
  if (!asset || !asset.assetId) {
    return '';
  }

  const assetType = DALTypes.AssetType.PROPERTY_ASSET;

  return await formatEntityAssetUrl(ctx, asset.assetId, assetType, { permaLink: true });
};

export const getMarketingAssetsByDirectoryPath = async (ctx, { assetType, propertyName, directoryPath }) => {
  const assets = await getMarketingAssetsByDirectoryPathRepo(ctx, { assetType, propertyName, directoryPath });
  if (!assets.length) {
    return '';
  }
  const asset = assets[0]; // We return the first asset for now
  return await formatEntityAssetUrl(ctx, asset.assetId, assetType, { permaLink: true });
};

export const getPropertyAssets = async ctx => await getPropertyAssetsRepo(ctx);

export const getPropertyAssetsAssociatedWithUnits = async (ctx, includeAllUnits = false) =>
  await getPropertyAssetsAssociatedWithUnitsRepo(ctx, includeAllUnits);

const validateAssetTheme = theme => {
  if (theme && !AssetThemeTypes.some(assetTheme => assetTheme === theme)) {
    throw new ServiceError({ token: 'ASSET_THEME_NOT_FOUND', status: 404 });
  }
};

const getEntityAssetUrl = (ctx, { asset, cParams }) => {
  if (!asset?.assetId) {
    logger.error({ ctx, asset, cParams }, 'Asset id is not defined');
    throw new ServiceError({ token: 'ASSET_ID_NOT_DEFINED', status: 404 });
  }

  const [assetUrlObj] = getAssetsUrls(ctx, [asset]);
  const assetUrl = assetUrlObj.url;
  const entityAssetUrl = !config.isDevelopment && cParams ? buildCloudinaryUrl(`/${assetUrl}`, { buildParameters: () => cParams }) : assetUrl;
  return entityAssetUrl;
};

export const getTenantRxpAsset = async (ctx, { category, theme, cParams }) => {
  validateAssetTheme(theme);

  const asset = await getTenantRxpAssetByCategory(ctx, { category, theme: theme || AssetTheme.LIGHT }, 1);
  return getEntityAssetUrl(ctx, { asset, cParams });
};

export const getPropertyRxpAsset = async (ctx, { propertyId, category, theme, cParams }) => {
  validateAssetTheme(theme);

  const asset = await getPropertyRxpAssetByCategory(ctx, { propertyId, category, theme: theme || AssetTheme.LIGHT }, 1);
  return getEntityAssetUrl(ctx, { asset, cParams });
};
