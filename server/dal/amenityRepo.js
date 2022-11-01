/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, insertOrUpdate, update, rawStatement, bulkUpsert } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

const AmenityUniqueIndexColumns = ['name', 'category', 'subCategory', 'propertyId'];
const InventoryAmenityUniqueIndexColumns = ['inventoryId', 'amenityId'];

export const getAmenity = async (ctx, name = null, category = null, propertyId = null) =>
  await initQuery(ctx).from('Amenity').where({ name }).andWhere({ category }).andWhere({ propertyId }).andWhere('endDate', null).first();

function getTargetValues(targetType) {
  switch (targetType) {
    case DALTypes.AmenityTargetType.BUILDING:
      return {
        table: 'Building_Amenity',
        column: 'buildingId',
      };
    case DALTypes.AmenityTargetType.INVENTORY_GROUP:
      return {
        table: 'InventoryGroup_Amenity',
        column: 'inventoryGroupId',
      };
    case DALTypes.AmenityTargetType.LAYOUT:
      return {
        table: 'Layout_Amenity',
        column: 'layoutId',
      };
    default:
      return {
        table: 'Inventory_Amenity',
        column: 'inventoryId',
      };
  }
}

export const addAmenityToTarget = (ctx, amenityId, targetId, targetType) => {
  const targetValues = getTargetValues(targetType);

  const model = {
    amenityId,
    [targetValues.column]: targetId,
  };

  return insertInto(ctx, targetValues.table, model);
};

export const bulkUpsertInventoriesAmenitiesFromImport = async (ctx, inventoriesAmenities) => {
  await bulkUpsert(ctx, 'Inventory_Amenity', inventoriesAmenities, InventoryAmenityUniqueIndexColumns, null, {
    onConflictPredicate: 'WHERE "endDate" IS NULL',
  });
};

export const bulkUpsertAmenityFromUpdate = async (ctx, amenities, excludeColumns = null) => {
  await bulkUpsert(ctx, 'Amenity', amenities, AmenityUniqueIndexColumns, excludeColumns, { onConflictPredicate: 'WHERE "endDate" IS NULL' });
};

export const deleteBuildingAmenities = async (ctx, buildingIds) => {
  const query = `
     DELETE FROM db_namespace."Building_Amenity"
     WHERE "buildingId" IN (${buildingIds.map(id => `'${id}'`)});`;

  return await rawStatement(ctx, query);
};

export const deleteLayoutAmenities = async (ctx, layoutIds) => {
  const query = `
     DELETE FROM db_namespace."Layout_Amenity"
     WHERE "layoutId" IN (${layoutIds.map(id => `'${id}'`)});`;

  return await rawStatement(ctx, query);
};

export const deleteInventoryGroupAmenities = async (ctx, inventoryGroupIds) => {
  const query = `
     DELETE FROM db_namespace."InventoryGroup_Amenity"
     WHERE "inventoryGroupId" IN (${inventoryGroupIds.map(id => `'${id}'`)});`;

  return await rawStatement(ctx, query);
};

export const saveBuildingAmenities = async (ctx, buildingAmenities) => await insertInto(ctx, 'Building_Amenity', buildingAmenities);
export const saveLayoutAmenities = async (ctx, layoutAmenities) => await insertInto(ctx, 'Layout_Amenity', layoutAmenities);
export const saveInventoryGroupAmenities = async (ctx, inventoryGroupAmenities) => await insertInto(ctx, 'InventoryGroup_Amenity', inventoryGroupAmenities);

export const deleteAmenitiesFromTarget = async (ctx, targetId, targetType) => {
  const { table, column } = getTargetValues(targetType);

  await initQuery(ctx).from(table).where(column, targetId).del();
};

export const deleteAmenitiesByInventoryIds = async (ctx, inventories) => {
  if (!inventories?.length) return null;

  const query = `
     DELETE FROM db_namespace."Inventory_Amenity"
     WHERE "inventoryId" IN (${inventories.map(id => `'${id}'`)}) and "endDate" IS NULL
    `;

  return await rawStatement(ctx, query);
};

