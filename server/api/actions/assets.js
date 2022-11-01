/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import URL from 'url';
import {
  validateAssets as validateAssetsService,
  getAssetUrlsByEntityId as getAssetUrlsByEntityIdService,
  getMarketingAssetByPath as getMarketingAssetByPathService,
  getPropertyAssets,
  getPropertyAssetsAssociatedWithUnits,
  getTenantRxpAsset,
  getPropertyRxpAsset,
} from '../../services/assets';
import { DALTypes } from '../../../common/enums/DALTypes';
import { uuid as validateUuid } from '../../../rentapp/server/api/helpers/validators';
import { ServiceError } from '../../common/errors';
import { getKeyByValue } from '../../../common/enums/enumHelper';
import { getUserFullNameById } from '../../dal/usersRepo';
import { getSmallAvatar, init as initCloudinaryHelpers, buildCloudinaryUrl } from '../../../common/helpers/cloudinary';
import { buildPropertyAssetsSitemap } from '../../sitemap/sitemap-templates';
import config from '../../config';
import logger from '../../../common/helpers/logger';

const throwServiceErrorIfNeeded = (assertCriteria, token, statusCode = 400) => {
  if (assertCriteria) throw new ServiceError({ token, status: statusCode });
};

const getValidAssetType = assetType => {
  const assetTypeKey = getKeyByValue(DALTypes.AssetType, assetType);
  const isAssetTypeValid =
    assetTypeKey &&
    [DALTypes.AssetType.PROPERTY, DALTypes.AssetType.INVENTORY, DALTypes.AssetType.EMPLOYEE, DALTypes.AssetType.PROPERTY_ASSET].some(
      type => type === DALTypes.AssetType[assetTypeKey],
    );
  throwServiceErrorIfNeeded(!assetTypeKey || !isAssetTypeValid, 'INVALID_ASSET_TYPE');

  return DALTypes.AssetType[assetTypeKey];
};

export const validateAssets = async req => await validateAssetsService(req);

export const getAssetUrlByEntityId = async (req, res) => {
  const { assetType: type, entityId } = req.params;
  const { cParams = '' } = req.query;
  logger.trace({ ctx: req, ...req.params, cParams }, 'getAssetUrlByEntityId');

  validateUuid(entityId, 'INVALID_ENTITY_ID');
  const assetType = getValidAssetType(type);

  const entityAssets = await getAssetUrlsByEntityIdService(req, { entityId, assetType, limit: 1 });
  let entityAssetUrl = entityAssets[0]?.url;

  if (!entityAssetUrl && assetType === DALTypes.AssetType.EMPLOYEE) {
    const agentFullName = await getUserFullNameById(req, entityId);

    initCloudinaryHelpers({
      cloudName: config.cloudinaryCloudName,
      tenantName: req.tenantName,
      isPublicEnv: config.isPublicEnv,
      isDevelopment: config.isDevelopment,
      domainSuffix: config.domainSuffix,
      reverseProxyUrl: config.reverseProxy.url,
      rpImageToken: config.rpImageToken,
      cloudEnv: config.cloudEnv,
    });

    entityAssetUrl = getSmallAvatar(null, agentFullName);
    return res.redirect(301, entityAssetUrl);
  }

  if (!config.isDevelopment) {
    entityAssetUrl = buildCloudinaryUrl(`/${entityAssetUrl}`, { buildParameters: () => cParams });
  }

  return entityAssetUrl ? res.redirect(301, entityAssetUrl) : res.status(404).send();
};

export const getTenantRxpAssetByCategory = async (req, res) => {
  const { category } = req.params;
  const { theme, cParams } = req.query;
  throwServiceErrorIfNeeded(!category, 'ASSET_CATEGORY_NOT_DEFINED');

  const entityAssetUrl = await getTenantRxpAsset(req, { category, theme, cParams });

  return entityAssetUrl ? res.redirect(301, entityAssetUrl) : res.status(404).send();
};

export const getPropertyRxpAssetByCategory = async (req, res) => {
  const { category, propertyId } = req.params;
  const { theme, cParams } = req.query;

  throwServiceErrorIfNeeded(!category, 'ASSET_CATEGORY_NOT_DEFINED');
  throwServiceErrorIfNeeded(!propertyId, 'PROPERTY_ID_NOT_DEFINED');
  validateUuid(propertyId, 'INVALID_PROPERTY_ID');

  const entityAssetUrl = await getPropertyRxpAsset(req, { propertyId, category, theme, cParams });

  return entityAssetUrl ? res.redirect(301, entityAssetUrl) : res.status(404).send();
};

const getMarketingAssetByPath = async (req, res, { assetType, propertyName, pathToFile }) => {
  const assetUrl = await getMarketingAssetByPathService(req, { assetType, propertyName, pathToFile });

  return assetUrl ? res.redirect(301, assetUrl) : res.status(404).send();
};

const getPathToFileInFolderStructure = (url, folderStructurePrefix = '/') => {
  const { pathname = '' } = URL.parse(url || '', true);
  let urlSections = pathname.split('/');
  const assetsIndex = urlSections.findIndex(it => it.toLowerCase() === 'assets');
  if (assetsIndex < 0) return null;

  urlSections = urlSections.slice(assetsIndex); // remove the endpoint path
  urlSections.splice(1, 1); // remove global o property name

  const pathToFile = urlSections.join('/');
  return `${folderStructurePrefix}${pathToFile}`;
};

export const getGlobalMarketingAssetByPath = async (req, res) => {
  const pathToFile = getPathToFileInFolderStructure(req.url);
  throwServiceErrorIfNeeded(!pathToFile, 'INVALID_PATH_TO_FILE');

  return getMarketingAssetByPath(req, res, { assetType: DALTypes.AssetType.GLOBAL_ASSET, pathToFile });
};

export const getPropertyMarketingAssetByPath = async (req, res) => {
  const { propertyName } = req.params;
  throwServiceErrorIfNeeded(!propertyName, 'INVALID_PROPERTY_NAME');

  const pathToFile = getPathToFileInFolderStructure(req.url, `/properties/${propertyName}/`);
  throwServiceErrorIfNeeded(!pathToFile, 'INVALID_PATH_TO_FILE');

  return getMarketingAssetByPath(req, res, { assetType: DALTypes.AssetType.PROPERTY_ASSET, propertyName, pathToFile });
};

export const getPropertyAssetsSitemap = async (req, res) => {
  const { include = '' } = req.query;
  const includeUnits = include.toLowerCase() === 'units';
  const includeAllUnits = include.toLowerCase() === 'allunits';

  const [propertyAssets, unitsAssociatedToLayouts] = await Promise.all([
    getPropertyAssets(req),
    ...(includeUnits || includeAllUnits ? [getPropertyAssetsAssociatedWithUnits(req, includeAllUnits)] : []),
  ]);
  const sitemap = await buildPropertyAssetsSitemap(req, { propertyAssets, unitsAssociatedToLayouts });

  res.set({ 'Content-Type': 'text/xml' });
  res.send(sitemap);
};
