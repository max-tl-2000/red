/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, insertOrUpdate } from '../database/factory';

export const saveMarketingAsset = async (ctx, marketingAsset) => await insertOrUpdate(ctx.tenantId, 'MarketingAsset', marketingAsset);

export const getMarketingAssets = async ctx => {
  const query = `
      SELECT *
      FROM db_namespace."MarketingAsset"
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingAssetsByPropertyId = async (ctx, propertyId) => {
  const query = `
  WITH assets AS (
    SELECT
      jsonb_array_elements_text(settings -> 'marketing' -> 'videoAssets')::uuid AS video_id,
      jsonb_array_elements_text(settings -> 'marketing' -> '3DAssets')::uuid AS threeD_id
    FROM db_namespace."Property" p
    WHERE p.id = :propertyId
    )
    SELECT DISTINCT ma.name, ma.type, ma."url", ma."displayName", ma."displayDescription", ma."altTag"
    FROM db_namespace."MarketingAsset" ma
      INNER JOIN assets va ON ma.id = video_id OR ma.id = threeD_id
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows;
};

export const getMarketingAssetsByInventoryId = async (ctx, inventoryId) => {
  const query = `
    SELECT ma.name, ma.type, ma."url", ma."displayName", ma."displayDescription", ma."altTag"
      FROM db_namespace."Inventory" inv
      INNER JOIN db_namespace."Layout" l ON inv."layoutId" = l.id
      INNER JOIN db_namespace."MarketingAsset" ma ON ARRAY[ma.id::varchar] <@ l."marketing3DAssets"
        OR ARRAY[ma.id::varchar] <@ l."marketingVideoAssets"
    WHERE inv.id = :inventoryId
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);
  return rows;
};

export const getMarketingAssetsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"${field}"`);

  const query = `
      SELECT ${simpleFieldsToSelect}
      FROM db_namespace."MarketingAsset"
      `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