export const getAmenities = async ctx =>
  await initQuery(ctx).from('Amenity').whereNot('Amenity.subCategory', DALTypes.AmenitySubCategory.LIFESTYLE).andWhere('Amenity.endDate', null);

export const getLifestyle = async (ctx, name, propertyName) =>
  await initQuery(ctx)
    .from('Amenity')
    .innerJoin('Property', 'Amenity.propertyId', 'Property.id')
    .where('Amenity.subCategory', DALTypes.AmenitySubCategory.LIFESTYLE)
    .andWhere('Amenity.name', name)
    .andWhere('Property.name', propertyName)
    .andWhere('hidden', false)
    .andWhere('Amenity.endDate', null)
    .first();

export async function getAmenitiesByCategory(ctx, category, subCategory) {
  const query = initQuery(ctx)
    .from('Amenity')
    .distinct('displayName', 'infographicName')
    .where('hidden', false)
    .andWhere({ category })
    .andWhere('endDate', null);

  return (await subCategory) ? query.andWhere({ subCategory }) : query;
}

export const getAllAmenitiesByCategory = async (ctx, category) => {
  const query = `
     SELECT * FROM db_namespace."Amenity"
     WHERE "subCategory" <> :subCategory
     AND category = :category
     AND "endDate" IS NULL;`;

  const { rows } = await rawStatement(ctx, query, [{ subCategory: DALTypes.AmenitySubCategory.LIFESTYLE, category }]);

  return rows;
};

export const createAmenity = (ctx, amenity) => insertInto(ctx.tenantId, 'Amenity', amenity);

export const saveAmenity = async (ctx, amenity, opts) => {
  const hasId = !!amenity?.id;
  if (hasId) {
    await update(ctx.tenantId, 'Amenity', { id: amenity.id }, amenity);
  } else if (amenity.subCategory === DALTypes.AmenitySubCategory.LIFESTYLE) {
    await insertOrUpdate(ctx.tenantId, 'Amenity', amenity, {
      onConflictPredicate: `WHERE "subCategory" = '${DALTypes.AmenitySubCategory.LIFESTYLE}'`,
      conflictColumns: AmenityUniqueIndexColumns,
      ...opts,
    });
  } else {
    await insertOrUpdate(ctx.tenantId, 'Amenity', amenity, {
      conflictColumns: AmenityUniqueIndexColumns,
      ...opts,
    });
  }
};

export const saveInventoryAmenity = async (ctx, inventoriesAmenities) => {
  await insertOrUpdate(ctx, 'Inventory_Amenity', inventoriesAmenities, {
    conflictColumns: InventoryAmenityUniqueIndexColumns,
    onConflictPredicate: 'WHERE "endDate" IS NULL',
  });
};

export const getAmenitiesByPropertyId = async (ctx, propertyId) =>
  await initQuery(ctx).from('Amenity').whereNot('subCategory', DALTypes.AmenitySubCategory.LIFESTYLE).andWhere({ propertyId }).andWhere('endDate', null);

export const getAmenitiesByPropertyAndCategory = async (ctx, propertyName, category) =>
  await initQuery(ctx)
    .from('Amenity')
    .join('Property', 'Amenity.propertyId', '=', 'Property.id')
    .select('Amenity.*')
    .whereNot('Amenity.subCategory', DALTypes.AmenitySubCategory.LIFESTYLE)
    .andWhere('Property.name', propertyName)
    .andWhere('Amenity.category', category)
    .andWhere('Amenity.endDate', null);

