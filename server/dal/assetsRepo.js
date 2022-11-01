/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, rawStatement, runInTransaction, insertInto } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

import logger from '../../common/helpers/logger';

export const createAsset = async (ctx, asset, { shouldCreatePhysicalAsset, checksum } = {}) =>
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };

    const physicalAsset = shouldCreatePhysicalAsset && (await insertInto(innerCtx, 'PhysicalAsset', { id: asset.physicalAssetId, checksum }));

    return await initQuery(innerCtx)
      .insert({
        ...asset,
        physicalAssetId: asset.physicalAssetId || physicalAsset.id,
      })
      .into('Assets')
      .returning('*');
  }, ctx);

export const clearAssets = async (ctx, assetBasePath) => {
  const query = `
    DELETE from db_namespace."Assets"
    WHERE "path" ILIKE concat(:assetBasePath::varchar, '%')
    RETURNING uuid, "physicalAssetId";`;

  const { rows } = await rawStatement(ctx, query, [{ assetBasePath }]);
  return rows;
};

export const getPhysicalAssetIdByChecksum = async (ctx, checksum) => {
  const query = `
    SELECT id as "physicalAssetId" FROM db_namespace."PhysicalAsset"
    WHERE "checksum" = :checksum
    LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ checksum }]);
  return rows && rows[0] && rows[0].physicalAssetId;
};

export const cleanupOrphanedPhysicalAssets = async ctx => {
  logger.trace({ ctx }, 'cleanupOrphanedPhysicalAssets');

  const query = `
    WITH orphanedPhysicalAssets AS
    (
      SELECT
        "PhysicalAsset".id as "physicalAssetId"
      FROM db_namespace."PhysicalAsset"
      LEFT JOIN db_namespace."Assets" ON "PhysicalAsset".id = "Assets"."physicalAssetId"
      WHERE "Assets"."physicalAssetId" IS NULL
    )
    DELETE FROM db_namespace."PhysicalAsset"
    USING orphanedPhysicalAssets
    WHERE "PhysicalAsset".id = orphanedPhysicalAssets."physicalAssetId"
    RETURNING "PhysicalAsset".id AS "physicalAssetId";`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getAssetsByEntityType = async (ctx, entity, limit) => {
  const query = Object.keys(entity).reduce(
    (acc, key) => {
      if (acc.where.length) acc.where.push(' AND ');
      acc.where.push(`entity->>\'${key}\' = ?`); // eslint-disable-line no-useless-escape
      acc.bindings.push(entity[key]);
      return acc;
    },
    { where: [], bindings: [] },
  );

  let theQuery = initQuery(ctx).select('*').from('Assets').whereRaw(query.where.join(''), query.bindings).orderByRaw("entity->'rank' asc");

  if (limit) {
    theQuery = theQuery.limit(limit);
  }

  return await theQuery;
};

export const getTenantRxpAssetByCategory = async (ctx, filter, limit) => {
  logger.trace({ ctx, filter }, 'getTenantRxpAssetByFilter');

  const { category, theme } = filter;

  const query = `
    SELECT a."physicalAssetId" AS "assetId"
    FROM db_namespace."Assets" a
    WHERE a.entity->>'category' = :category AND a.entity->>'theme' = :theme
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ category, theme }]);
  return rows.length ? rows[0] : null;
};

export const getPropertyRxpAssetByCategory = async (ctx, filter, limit) => {
  logger.trace({ ctx, filter }, 'getPropertyRxpAssetByFilter');

  const { category, theme, propertyId } = filter;

  const query = `
    SELECT a."physicalAssetId" AS "assetId"
    FROM db_namespace."Assets" a
    INNER JOIN db_namespace."Property" p ON p.id = :propertyId
    WHERE a.entity->>'propertyName' = p.name AND a.entity->>'category' = :category AND a.entity->>'theme' = :theme
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ category, theme, propertyId }]);
  return rows.length ? rows[0] : null;
};

