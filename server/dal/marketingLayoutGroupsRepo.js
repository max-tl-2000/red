/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, rawStatement } from '../database/factory';
import { ServiceError } from '../common/errors';
import logger from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

export const saveMarketingLayoutGroup = async (ctx, marketingLayoutGroup) => {
  try {
    return await insertOrUpdate(ctx.tenantId, 'MarketingLayoutGroup', marketingLayoutGroup);
  } catch (error) {
    logger.trace({ ctx, error }, 'Error saving marketing layout group');
    throw new ServiceError('ERROR_SAVING_MARKETING_LAYOUT_GROUP');
  }
};

export const getMarketingLayoutGroups = async ctx => {
  const query = `
    SELECT *
    FROM db_namespace."MarketingLayoutGroup"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingLayoutGroupsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"${field}"`);

  const query = `
    SELECT ${simpleFieldsToSelect}
    FROM db_namespace."MarketingLayoutGroup"
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getUsedMarketingLayoutGroups = async (ctx, propertyIds) => {
  const joinCondition = propertyIds ? 'AND ARRAY[ml."propertyId"] <@ :propertyIds' : '';
  const query = `
    WITH property_marketinglayoutgroups AS
    (
      SELECT DISTINCT ml."propertyId", mlg.id AS "marketingLayoutGroupId"
      FROM db_namespace."MarketingLayout" ml
      INNER JOIN db_namespace."MarketingLayoutGroup" mlg ON mlg.id = ml."marketingLayoutGroupId"
      ${joinCondition}
      INNER JOIN db_namespace."Layout" l ON ml.id = l."marketingLayoutId" AND l."propertyId" = ml."propertyId"
      WHERE EXISTS(SELECT i.id FROM db_namespace."Inventory" i WHERE i."layoutId" = l.id AND i."propertyId" = ml."propertyId")
    )
    SELECT pm."propertyId" AS "propertyId",
    JSON_AGG(JSON_BUILD_OBJECT(
      'id', mlg.id,
      'name', mlg."name",
      'displayName', mlg."displayName",
      'description', mlg."description",
      'shortDisplayName', mlg."shortDisplayName",
      'order', mlg.order,
      'assetId', a."physicalAssetId")) AS "mlgInfo"
    FROM property_marketinglayoutgroups pm
      INNER JOIN db_namespace."MarketingLayoutGroup" mlg ON mlg.id = pm."marketingLayoutGroupId"
      LEFT JOIN LATERAL
        (
        SELECT a."physicalAssetId"
        FROM db_namespace."Assets" a
            INNER JOIN db_namespace."Property" p ON a."entity"->>'propertyName' = p.name
        WHERE a."entity"->>'type' = '${DALTypes.AssetType.MARKETING_LAYOUT_GROUP}'
        AND a."entity"->>'name' = mlg.name
        AND p.id = pm."propertyId"
        ORDER BY a."entity"->'rank'
        LIMIT 1
        ) a ON TRUE
    GROUP BY pm."propertyId"
    `;
  const { rows } = await rawStatement(ctx, query, [{ propertyIds }]);
  return rows;
};
