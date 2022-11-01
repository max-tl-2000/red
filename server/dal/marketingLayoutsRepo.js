/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, insertOrUpdate } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

export const saveMarketingLayout = async (ctx, marketingLayout) => await insertOrUpdate(ctx.tenantId, 'MarketingLayout', marketingLayout);

export const getMarketingLayouts = async ctx => {
  const query = `
    SELECT *
    FROM db_namespace."MarketingLayout"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingLayoutsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `ml."${field}"`);
  const query = `
    SELECT ${simpleFieldsToSelect}, p.name as property, mlg.name as "marketingLayoutGroup"
      FROM db_namespace."MarketingLayout" ml
      INNER JOIN db_namespace."Property" p ON ml."propertyId" = p.id
      INNER JOIN db_namespace."MarketingLayoutGroup" mlg ON ml."marketingLayoutGroupId" = mlg.id
    WHERE p.id IN (${propertyIdsToExport.map(id => `'${id}'`)});
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingLayoutsDetails = async (ctx, filters) => {
  const { propertyIds, marketingLayoutGroupId, layoutIds } = filters;

  let whereCondition = '';
  let joinCondition = '';
  if (marketingLayoutGroupId) {
    joinCondition = 'AND inv."propertyId" = ANY(:propertyIds)';
    whereCondition = 'WHERE ml."marketingLayoutGroupId" = :marketingLayoutGroupId AND ml."propertyId" = ANY(:propertyIds)';
  } else if (layoutIds) {
    joinCondition = 'AND inv."propertyId" = ml."propertyId"';
    whereCondition = 'WHERE ml."id" = ANY(:layoutIds)';
  }

  const query = `
  SELECT ml.id, ml."propertyId", ml.name, ml."displayName", ml.description,
    ARRAY_AGG(DISTINCT(l."numBedrooms"::NUMERIC)) AS "numBedrooms",
	  ARRAY_AGG(DISTINCT(l."numBathrooms"::NUMERIC)) AS "numBathrooms",
    MIN(l."surfaceArea") AS "minSurfaceArea",
    MAX(l."surfaceArea") AS "maxSurfaceArea",
    ARRAY_AGG(inv.id) AS "inventoryIds",
  ( SELECT a."physicalAssetId" FROM db_namespace."Assets" a
    INNER JOIN db_namespace."Property" p ON a."entity"->>'propertyName' = p.name
    WHERE a."entity"->>'type' = '${DALTypes.AssetType.MARKETING_LAYOUT}'
    AND a."entity"->>'name' = ml.name
    AND p.id = ml."propertyId"
    ORDER BY a."entity"->'rank'
    LIMIT 1
  ) as "assetId",
    MIN(rms."minRent") AS "minRent",
    MIN(inv."availabilityDate") AS "minAvailableDate"
  FROM db_namespace."MarketingLayout" ml
    INNER JOIN db_namespace."Layout" l ON l."marketingLayoutId" = ml.id
    INNER JOIN db_namespace."Inventory" inv
    ON inv."layoutId" = l.id ${joinCondition}
    LEFT JOIN db_namespace."RmsPricing" rms on rms."inventoryId" = inv."id"
  ${whereCondition}
  GROUP BY ml.id
  ORDER BY ml.order ASC
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIds, marketingLayoutGroupId, layoutIds }]);
  return rows;
};