export const getAssetIdByEntityIdAndAssetType = async (ctx, { entityId, assetType, limit, getMetadata }) => {
  const metadata = getMetadata ? ', a.entity AS metadata' : '';

  let query = '';
  const buildQuery = entityIdField => `SELECT a."physicalAssetId" AS "assetId", ${entityIdField} AS "entityId" ${metadata} FROM db_namespace."Assets" AS a`;
  const filterCritiriaByEntityId = Array.isArray(entityId) ? `IN (${entityId.map(id => `'${id}'`).join(',')})` : '= :entityId';

  switch (assetType) {
    case DALTypes.AssetType.PROPERTY_MARKETING:
    case DALTypes.AssetType.PROPERTY:
      query = `${buildQuery('p.id')}
        INNER JOIN db_namespace."Property" AS p ON p.id ${filterCritiriaByEntityId} AND p.name = a.entity->>'name'
        WHERE a.entity->>'type' = '${DALTypes.AssetType.PROPERTY}'
        ORDER BY a.entity->'rank' ASC
      `;
      break;
    case DALTypes.AssetType.PROPERTY_ASSET:
      query = `${buildQuery('a."physicalAssetId"')}
        WHERE a.entity->>'type' = '${DALTypes.AssetType.PROPERTY_ASSET}' AND a."physicalAssetId" ${filterCritiriaByEntityId}
        ORDER BY a.entity->'rank' ASC
      `;
      break;
    case DALTypes.AssetType.INVENTORY:
    case DALTypes.AssetType.LAYOUT:
      /* eslint-disable no-useless-escape */
      query = `${buildQuery('us.id')}
        INNER JOIN db_namespace."UnitSearch" AS us ON us.id ${filterCritiriaByEntityId} AND us.inventory_object->>'propertyName' = a.entity->>'propertyName'
        INNER JOIN db_namespace."Inventory" as i on i.id = us.id
        INNER JOIN db_namespace."Layout" as ly on i."layoutId" = ly.id
        WHERE a.entity->>'type' = '${DALTypes.AssetType.LAYOUT}'
        AND (ly."name" = a.entity->>'name' OR ly."name" ILIKE concat(a.entity->>'name', '\_%'))
        ORDER BY a.entity->>'name' desc, a.entity->'rank' ASC
      `;
      /* eslint-enable no-useless-escape */
      break;
    case DALTypes.AssetType.EMPLOYEE:
    case DALTypes.AssetType.AVATAR:
      query = `${buildQuery('u.id')}
        INNER JOIN db_namespace."Users" AS u ON u.id ${filterCritiriaByEntityId} AND u."externalUniqueId" = a.entity->>'externalUniqueId'
        ORDER BY a.created_at DESC
      `;
      break;
    default:
      return null;
  }

  query = limit ? `${query} LIMIT ${limit}` : query;

  const { rows } = await rawStatement(ctx, query, [{ entityId, assetType }]);
  return rows;
};

export const getMarketingAssetByPath = async (ctx, { assetType, propertyName, pathToFile }) => {
  const propertyAsset = propertyName ? "AND a.entity->>'propertyName' = :propertyName" : '';
  const query = `
    SELECT
      a."physicalAssetId" AS "assetId"
    FROM db_namespace."Assets" AS a
    WHERE a.entity->>'type' = :assetType
    AND a.path ilike :pathToFile
    ${propertyAsset}
    ORDER BY a.created_at DESC
    limit 1
  `;

  const { rows } = await rawStatement(ctx, query, [{ assetType, propertyName, pathToFile }]);
  return rows[0];
};

export const getMarketingAssetsByDirectoryPath = async (ctx, { assetType, propertyName, directoryPath }) => {
  const propertyAsset = propertyName ? "AND a.entity->>'propertyName' = :propertyName" : '';
  const query = `
    SELECT
      a."physicalAssetId" AS "assetId"
    FROM db_namespace."Assets" AS a
    WHERE a.entity->>'type' = :assetType
    AND a.path ilike :path
    ${propertyAsset}
  `;

  const { rows } = await rawStatement(ctx, query, [{ assetType, propertyName, path: `${directoryPath}%` }]);
  return rows;
};

export const getLogoAssetForProperty = async (ctx, { propertyName } = {}) => {
  // property logo by convention is the one inside the /Assets folder in the Properties/PropertyName folder
  // the name of the file to be used as logo is always logo.png
  const query = `
    SELECT
      a."physicalAssetId" AS "assetId"
    FROM db_namespace."Assets" AS a
    WHERE a.entity->>'type' = :assetType
    AND a.path ilike '/properties/' || :propertyName::TEXT || '/Assets/logo/logo.png%'
    AND a.entity->>'propertyName' = :propertyName
  `;

  const { rows } = await rawStatement(ctx, query, [{ assetType: DALTypes.AssetType.PROPERTY_ASSET, propertyName }]);
  return rows[0];
};

