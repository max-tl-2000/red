/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, initQuery, insertOrUpdate, bulkUpsert } from '../database/factory';

export const saveInventoryGroup = (ctx, inventoryGroup) => insertOrUpdate(ctx.tenantId, 'InventoryGroup', inventoryGroup);
export const saveInventoryGroups = async (ctx, inventoryGroups) => await bulkUpsert(ctx, 'InventoryGroup', inventoryGroups);

export const getInventoryGroups = async ctx => await initQuery(ctx).select('*').from('InventoryGroup');

export const getInventoryGroupById = async (ctx, id) => await initQuery(ctx).select('*').from('InventoryGroup').where({ id }).first();

export const getInventoryGroupByNameAndProperty = async (ctx, name, propertyName) =>
  await initQuery(ctx)
    .select('*')
    .from('InventoryGroup')
    .innerJoin('Property', 'InventoryGroup.propertyId', 'Property.id')
    .where('InventoryGroup.name', name)
    .andWhere('Property.name', propertyName)
    .first();

export const getInventoryGroupsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const { tenantId } = ctx;
  const simpleFieldsToSelect = simpleFields.map(field => `InventoryGroup.${field}`);
  const foreignKeysToSelect = ['Property.name as property', 'LeaseName.name as leaseName', 'Fee.name as feeName'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .select(
      knex.raw(
        `ARRAY(select "Amenity"."name"
        from :tenantId:."InventoryGroup_Amenity"
        left join :tenantId:."Amenity" on "InventoryGroup_Amenity"."amenityId" = "Amenity".id
        where "InventoryGroup_Amenity"."inventoryGroupId" = "InventoryGroup".id) as amenities`,
        {
          tenantId,
        },
      ),
    )
    .from('InventoryGroup')
    .innerJoin('Property', 'InventoryGroup.propertyId', 'Property.id')
    .leftJoin('Fee', 'InventoryGroup.feeId', 'Fee.id')
    .leftJoin('LeaseName', 'InventoryGroup.leaseNameId', 'LeaseName.id')
    .whereIn('InventoryGroup.propertyId', propertyIdsToExport);
};
