/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, bulkUpsert, getOne, rawStatement } from '../database/factory';

export const saveLayouts = async (ctx, layouts) => await bulkUpsert(ctx, 'Layout', layouts);

export const getLayouts = async ctx => await initQuery(ctx).from('Layout');

export const getLayoutByName = async (ctx, layoutName) => await initQuery(ctx).from('Layout').where('name', layoutName).first();

export const getLayoutsForUnits = async ctx =>
  await initQuery(ctx)
    .from('Layout')
    .join('Inventory', 'Inventory.layoutId', '=', 'Layout.id')
    .select('Layout.*')
    .where({ 'Inventory.type': 'unit' })
    .distinct();

export const getLayoutsByPropertyId = async (ctx, propertyId) => await initQuery(ctx).from('Layout').where('propertyId', propertyId);

export const getLayoutById = (ctx, id) => getOne(ctx.tenantId, 'Layout', id);

export const getLayoutsByIdWhereIn = async (ctx, layoutIds) => await initQuery(ctx).select('name').from('Layout').whereIn('id', layoutIds);

export const getLayoutsWhereNameIn = async (ctx, names) => {
  const query = `SELECT * FROM db_namespace."Layout"
      WHERE ARRAY["name"::varchar(36)] <@ :names`;
  const { rows } = await rawStatement(ctx, query, [{ names }]);
  return rows;
};

export const getLayoutsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `l."${field}"`);

  const query = `
    WITH video_assets AS (
      SELECT l.id AS "layoutId", ARRAY_AGG(ma.name) AS "marketingVideoAssets" FROM db_namespace."MarketingAsset" ma
      INNER JOIN db_namespace."Layout" l ON ARRAY[ma.id::varchar] <@ l."marketingVideoAssets"
      GROUP BY l.id
    ),
    assets_3d AS (
      SELECT l.id AS "layoutId", ARRAY_AGG(ma.name) AS "marketing3DAssets" FROM db_namespace."MarketingAsset" ma
      INNER JOIN db_namespace."Layout" l ON array[ma.id::varchar] <@ l."marketing3DAssets"
      GROUP BY l.id
    )
    SELECT ${simpleFieldsToSelect}, p.name AS property, ml.name AS "marketingLayout", video_assets.*, assets_3d.*,
	    ARRAY(SELECT a.name FROM db_namespace."Layout_Amenity" la
	    LEFT JOIN db_namespace."Amenity" a ON la."amenityId" = a.id
	    WHERE la."layoutId" = l.id) AS amenities
	    FROM db_namespace."Layout" l INNER JOIN db_namespace."Property" p ON l."propertyId" = p.id
      LEFT JOIN db_namespace."MarketingLayout" ml ON l."marketingLayoutId" = ml.id
      LEFT JOIN video_assets ON l.id = video_assets."layoutId"
	    LEFT JOIN assets_3d ON l.id = assets_3d."layoutId"
	  WHERE p.id IN (${propertyIdsToExport.map(id => `'${id}'`)});
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