export const getPropertyAssets = async ctx => {
  const query = `
    SELECT
      p.name as "propertyName",
      a."physicalAssetId",
      a.entity->>'label' as caption,
      a. entity->>'type' as "assetType",
      a.entity->>'name' as "name"
    FROM db_namespace."Assets" AS a
    INNER JOIN db_namespace."Property" AS p on (a.entity->>'type' = '${DALTypes.AssetType.PROPERTY}' AND a.entity->>'name' = p.name) OR (a.entity->>'type' = '${DALTypes.AssetType.LAYOUT}' AND a.entity->>'propertyName' = p.name)
    WHERE
      COALESCE(NULLIF(p.settings->'marketing'->>'includedInListings', ''), '0')::BOOLEAN IS TRUE
      AND p.inactive IS FALSE
      AND p."endDate" IS NULL
      AND
      CASE
        WHEN a.entity->>'type' = '${DALTypes.AssetType.PROPERTY}' THEN 1
        WHEN a.entity->>'type' = '${DALTypes.AssetType.LAYOUT}' AND COALESCE(NULLIF(a.entity->>'floorPlan', ''), '0')::BOOLEAN IS TRUE THEN 1
        ELSE 0
      END = 1
    ORDER BY p."name" ASC, a. entity->>'type' DESC,
    CASE
      WHEN a.entity->>'type' = '${DALTypes.AssetType.PROPERTY}' THEN a.entity->'rank'
      WHEN a.entity->>'type' = '${DALTypes.AssetType.LAYOUT}' THEN a.entity->'name'
      ELSE a.entity->'rank'
    END ASC
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getPropertyAssetsAssociatedWithUnits = async (ctx, includeAllUnits = false) => {
  const excludedUnits = !includeAllUnits
    ? `AND i.state NOT IN ('${DALTypes.InventoryState.OCCUPIED}', '${DALTypes.InventoryState.ADMIN}', '${DALTypes.InventoryState.DOWN}', '${DALTypes.InventoryState.UNAVAILABLE}')`
    : '';
  /* eslint-disable no-useless-escape */
  const query = `
    WITH assets AS (
      SELECT
      DISTINCT
      p.id AS "propertyId",
      p.name as "propertyName",
      p."externalId" as "propertyExternalId",
      a.entity->>'name' AS "assetLayoutName"
      FROM db_namespace."Assets" AS a
      INNER JOIN db_namespace."Property" AS p ON a.entity->>'propertyName' = p.name
      WHERE a.entity->>'type' = '${DALTypes.AssetType.LAYOUT}'
      AND COALESCE(NULLIF(a.entity->>'floorPlan', ''), '0')::BOOLEAN IS TRUE
      AND COALESCE(NULLIF(p.settings->'marketing'->>'includedInListings', ''), '0')::BOOLEAN IS TRUE
      AND p.inactive IS FALSE
      AND p."endDate" IS NULL
      ORDER BY p."id", a.entity->>'name'
    )

    SELECT
    CONCAT_WS('-', a."propertyExternalId", NULLIF(b."externalId", ''), i."externalId") AS "externalId",
    a."propertyName",
    a."assetLayoutName",
    l."name" as "layoutName",
    l."displayName" as "layoutDisplayName",
    ml."displayName" as "marketingLayoutDisplayName"
    FROM assets AS a
    INNER JOIN db_namespace."Inventory" AS i ON a."propertyId" = i."propertyId"
    INNER JOIN db_namespace."Layout" AS l ON i."layoutId" = l.id
    LEFT JOIN db_namespace."Building" as b ON i."buildingId" = b.id
    LEFT JOIN db_namespace."MarketingLayout" as ml on l."marketingLayoutId" = ml.id and i."propertyId" = ml."propertyId"
    WHERE i."type" = '${DALTypes.InventoryType.UNIT}'
    AND i.inactive IS FALSE
    AND i."layoutId" IS NOT NULL
    ${excludedUnits}
    AND l."inventoryType" = '${DALTypes.InventoryType.UNIT}' AND l.inactive IS FALSE
    AND (l."name" = a."assetLayoutName" OR l."name" ILIKE concat(a."assetLayoutName", '\_%'))
    ORDER BY a."propertyName", i."externalId"
  `;
  /* eslint-enable no-useless-escape */
  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getPhysicalAssets = async ctx => {
  const query = `
    SELECT DISTINCT ON (pa.id) pa.id, reverse(split_part(reverse(a.path), '/', 1)) AS "fileName" FROM db_namespace."PhysicalAsset" AS pa
    INNER JOIN db_namespace."Assets" AS a ON pa.id = a."physicalAssetId"
    ORDER BY pa.id
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