export const getAmenitiesByEachProperty = async ctx => {
  const query = `
    SELECT "propertyId", ARRAY_AGG(id || ',' || name) as amenities
    FROM db_namespace."Amenity"
    WHERE "propertyId" IN (
      SELECT id FROM db_namespace."Property"
    )
    AND "subCategory" <> :subCategory
    AND category = :category
    AND "endDate" IS NULL
    GROUP BY "propertyId"
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      category: DALTypes.AmenityCategory.INVENTORY.toLowerCase(),
    },
  ]);
  return rows;
};

export const getHighValueAmenitiesPerProperty = async (ctx, propertyId, category, highValue = true, amenityName) =>
  await initQuery(ctx)
    .from('Amenity')
    .where('propertyId', propertyId)
    .andWhereNot('subCategory', DALTypes.AmenitySubCategory.LIFESTYLE)
    .andWhereNot('name', amenityName)
    .andWhere('hidden', false)
    .andWhere('highValue', highValue)
    .andWhere('category', category)
    .andWhere('endDate', null);

export const getLifestylesByPropertyId = async (ctx, propertyId) =>
  await initQuery(ctx).from('Amenity').where('propertyId', propertyId).andWhere('subCategory', DALTypes.AmenitySubCategory.LIFESTYLE).where('endDate', null);

export const getInventoryGroupAmenityPrices = async ctx =>
  await initQuery(ctx)
    .from('InventoryGroup_Amenity')
    .innerJoin('Amenity', 'InventoryGroup_Amenity.amenityId', 'Amenity.id')
    .select('InventoryGroup_Amenity.inventoryGroupId', 'InventoryGroup_Amenity.amenityId', 'Amenity.relativePrice', 'Amenity.absolutePrice')
    .where('Amenity.endDate', null);

export const getAmenitiesByIdsWhereIn = async (ctx, amenityIds) =>
  await initQuery(ctx).from('Amenity').select('name').whereIn('id', amenityIds).andWhere('endDate', null);

export const getAmenitiesToExport = async (ctx, simpleFields, propertyIdsToExport, includeInventoryOnly = false) => {
  const simpleFieldsToSelect = simpleFields.map(field => `Amenity.${field}`);
  const foreignKeysToSelect = ['Property.name as property'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  let query = initQuery(ctx)
    .select(allFieldsToSelect)
    .from('Amenity')
    .innerJoin('Property', 'Amenity.propertyId', 'Property.id')
    .whereIn('Property.id', propertyIdsToExport)
    .andWhereNot('Amenity.subCategory', DALTypes.AmenitySubCategory.LIFESTYLE);

  if (includeInventoryOnly) {
    query = query.andWhere('Amenity.category', DALTypes.AmenityCategory.INVENTORY);
  }
  return await query.orderBy('property', 'category');
};

export const getLifestylesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"Amenity"."${field}"`);

  const query = `
    SELECT ${simpleFieldsToSelect}, "Property".name as property
      FROM db_namespace."Amenity"
      INNER JOIN db_namespace."Property" ON "Property".id = "Amenity"."propertyId"
    WHERE "Property".id IN (${propertyIdsToExport.map(id => `'${id}'`)})
    AND "Amenity"."subCategory" = 'lifestyle'
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getAmenitiesByInventoryIds = async (ctx, inventoryIds) => {
  const query = `
    SELECT DISTINCT am.name, am."displayName", am."subCategory", am."highValue" as "highValueFlag"
    FROM db_namespace."Amenity" am
    INNER JOIN db_namespace."Inventory_Amenity" inv_am ON am.id = inv_am."amenityId" AND inv_am."endDate" IS NULL
    WHERE inv_am."inventoryId" = ANY(:inventoryIds)
    AND NOT am."hidden"
    AND am."endDate" IS NULL
    ORDER BY am."highValue" desc
  `;
  const { rows } = await rawStatement(ctx, query, [{ inventoryIds }]);
  return rows;
};

export const getLifestylesForMarketing = async (ctx, propertyId) => {
  const condition = propertyId ? 'AND "propertyId" = :propertyId' : '';
  const query = `
     SELECT DISTINCT ON ("displayName") "name", "description", "displayName", "infographicName", "order" FROM db_namespace."Amenity"
     WHERE "subCategory" = '${DALTypes.AmenitySubCategory.LIFESTYLE}'
     AND "endDate" IS NULL
     ${condition}
     order by "displayName"
    `;
  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows;
};

export const updateAmenitiesEndDate = async (ctx, amenityIds, endDate) =>
  await initQuery(ctx).from('Amenity').whereIn('id', amenityIds).update('endDate', endDate);

export const updateInventoryAmenitiesEndDate = async (ctx, inventoryAmenityIds, endDate) => {
  const query = `
    UPDATE  db_namespace."Inventory_Amenity" ia
    set "endDate" = :endDate
    where ia.id =  ANY(:inventoryAmenityIds)
  `;
  const { rows } = await rawStatement(ctx, query, [{ endDate, inventoryAmenityIds }]);
  return rows;
};

export const getAllInventoryAmenities = async ctx => {
  const query = `
  SELECT * FROM db_namespace."Amenity" WHERE category = :category
  `;
  const { rows } = await rawStatement(ctx, query, [{ category: DALTypes.AmenityCategory.INVENTORY.toLowerCase() }]);
  return rows;
};

export const getAllActiveInventoryAmenities = async ctx => await initQuery(ctx).returning('*').from('Inventory_Amenity').where('endDate', null);

export const getPropertyByInventoryAmenity = async (ctx, inventoryAmenityIds) => {
  const query = `
    SELECT p.id AS "propertyId", ia.id FROM db_namespace."Inventory_Amenity" ia
    INNER JOIN db_namespace."Amenity" a ON a.id = ia."amenityId" 
    INNER JOIN db_namespace."Property" p ON p.id = a."propertyId" 
    WHERE ia.id = ANY(:inventoryAmenityIds)
  `;
  const { rows } = await rawStatement(ctx, query, [{ inventoryAmenityIds }]);
  return rows;
};

export const getAllActiveInventoryAmenitiesHashMapGroupedByInventoryId = async ctx => {
  const query = `
  SELECT JSON_OBJECT_AGG(x.id, x."inventoryAmenityInfo") AS res
  FROM (
     SELECT i.id, JSON_AGG(JSON_BUILD_OBJECT('amenityId',ia."amenityId", 'inventoryAmenityId', ia.id, 'amenityName', a."name")   ) AS "inventoryAmenityInfo"
    FROM db_namespace."Inventory_Amenity" ia
    INNER JOIN db_namespace."Amenity" a on a.id = ia."amenityId" 
    LEFT JOIN db_namespace."Inventory" i ON ia."inventoryId" = i.id
    WHERE ia."endDate" IS NULL
    GROUP BY i.id
  ) x
  `;
  const { rows = [] } = await rawStatement(ctx, query);
  return rows[0]?.res || {};
};

export const setEndDateToAmenitiesWithIntegrationSettingDisable = async (ctx, amenityIds) => {
  const query = `UPDATE db_namespace."Amenity" a
  SET "endDate" =  now()
  FROM db_namespace."Property" p
  WHERE p.id = a."propertyId" AND (p.settings->'integration'->'import'->>'amenities')::boolean IS FALSE
  AND a.id = ANY(:amenityIds)
  AND a."endDate" IS NULL
  AND a.category  = :category
`;
  await rawStatement(ctx, query, [{ amenityIds, category: DALTypes.AmenityCategory.INVENTORY.toLowerCase() }]);
};

export const getAllActiveInventoryAmenitiesHashedByPropertyId = async ctx => {
  const query = `SELECT JSON_OBJECT_AGG(x.id, x."amenityInfo") AS res
  FROM (
    SELECT p.id, json_object_agg(concat(a."name", '_', a.category, '_', a."subCategory"), a.id ) AS "amenityInfo"
    FROM db_namespace."Amenity" a 
    inner join db_namespace."Property" p on p.id = a."propertyId" 
     WHERE  a."endDate" IS null and a.category  =:category
     group by p.id
  ) x

    `;
  const { rows } = await rawStatement(ctx, query, [{ category: DALTypes.AmenityCategory.INVENTORY }]);
  return rows[0]?.res || {};
};
