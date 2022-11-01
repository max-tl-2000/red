/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, insertOrUpdate, updateOne, initQuery } from '../database/factory';
import { ServiceError } from '../common/errors';
import logger from '../../common/helpers/logger';

export const savePropertyGroup = async (ctx, propertyGroup) => {
  try {
    return await insertOrUpdate(ctx.tenantId, 'PropertyGroup', propertyGroup);
  } catch (error) {
    logger.error({ error }, 'Error saving property group ref');
    throw new ServiceError('ERROR_SAVING_PROPERTY_GROUP_REF');
  }
};

export const putParentGroupRef = async (ctx, propertyGroupId, propertyGroupRef) => {
  try {
    await updateOne(ctx.tenantId, 'PropertyGroup', propertyGroupId, {
      parentGroup: propertyGroupRef,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating property group ref');
    throw new ServiceError('ERROR_UPDATING_PROPERTY_GROUP_REF');
  }
};

export const getPropertiesGroup = async ctx => await initQuery(ctx).from('PropertyGroup');

export const getPropertyGroupHierarchy = async (ctx, propertyGroupName) => {
  const relatedPropertyGroups = await knex.raw(
    `WITH RECURSIVE parent_validation(id, name, owner, "parentGroup") AS
    (
      SELECT id, name, owner, "parentGroup" FROM :tenantId:."PropertyGroup" WHERE name = :propertyGroupName
      UNION ALL
      SELECT p.id, p.name, p.owner, p."parentGroup" FROM parent_validation pr, :tenantId:."PropertyGroup" p
      WHERE p.id = pr."parentGroup"
    )
    SELECT b.name as "ownerName", pv.* FROM parent_validation pv LEFT JOIN  :tenantId:."BusinessEntity" b ON pv.owner = b.id ;`,
    { tenantId: ctx.tenantId, propertyGroupName },
  );

  return relatedPropertyGroups ? relatedPropertyGroups.rows : [];
};

export const getPropertiesGroupToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `PropertyGroup.${field}`);
  const foreignKeysToSelect = ['b1.name as operator', 'b2.name as owner'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('PropertyGroup')
    .innerJoin('BusinessEntity as b1', 'b1.id', 'PropertyGroup.operator')
    .innerJoin('BusinessEntity as b2', 'b2.id', 'PropertyGroup.owner');
};
