/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import { mapSeries } from 'bluebird';
import {
  knex,
  insertOrUpdate,
  getOne,
  getOneWhere,
  updateOne,
  initQuery,
  insertInto,
  update,
  getAllWhereIn,
  bulkUpsert,
  rawStatement,
} from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { ServiceError } from '../common/errors';
import logger from '../../common/helpers/logger';
import { now } from '../../common/helpers/moment-utils';
import { getPropertyTimezone } from '../services/properties';
import { prepareRawQuery } from '../common/schemaConstants';
import { formatInventoryAssetUrl } from '../helpers/assets-helper';
import { getInventoriesIdentifiers } from '../import/helpers/inventory';

// eslint-disable-next-line
export const getInventoryByIdQuery = (ctx, inventoryId) =>
  knex.raw(prepareRawQuery('SELECT i.id, i.name, i.type FROM db_namespace."Inventory" as i WHERE i.id = :inventoryId', ctx.tenantId), { inventoryId });

const getInventoriesByIds = async (ctx, ids) => await initQuery(ctx).from('Inventory').whereIn('id', ids);

const getInventoriesByFilters = async (ctx, filters) => await initQuery(ctx).from('Inventory').where(filters);

export const getInventoryProps = async (ctx, { unitQualifiedName, inventoryId }) => {
  const condition = (unitQualifiedName && 'AND us."fullQualifiedName" = :unitQualifiedName') || (inventoryId && 'AND us."id" = :inventoryId');
  const results = await knex.raw(
    prepareRawQuery(
      `SELECT us.id as "inventoryId", i."propertyId", i.name as "inventoryName", rms."pricingType", MAX(CASE WHEN rms."renewalDate" IS NULL THEN rms."availDate" ELSE NULL END) AS "priceAvailabilityDate", i.state, i."availabilityDate"
      FROM db_namespace."UnitSearch" as us
      INNER JOIN db_namespace."Inventory" as i
        ON us.id = i.id
      LEFT JOIN db_namespace."RmsPricing" as rms
        ON us.id = rms."inventoryId"
      WHERE i.type = 'unit' ${condition}
      GROUP BY us.id, i."propertyId", i.name, rms."pricingType", i.state, i."availabilityDate"
    `,
      ctx.tenantId,
    ),
    { unitQualifiedName, inventoryId },
  );

  return results && results.rows ? results.rows[0] : null;
};

const saveInventory = async (ctx, inventory, shouldSetStateStartDate = true) => {
  if (!inventory) {
    logger.error({ ctx, inventory }, '[saveInventory]: attempt to save an inventory not defined');
    throw new ServiceError('inventory parameter is mandatory');
  }

  let theInventory = inventory;

  const { stateStartDate, propertyId } = theInventory;
  if (!stateStartDate && shouldSetStateStartDate) {
    if (!propertyId) {
      logger.error({ ctx, propertyId }, 'Attempt to insert an inventory without a propertyId');
      throw new ServiceError('`propertyId` is not defined in the inventory to save');
    }

    const timezone = await getPropertyTimezone(ctx, propertyId);

    if (!timezone) {
      logger.warn({ ctx, propertyId }, '`timezone` is null or empty for the provided `propertyId`');
    }

    theInventory = {
      ...inventory,
      stateStartDate: inventory.stateStartDate || now({ timezone }).startOf('day').toJSON(),
    };
  }

  return await insertOrUpdate(ctx, 'Inventory', theInventory);
};

const getInventoriesByPropertyId = async (ctx, propertyId) => await initQuery(ctx).from('Inventory').where('propertyId', propertyId);

const fksToExpand = {
  propertyId: {
    repr: 'property',
    rel: 'Property',
  },
  buildingId: {
    repr: 'building',
    rel: 'Building',
    optional: true,
  },
  layoutId: {
    repr: 'layout',
    rel: 'Layout',
  },
  inventoryGroupId: {
    repr: 'inventoryGroup', // TODO: this comes out as `inventorygroup` - all lowercase
    rel: 'InventoryGroup',
  },
};

const getInventoryById = async (ctx, { id, expand }) => {
  let inventory;

  if (expand) {
    // TODO we are doing 2 queries, can we do better?
    inventory = await getOne(ctx, 'Inventory', id, fksToExpand);

    if (inventory) {
      const addressesIds = [];
      if (inventory.building && inventory.building.addressId) {
        addressesIds.push(inventory.building.addressId);
      }
      if (inventory.property && inventory.property.addressId) {
        addressesIds.push(inventory.property.addressId);
      }

      const addressFields = [];
      const addresses = _.keyBy(
        await initQuery(ctx)
          .from('Address')
          .whereIn('id', addressesIds)
          .select(...addressFields),
        'id',
      );

      if (inventory.building && inventory.building.addressId) {
        inventory.building.address = addresses[inventory.building.addressId];
      }
      if (inventory.property && inventory.property.addressId) {
        inventory.property.address = addresses[inventory.property.addressId];
      }

      const property = inventory.property;
      const layout = inventory.layout;
      if (property && layout) {
        inventory.imageUrl = await formatInventoryAssetUrl(ctx, id);
      }

      const query = `
        SELECT
          rms."lowestMonthlyRent" AS "marketRent",
          rms."renewalLowestMonthlyRent" AS "renewalMarketRent",
          json_build_object(
            'termLength', COALESCE(rms."minRentLeaseLength", 12),
            'period', '${DALTypes.LeasePeriod.MONTH}'
          ) as "leaseTerm"
        FROM db_namespace."UnitSearch" us
          LEFT JOIN
          (
          SELECT
            rms."inventoryId",
            MAX(CASE WHEN "renewalDate" IS NULL THEN "minRent" ELSE NULL END) AS "lowestMonthlyRent",
            MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "minRent" ELSE NULL END) AS "renewalLowestMonthlyRent",
            MAX(CASE WHEN "renewalDate" IS NULL THEN "minRentLeaseLength" ELSE NULL END) AS "minRentLeaseLength"
          FROM db_namespace."RmsPricing" rms
          GROUP BY rms."inventoryId"
          ) rms ON rms."inventoryId" = us.id
        WHERE id = :id
        LIMIT 1`;

      const unitRentInfo = await rawStatement(ctx, query, [{ id }]);

      const hasUnitRentInfo = unitRentInfo && unitRentInfo.rows && unitRentInfo.rows.length;
      inventory.marketRent = hasUnitRentInfo ? unitRentInfo.rows[0].marketRent : {};
      inventory.renewalMarketRent = hasUnitRentInfo ? unitRentInfo.rows[0].renewalMarketRent : {};
      inventory.leaseTerm = hasUnitRentInfo ? unitRentInfo.rows[0].leaseTerm : {};
    }
  } else {
    inventory = await getOne(ctx, 'Inventory', id);
  }

  if (inventory) {
    inventory.building = inventory.building || {};
  }
  return inventory;
};

const getInventoryByExternalId = (ctx, externalId) => getOneWhere(ctx.tenantId, 'Inventory', { externalId });

const getInventoryByPropertyName = async (ctx, name, propertyName) =>
  await initQuery(ctx)
    .from('Inventory')
    .innerJoin('Property', 'Inventory.propertyId', 'Property.id')
    .where('Inventory.name', name)
    .andWhere('Property.name', propertyName)
    .select('Inventory.*')
    .first();

const getInventoryByPropertyAndBuilding = async (ctx, name, propertyName, buildingName) =>
  await initQuery(ctx)
    .from('Inventory')
    .innerJoin('Property', 'Inventory.propertyId', 'Property.id')
    .innerJoin('Building', 'Inventory.buildingId', 'Building.id')
    .where('Inventory.name', name)
    .andWhere('Property.name', propertyName)
    .andWhere('Building.name', buildingName)
    .select('Inventory.*')
    .first();

/**
 * @param {string} schema
 * @param {object} inventory
 */
const getInventoryAmenities = async (ctx, inventory) => {
  logger.trace({ ctx, inventoryId: inventory?.id }, 'getInventoryAmenities');

  const query = `
  SELECT DISTINCT AllAmenities.* FROM (
    SELECT
       "Amenity".*
    FROM
       db_namespace."Amenity"
       INNER JOIN db_namespace."Inventory_Amenity" ON "Inventory_Amenity"."amenityId" = "Amenity"."id"  AND "Inventory_Amenity"."endDate" IS NULL
    WHERE
       "inventoryId" = :inventoryId
       AND "category" = :inventoryCategory
    UNION ALL
    ${
      inventory.buildingId || (inventory.building && inventory.building.id)
        ? `SELECT
       "Amenity".*
    FROM
       db_namespace."Amenity"
       INNER JOIN db_namespace."Building_Amenity" ON "Building_Amenity"."amenityId" = "Amenity"."id"
    WHERE
       "buildingId" = :buildingId
       AND "category" = :buildingCategory
       AND "Amenity"."endDate" IS NULL
    UNION ALL`
        : ''
    }
    SELECT
       "Amenity".*
    FROM
       db_namespace."Amenity"
       INNER JOIN db_namespace."InventoryGroup_Amenity" ON "InventoryGroup_Amenity"."amenityId" = "Amenity"."id"
    WHERE
       "inventoryGroupId" = :inventoryGroupId
       AND "category" = :amenityCategory
       AND "Amenity"."endDate" IS NULL
    UNION ALL
    SELECT
       "Amenity".*
    FROM
       db_namespace."Amenity"
    WHERE
       NOT "Amenity"."subCategory" = 'lifestyle'
       AND "propertyId" = :propertyId
       AND "category" = :amenityPropertyCategory
       AND "Amenity"."endDate" IS NULL
    UNION ALL
    SELECT
       "Amenity".*
    FROM
       db_namespace."Amenity"
       INNER JOIN db_namespace."Layout_Amenity" ON "Layout_Amenity"."amenityId" = "Amenity"."id"
    WHERE
       "layoutId" = :layoutId
       AND "category" = :amenityCategory
       AND "Amenity"."endDate" IS NULL
  ) as AllAmenities;`;

  const { rows } = await rawStatement(ctx, query, [
    {
      buildingId: inventory.buildingId || inventory.building.id || '',
      buildingCategory: DALTypes.AmenityCategory.BUILDING,
      inventoryId: inventory.id,
      inventoryCategory: DALTypes.AmenityCategory.INVENTORY,
      inventoryGroupId: inventory.inventoryGroupId,
      amenityCategory: DALTypes.AmenityCategory.INVENTORY,
      propertyId: inventory.propertyId || inventory.property.id,
      amenityPropertyCategory: DALTypes.AmenityCategory.PROPERTY,
      layoutId: inventory.layoutId,
    },
  ]);
  return rows;
};

const getAllInventoryAmenities = async ctx => {
  const query = `SELECT "Amenity"."id", "Amenity"."propertyId" FROM 
  db_namespace."Amenity" 
  INNER JOIN db_namespace."Inventory_Amenity" 
  on "Inventory_Amenity"."amenityId" = "Amenity"."id" 
  AND "Inventory_Amenity"."endDate" IS NULL
  WHERE "category" =:inventoryCategory
  AND "Amenity"."endDate" IS NULL
  UNION select "Amenity"."id", "Amenity"."propertyId" 
  FROM db_namespace."Amenity"
  INNER JOIN db_namespace."Building_Amenity" 
  on "Building_Amenity"."amenityId" = "Amenity"."id" 
  WHERE "category" =:buildingCategory
  AND "Amenity"."endDate" IS NULL
  UNION select "Amenity"."id", "Amenity"."propertyId"
  FROM db_namespace."Amenity" 
  INNER JOIN db_namespace."InventoryGroup_Amenity" 
  on "InventoryGroup_Amenity"."amenityId" = "Amenity"."id" 
  WHERE "category" =:inventoryCategory
  AND "Amenity"."endDate" IS NULL
  UNION select "Amenity"."id", "Amenity"."propertyId"
  FROM db_namespace."Amenity"
  WHERE not "Amenity"."subCategory" =:lifeStyleCategory
  AND "category" =:propertyCategory
  AND "Amenity"."endDate" IS NULL 
  UNION select "Amenity"."id", "Amenity"."propertyId" 
  FROM db_namespace."Amenity" 
  INNER JOIN db_namespace."Layout_Amenity" 
  on "Layout_Amenity"."amenityId" = "Amenity"."id" 
  WHERE "category" =:inventoryCategory
  AND "Amenity"."endDate" IS NULL
  `;
  const { rows } = await rawStatement(ctx, query, [
    {
      propertyCategory: DALTypes.AmenityCategory.PROPERTY,
      lifeStyleCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      buildingCategory: DALTypes.AmenityCategory.BUILDING,
      inventoryCategory: DALTypes.AmenityCategory.INVENTORY,
    },
  ]);
  return rows;
};

// eslint-disable-next-line
export const getJsonInventoryAmenitiesQuery = (ctx, { inventoryIdColumn, buildingIdColumn, inventoryGroupIdColumn, propertyIdColumn, layoutIdColumn }) =>
  knex.raw(
    `
  SELECT COALESCE(json_agg(am.*), '[]') FROM :tenantId:."Amenity" am
          WHERE
          am."endDate" IS NULL
          AND EXISTS(
            SELECT 1 FROM :tenantId:."Inventory_Amenity" ia WHERE ia."amenityId" = am.id AND ia."endDate" is null AND ia."inventoryId" = :inventoryIdColumn: AND am.category = :inventoryCategory)
          OR EXISTS(
            SELECT 1 FROM :tenantId:."Building_Amenity" ba WHERE ba."amenityId" = am.id AND ba."buildingId" = :buildingIdColumn: AND am.category = :buildingCategory)
          OR EXISTS(
            SELECT 1 FROM :tenantId:."InventoryGroup_Amenity" iga WHERE iga."amenityId" = am.id AND iga."inventoryGroupId" = :inventoryGroupIdColumn: AND am.category = :inventoryCategory)
          OR (am."subCategory" <> :lifestyleCategory AND am."propertyId" = :propertyIdColumn: AND am.category = :propertyCategory)
          OR EXISTS(
            SELECT 1 FROM :tenantId:."Layout_Amenity" la WHERE la."amenityId" = am.id AND la."layoutId" = :layoutIdColumn: AND am.category = :inventoryCategory)
  `,
    {
      tenantId: ctx.tenantId,
      inventoryCategory: DALTypes.AmenityCategory.INVENTORY,
      buildingCategory: DALTypes.AmenityCategory.BUILDING,
      propertyCategory: DALTypes.AmenityCategory.PROPERTY,
      lifestyleCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      inventoryIdColumn,
      buildingIdColumn,
      inventoryGroupIdColumn,
      propertyIdColumn,
      layoutIdColumn,
    },
  );

const inventoryByfields = [
  'Inventory.created_at',
  'Inventory.updated_at',
  'Inventory.id',
  'Inventory.name',
  'Inventory.propertyId',
  'Inventory.description',
  'Inventory.type',
  'Inventory.floor',
  'Inventory.layoutId',
  'Inventory.multipleItemTotal',
  'Inventory.buildingId',
  'Inventory.inventoryGroupId',
  'Inventory.parentInventory',
  'Inventory.state',
  'Inventory.stateStartDate',
  'Building.name as buildingShorthand',
  'Building.displayName as buildingName',
  'Layout.name as layoutName',
  'Layout.displayName as layoutDisplayName',
  'Layout.surfaceArea as layoutSurfaceArea',
  'Property.displayName as propertyDisplayName',
  'Property.name as propertyName',
  'RmsPricing.standardRent as marketRent',
];

// eslint-disable-next-line
const loadInventory = (schema, query, inventoryGroupId) => {
  // used as query builder

  const initialQuery = knex
    .withSchema(schema)
    .from('Inventory')
    .where('Inventory.inactive', false)
    .join('InventoryGroup', 'InventoryGroup.id', 'Inventory.inventoryGroupId');
  const inventoryGroupCondition = inventoryGroupId ? initialQuery.andWhere('InventoryGroup.id', inventoryGroupId) : initialQuery;

  const buildingAndRentQuery = inventoryGroupCondition
    .leftJoin('Building', 'Building.id', 'Inventory.buildingId')
    .leftJoin('Layout', 'Layout.id', 'Inventory.layoutId')
    .leftJoin('Property', 'Property.id', 'Inventory.propertyId')
    .join('RmsPricing', 'RmsPricing.inventoryId', 'Inventory.id')
    .select(...inventoryByfields);

  const queryCondition = query
    ? buildingAndRentQuery.whereRaw(`(LOWER("Inventory"."name") LIKE '%${query}%'
                                            OR LOWER("Building"."displayName") LIKE '%${query}%'
                                            OR LOWER("Building"."name") LIKE '%${query}%'
                                            OR REPLACE(CONCAT(LOWER("Inventory"."name"), LOWER("Building"."displayName"), LOWER("Building"."name")),' ', '') LIKE '%${query}%')`)
    : buildingAndRentQuery;

  return inventoryGroupId || query
    ? queryCondition
        .andWhere(function whereConditions() {
          this.whereNull('Inventory.multipleItemTotal').orWhere('Inventory.multipleItemTotal', 0);
        })
        .andWhere(function whereConditions() {
          this.whereNull('Inventory.parentInventory');
        })
    : queryCondition;
};

export const getInventoryOnHoldsWhereIn = async (ctx, inventoryIds, reason) => {
  const reasonFilter = reason ? `AND reason = '${reason}'` : '';
  return await initQuery(ctx).from('InventoryOnHold').whereIn('inventoryId', inventoryIds).andWhereRaw(
    `
      (NOW() <@ tstzrange("startDate", "endDate", '[)'))
      ${reasonFilter}
      `,
  );
};

const enhanceWithFullQualifiedName = inventories =>
  inventories.map(row => {
    const fullQualifiedName = [row.propertyName, row.buildingShorthand, row.name].filter(name => name).join('-');
    return { ...row, fullQualifiedName };
  });

const loadInventoryByType = async (schema, query, inventoryGroupId, type) => {
  let result = await loadInventory(schema, query, inventoryGroupId).andWhere('Inventory.type', type).orderBy('Inventory.name', 'asc');
  result = enhanceWithFullQualifiedName(result);
  return _.uniqBy(result, 'id');
};

export const loadAllInventory = async (schema, query, inventoryGroupId, inventoryToInclude = []) => {
  let result = await loadInventory(schema, query, inventoryGroupId).orderBy('Inventory.name', 'asc');
  if (inventoryGroupId) {
    const inventoryIds = result.map(inv => inv.id);
    const inventoriesOnHold = await getInventoryOnHoldsWhereIn({ tenantId: schema }, inventoryIds);
    const includedInventories = new Set(inventoryToInclude);
    result = result.filter(inv => !inventoriesOnHold.some(invOnHold => invOnHold.inventoryId === inv.id) || includedInventories.has(inv.id));
  }
  result = enhanceWithFullQualifiedName(result);
  return _.uniqBy(result, 'id');
};

const feesWithInventoryGroupWithZeroPricesQuery = `
  SELECT
    igf."displayName" as name,
    ''::varchar as "secondaryName",
    ''::varchar as "buildingName",
    ''::varchar as type,
    coalesce(igf."basePriceMonthly", 0) as "basePriceMonthly"
  FROM (SELECT
    ig."displayName",
    ig."feeId",
    min(rms."standardRent") as "minRentMonthly",
    max(rms."standardRent") as "maxRentMonthly",
    null as "minRentWeekly",
    null as "maxRentWeekly",
    null as "minRentDaily",
    null as "maxRentDaily",
    null as "minRentHourly",
    null as "maxRentHourly",
    ig."basePriceMonthly"
    FROM db_namespace."InventoryGroup" as ig
    INNER JOIN db_namespace."Inventory" as i ON ig.id = i."inventoryGroupId"
    INNER JOIN db_namespace."RmsPricing" as rms ON i.id = rms."inventoryId"
    INNER JOIN additional_fees as adf ON (ig."feeId" IN (adf.id) AND adf."feeType" = '${DALTypes.FeeType.INVENTORY_GROUP}')
    group by ig.id) igf
  WHERE (
    igf."minRentMonthly",
    igf."maxRentMonthly",
    igf."minRentWeekly",
    igf."maxRentWeekly",
    igf."minRentDaily",
    igf."maxRentDaily",
    igf."minRentHourly",
    igf."maxRentHourly") ISNULL
`;

// eslint-disable-next-line
export const getJsonComplimentsForInventoryQuery = (ctx, { inventoryIdColumn, inventoryGroupIdColumn }) =>
  knex.raw(
    `
  SELECT COALESCE(json_agg(items.*), '[]')  FROM
  (WITH
      linked_inventories AS (
        SELECT
          CASE
            WHEN inv."inventoryGroupId" IS NULL THEN inv."type"
            ELSE ig."displayName"
          END as name,
          inv.name as "secondaryName",
          b.name as "buildingName",
          inv.type as type,
          coalesce(ig."basePriceMonthly", 0) as "basePriceMonthly"
        FROM :schema:."Inventory" inv
        LEFT JOIN :schema:."InventoryGroup" ig ON ig.id = inv."inventoryGroupId"
        LEFT JOIN :schema:."Building" b ON b.id = inv."buildingId"
        WHERE inv."parentInventory" = :inventoryIdColumn:
      ),
      inventory_fee AS (
        SELECT
          f.id,
          g."displayName",
          g."basePriceMonthly"
        FROM :schema:."Fee" f
        JOIN :schema:."InventoryGroup" g ON g."feeId" = f.id
        WHERE g.id = :inventoryGroupIdColumn:
      ),
      additional_fees AS (
        SELECT
          f.id,
          f."displayName",
          f."feeType",
          f."relativePrice",
          f."absolutePrice",
          if."basePriceMonthly"
        FROM :schema:."Associated_Fee" af
        JOIN :schema:."Fee" f ON f.id = af."associatedFee"
        JOIN inventory_fee if ON if.id = af."primaryFee"
        WHERE af."isAdditional" = true
      ),
      additional_fees_tied_to_inventory_group_with_0_price AS (
        SELECT
          igf."displayName" as name,
          ''::varchar as "secondaryName",
          ''::varchar as "buildingName",
          ''::varchar as type,
          coalesce(igf."basePriceMonthly", 0) as "basePriceMonthly"
        FROM (SELECT
          ig."displayName",
          ig."feeId",
          min(rms."standardRent") as "minRentMonthly",
          max(rms."standardRent") as "maxRentMonthly",
          null as "minRentWeekly",
          null as "maxRentWeekly",
          null as "minRentDaily",
          null as "maxRentDaily",
          null as "minRentHourly",
          null as "maxRentHourly",
          ig."basePriceMonthly"
          FROM :schema:."InventoryGroup" as ig
          INNER JOIN :schema:."Inventory" as i ON ig.id = i."inventoryGroupId"
          INNER JOIN :schema:."RmsPricing" as rms ON i.id = rms."inventoryId"
          INNER JOIN additional_fees as adf ON (ig."feeId" IN (adf.id) AND adf."feeType" = '${DALTypes.FeeType.INVENTORY_GROUP}')
          group by ig.id) igf
        WHERE (
          igf."minRentMonthly",
          igf."maxRentMonthly",
          igf."minRentWeekly",
          igf."maxRentWeekly",
          igf."minRentDaily",
          igf."maxRentDaily",
          igf."minRentHourly",
          igf."maxRentHourly") ISNULL
      ),
      additional_fees_with_0_price AS (
        SELECT
          adf."displayName" as name,
          ''::varchar as "secondaryName",
          ''::varchar as "buildingName",
          ''::varchar as type,
          0 as "basePriceMonthly"
        FROM additional_fees adf
        WHERE nullif(adf."absolutePrice", 0) is null AND nullif(adf."relativePrice", 0) is null AND adf."feeType" = :serviceType
      )

    SELECT * FROM linked_inventories
    UNION
    SELECT * FROM additional_fees_with_0_price
    UNION
    SELECT * FROM additional_fees_tied_to_inventory_group_with_0_price) as items
`,
    {
      schema: ctx.tenantId,
      inventoryIdColumn,
      inventoryGroupIdColumn,
      serviceType: DALTypes.FeeType.SERVICE,
    },
  );

export const getComplimentsPriceByInventoryIds = async (ctx, inventoryIds) => {
  const query = `
  SELECT items."inventoryId", items."basePriceMonthlyArray"  FROM
  (WITH
      linked_inventories AS (
        SELECT
          inv."parentInventory" AS "inventoryId",
         COALESCE(ig."basePriceMonthly", 0) AS "basePriceMonthly"
        FROM :schema:."Inventory" inv
        LEFT JOIN :schema:."InventoryGroup" ig ON ig.id = inv."inventoryGroupId"
        WHERE inv."parentInventory" = ANY(:inventoryIds)
      ),
      inventory_fees AS (
        SELECT
          f.id,
          g."basePriceMonthly",
          i.id as "inventoryId"
        FROM :schema:."Fee" f
        JOIN :schema:."InventoryGroup" g ON g."feeId" = f.id
        JOIN :schema:."Inventory" i ON i."inventoryGroupId" = g.id
        WHERE i.id = ANY(:inventoryIds)
      ),
      additional_fees AS (
        SELECT
          f.id,
          f."feeType",
          if."basePriceMonthly",
          if."inventoryId"
        FROM :schema:."Associated_Fee" af
        JOIN :schema:."Fee" f ON f.id = af."associatedFee"
        JOIN inventory_fees if ON if.id = af."primaryFee"
        WHERE af."isAdditional" = true
      ),
      additional_fees_tied_to_inventory_group_with_0_price AS (
         SELECT
            igf."inventoryId",
            COALESCE(igf."basePriceMonthly", 0) AS "basePriceMonthly"
          FROM (SELECT
            ig."displayName",
            ig."feeId",
            min(rms."standardRent") AS "minRentMonthly",
            max(rms."standardRent") AS "maxRentMonthly",
            null AS "minRentWeekly",
            null AS "maxRentWeekly",
            null AS "minRentDaily",
            null AS "maxRentDaily",
            null AS "minRentHourly",
            null AS "maxRentHourly",
            ig."basePriceMonthly",
            adf."inventoryId"
            FROM :schema:."InventoryGroup" AS ig
            INNER JOIN :schema:."Inventory" AS i ON ig.id = i."inventoryGroupId"
            INNER JOIN :schema:."RmsPricing" AS rms ON i.id = rms."inventoryId"
            INNER JOIN additional_fees AS adf ON (
              adf."inventoryId" = i.id AND
              ig."feeId" IN (adf.id) AND
              adf."feeType" = :inventoryGroupType
            )
            GROUP BY ig.id, adf."inventoryId") igf
          WHERE (
            igf."minRentMonthly",
            igf."maxRentMonthly",
            igf."minRentWeekly",
            igf."maxRentWeekly",
            igf."minRentDaily",
            igf."maxRentDaily",
            igf."minRentHourly",
            igf."maxRentHourly"
          ) ISNULL
      ),
      union_inventories_base_price_monthly_queries as (
      	SELECT "inventoryId", "basePriceMonthly" FROM linked_inventories
    		UNION
		    SELECT "inventoryId", "basePriceMonthly" FROM additional_fees_tied_to_inventory_group_with_0_price
      )
 	    SELECT
 	 	    "inventoryId",
 	      JSON_AGG("basePriceMonthly") AS "basePriceMonthlyArray"
 	    FROM union_inventories_base_price_monthly_queries
 	    GROUP BY "inventoryId"
  ) AS items
`;
  const { rows } = await knex.raw(query, {
    schema: ctx.tenantId,
    inventoryIds,
    inventoryGroupType: DALTypes.FeeType.INVENTORY_GROUP,
  });

  return rows;
};

const getComplimentsForInventory = async (ctx, inventory, isRenewalQuote = false) => {
  const statement = `
    WITH
      linked_inventories AS (
        SELECT
          CASE
            WHEN i."inventoryGroupId" IS NULL THEN i."type"
            ELSE ig."displayName"
          END as name,
          i.name as "secondaryName",
          b.name as "buildingName",
          i.type as type,
          coalesce(ig."basePriceMonthly", 0) as "basePriceMonthly"
        FROM db_namespace."Inventory" i
        LEFT JOIN db_namespace."InventoryGroup" ig ON ig.id = i."inventoryGroupId"
        LEFT JOIN db_namespace."Building" b ON b.id = i."buildingId"
        WHERE i."parentInventory" = :inventoryId
      ),
      inventory_fee AS (
        SELECT
          f.id,
          g."displayName",
          g."basePriceMonthly"
        FROM db_namespace."Fee" f
        JOIN db_namespace."InventoryGroup" g ON g."feeId" = f.id
        WHERE g.id = :inventoryGroupId
        ${isRenewalQuote ? 'AND f."renewalLetterDisplayFlag" IS TRUE' : ''}
      ),
      additional_fees AS (
        SELECT
          f.id,
          f."displayName",
          f."feeType",
          f."relativePrice",
          f."absolutePrice",
          if."basePriceMonthly"
        FROM db_namespace."Associated_Fee" af
        JOIN db_namespace."Fee" f ON f.id = af."associatedFee"
        JOIN inventory_fee if ON if.id = af."primaryFee"
        WHERE af."isAdditional" = true
        ${isRenewalQuote ? 'AND f."renewalLetterDisplayFlag" IS TRUE' : ''}
      ),
      additional_fees_tied_to_inventory_group_with_0_price AS (
        ${feesWithInventoryGroupWithZeroPricesQuery}
      ),
      additional_fees_with_0_price AS (
        SELECT
          adf."displayName" as name,
          ''::varchar as "secondaryName",
          ''::varchar as "buildingName",
          ''::varchar as type,
          0 as "basePriceMonthly"
        FROM additional_fees adf
        WHERE nullif(adf."absolutePrice", 0) is null AND nullif(adf."relativePrice", 0) is null AND adf."feeType" = :serviceType
      )

    ${
      isRenewalQuote
        ? ''
        : `SELECT * FROM linked_inventories
    UNION`
    } 
    SELECT * FROM additional_fees_with_0_price
    UNION
    SELECT * FROM additional_fees_tied_to_inventory_group_with_0_price
    ORDER BY name ASC`;

  const results = await rawStatement(ctx, statement, [
    {
      inventoryId: inventory.id,
      inventoryGroupId: inventory.inventoryGroupId,
      serviceType: DALTypes.FeeType.SERVICE,
    },
  ]);

  return (results && results.rows) || [];
};

// this is a costly operation, we should probably find a better way to find
// the timezone on a property. Since these values doesn't change often
// maybe we can create a `cache` for the settings and timezone of a Property
// In the meantime be aware this is costly and should not be used in loops
const getPropertyTimezoneFromInventoryId = async (ctx, inventoryId) => {
  const res = await initQuery(ctx)
    .from('Inventory')
    .join('Property', 'Inventory.propertyId', 'Property.id')
    .where('Inventory.id', inventoryId)
    .select('Property.timezone')
    .first();

  return (res || {}).timezone;
};

const updateInventory = async (ctx, inventoryId, updates) => {
  try {
    return await updateOne(ctx, 'Inventory', inventoryId, updates);
  } catch (error) {
    logger.error({ error, inventoryId, updates }, 'Error updating inventory');
    throw new ServiceError('ERROR_UPDATING_INVENTORY');
  }
};

const updateInventoryOnHoldsWhereIn = async (ctx, inventoryOnHoldsIds, dataToUpdate) => {
  try {
    return await initQuery(ctx).from('InventoryOnHold').whereIn('id', inventoryOnHoldsIds).update(dataToUpdate).returning('*');
  } catch (error) {
    logger.error({ error, inventoryOnHoldsIds, dataToUpdate }, 'Error updating inventory on holds');
    throw new ServiceError('ERROR_UPDATING_INVENTORIES');
  }
};

const updateInventoriesWhereIn = async (ctx, inventoryIds, dataToUpdate) => {
  try {
    await initQuery(ctx).from('Inventory').whereIn('id', inventoryIds).update(dataToUpdate);
  } catch (error) {
    logger.error({ error, inventoryIds, dataToUpdate }, 'Error updating inventories');
    throw new ServiceError('ERROR_UPDATING_INVENTORIES');
  }
};

export const bulkUpsertInventoriesFromImport = async (ctx, inventories) => await bulkUpsert(ctx, 'Inventory', inventories);

export const updateInventoriesWithParents = async (ctx, inventories) => {
  const query = `
    UPDATE db_namespace."Inventory" AS i
    SET "parentInventory" = p."parentInventory"::uuid
    FROM (values
      ${inventories.map(({ id, parentInventory }) => `('${id}', '${parentInventory}')`)}
    ) AS p(id, "parentInventory")
    WHERE p.id::uuid = i.id;
  `;

  await rawStatement(ctx, query);
};

export const bulkUpsertInventories = async (ctx, recordsToUpdate) =>
  await bulkUpsert(
    ctx,
    'Inventory',
    recordsToUpdate,
    ['id'],
    [
      'updated_at',
      'name',
      'propertyId',
      'multipleItemTotal',
      'description',
      'type',
      'floor',
      'layoutId',
      'inventoryGroupId',
      'buildingId',
      'parentInventory',
      'externalId',
      'address',
    ],
  );

export const getInventoriesByExternalId = async (ctx, externalIds) => {
  const inventories = await getAllWhereIn(ctx, 'Inventory', { column: 'externalId', array: externalIds });
  return inventories.reduce((acc, item) => {
    acc[item.externalId] = item;
    return acc;
  }, {});
};

// TODO: We should merge this function with "getInventoriesByExternalIds"
export const getInventoriesByComputedExternalId = async (ctx, computedExternalIds) => {
  const query = `
    SELECT
    CONCAT_WS('-', pro."externalId", NULLIF(b."externalId", ''), i."externalId") AS "computedExternalId",
    i.*
    FROM db_namespace."Inventory" AS i
    INNER JOIN db_namespace."Property" AS pro ON i."propertyId" = pro.id
    LEFT JOIN db_namespace."Building" AS b ON i."buildingId" = b.id AND  pro.id = b."propertyId"
    WHERE NULLIF(pro."externalId", '') IS NOT NULL
    AND NULLIF(i."externalId", '') IS NOT NULL
    AND CONCAT_WS('-', pro."externalId", NULLIF(b."externalId", ''), i."externalId") IN (${computedExternalIds.map(id => `'${id}'`).join(',')})
  `;
  const { rows } = await rawStatement(ctx, query);
  return (rows || []).reduce((acc, { computedExternalId, ...item }) => {
    acc[computedExternalId] = item;
    return acc;
  }, {});
};

export const getExportableRentableItemsByExternalIds = async (ctx, computedExternalIds, checkImportSetting) => {
  const importSettingCondition = checkImportSetting ? " AND (p.settings-> 'integration' -> 'import' ->> 'inventoryState')::boolean IS TRUE" : '';
  const query = `
    SELECT
    i.*,
    CONCAT_WS('-', p."externalId", NULLIF(b."externalId", ''), i."externalId") AS "computedExternalId",
    p.timezone
    FROM db_namespace."Inventory" i
    INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
    LEFT JOIN db_namespace."Building" b ON i."buildingId" = b.id
    WHERE 
    i.type <> '${DALTypes.InventoryType.UNIT}'
    ${importSettingCondition}
    AND NULLIF(i."externalId", '') IS NOT NULL
    AND NULLIF(p."externalId", '') IS NOT NULL
    AND CONCAT_WS('-', p."externalId", NULLIF(b."externalId", ''), i."externalId") IN(${computedExternalIds.map(id => `'${id}'`).join(',')})
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

const getInventoriesQualifiedNamesByIds = async (ctx, inventoryIds) => {
  if (inventoryIds.length <= 0) {
    return [];
  }

  return await initQuery(ctx).from('UnitSearch').whereIn('id', inventoryIds).select('id', 'fullQualifiedName');
};

const getUnitsByIds = async (ctx, ids) => {
  if (ids.length <= 0) {
    return [];
  }

  const result = await initQuery(ctx).from('UnitSearch').whereIn('id', ids).select('inventory_object');

  return result.map(inventory => inventory.inventory_object);
};

const getMarketRentRange = async schema => {
  const results = await knex.raw('SELECT MIN("standardRent") AS min, MAX("standardRent") AS max FROM :schema:."RmsPricing" WHERE "renewalDate" IS NULL', {
    schema,
  });

  if (!results || !results.rows) {
    logger.error({ tenantId: schema }, 'Error getting the Market Rent Range');
    return { min: 0, max: 10000 };
  }

  return results.rows.shift();
};

export {
  getInventoriesByIds,
  getInventoriesByFilters,
  getPropertyTimezoneFromInventoryId,
  saveInventory,
  getInventoryById,
  getInventoryAmenities,
  getInventoryByPropertyName,
  getInventoriesByPropertyId,
  getInventoryByPropertyAndBuilding,
  getComplimentsForInventory,
  loadInventory,
  loadInventoryByType,
  getInventoryByExternalId,
  updateInventory,
  getInventoriesQualifiedNamesByIds,
  getUnitsByIds,
  getAllInventoryAmenities,
  getMarketRentRange,
  updateInventoriesWhereIn,
  updateInventoryOnHoldsWhereIn,
};

export const getInventoryHolds = async (ctx, inventoryId, reasons = []) => {
  const reasonFilter = reasons.length ? 'AND reason = ANY(:reasons)' : '';

  const query = `
    SELECT *
    FROM db_namespace."InventoryOnHold"
    WHERE (NOW() <@ tstzrange("startDate", "endDate", '[)'))
    AND "inventoryId" = :inventoryId
    ${reasonFilter}`;

  const results = await rawStatement(ctx, query, [{ inventoryId, reasons }]);
  return (results && results.rows) || [];
};

export const getInventoriesOnHold = async ctx => {
  const query = `
    SELECT "InventoryOnHold".*, "Users"."fullName" AS "agentName" 
      FROM db_namespace."InventoryOnHold" 
      INNER JOIN db_namespace."Users" ON "InventoryOnHold"."heldBy" = "Users"."id" 
    WHERE NOW() <@ tstzrange("InventoryOnHold"."startDate", "InventoryOnHold"."endDate", '[)')`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

// All held inventory referenced by quotes of the given party (held by current party or not)
export const getInventoriesOnHoldForParty = async (ctx, partyId) => {
  const query = `
    SELECT ioh.*, u."fullName" as "agentName"
    FROM db_namespace."InventoryOnHold" ioh
    JOIN db_namespace."Users" u ON u.id = ioh."heldBy"
    JOIN db_namespace."Quote" q ON q."partyId" = :partyId AND q."inventoryId" = ioh."inventoryId"
    WHERE (NOW() <@ tstzrange(ioh."startDate", ioh."endDate", '[)'))
  `;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

// All held inventory by the current party
export const getAllHoldsForParty = async (ctx, partyId, reasons = []) => {
  const reasonFilter = reasons.length ? 'AND ioh.reason = ANY(:reasons)' : '';

  const query = `
    SELECT ioh.*, u."fullName" as "agentName"
    FROM db_namespace."InventoryOnHold" ioh
    JOIN db_namespace."Users" u ON u.id = ioh."heldBy"
    WHERE (NOW() <@ tstzrange(ioh."startDate", ioh."endDate", '[)'))
    AND ioh."partyId" = :partyId
    ${reasonFilter}`;

  const { rows } = await rawStatement(ctx, query, [{ partyId, reasons }]);
  return rows;
};

export const saveInventoryOnHold = async (ctx, inventoryOnHold) =>
  await insertInto(ctx, 'InventoryOnHold', inventoryOnHold, {
    conflictColumns: ['inventoryId'],
  });

export const updateInventoryOnHold = async (ctx, id, inventoryOnHold) => await update(ctx, 'InventoryOnHold', { id }, inventoryOnHold);

export const clearParentInventories = async ctx => {
  const query = `
    UPDATE db_namespace."Inventory"
    SET "parentInventory" = NULL;
  `;
  await rawStatement(ctx, query);
};

export const deleteInventoryOnHold = async (ctx, inventoryId) => await initQuery(ctx).from('InventoryOnHold').where('inventoryId', inventoryId).del();

export const getFirstCreatedInventoryForProperty = async (ctx, propertyId) =>
  await initQuery(ctx).from('Inventory').where('propertyId', propertyId).orderBy('created_at').first();

export const getInventoryForQuote = async (ctx, quoteId, columns = ['*']) => {
  const query = `SELECT
    ${columns.map(column => (column === '*' ? 'i.*' : `i."${column}"`)).join(', ')}
  FROM db_namespace."Quote" q
  JOIN db_namespace."Inventory" i ON i.id = q."inventoryId"
  WHERE q.id = :quoteId`;

  const { rows } = await rawStatement(ctx, query, [{ quoteId }]);
  return rows && rows[0];
};

export const releaseInventoriesOnHoldByParty = async (ctx, { partyId, reason }, inventoryOnHold, trx) =>
  await update(ctx.tenantId, 'InventoryOnHold', { partyId, reason, endDate: null }, inventoryOnHold, trx);

export const releaseInventoriesOnHoldByPartyAndInventory = async (ctx, { partyId, reason, inventoryId }, inventoryOnHold, trx) =>
  await update(ctx.tenantId, 'InventoryOnHold', { partyId, reason, inventoryId, endDate: null }, inventoryOnHold, trx);

export const getInventoriesOnHoldByParty = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getInventoriesOnHoldByParty');

  const query = `SELECT *
                 FROM db_namespace."InventoryOnHold"
                 WHERE "partyId" = :partyId
                 ORDER by created_at desc`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getInventoriesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const { tenantId } = ctx;
  const simpleFieldsToSelect = simpleFields.map(field => `Inventory.${field}`);

  const foreignKeysToSelect = ['Property.name as property', 'Building.name as building', 'Layout.name as layout', 'InventoryGroup.name as inventoryGroup'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .select(
      knex.raw(
        `ARRAY(select "Amenity".name from :tenantId:."Inventory_Amenity" inner join :tenantId:."Amenity" on "Amenity".id = "Inventory_Amenity"."amenityId" where "Inventory_Amenity"."inventoryId" = "Inventory".id AND "Inventory_Amenity"."endDate" IS NULL )
        as amenities`,
        {
          tenantId,
        },
      ),
    )
    .select(
      knex.raw(
        `(select "Building"."name" || '-' || "parent".name
          from :tenantId:."Inventory" as parent
          left join :tenantId:."Building" on "Building".id = "parent"."buildingId"
          where "parent"."id" = "Inventory"."id" and "Inventory"."parentInventory" is not null) as "parentInventory"`,
        {
          tenantId,
        },
      ),
    )
    .from('Inventory')
    .innerJoin('Property', 'Inventory.propertyId', 'Property.id')
    .leftJoin('Building', 'Inventory.buildingId', 'Building.id')
    .leftJoin('Layout', 'Inventory.layoutId', 'Layout.id')
    .innerJoin('InventoryGroup', 'Inventory.inventoryGroupId', 'InventoryGroup.id')
    .whereIn('Inventory.propertyId', propertyIdsToExport);
};

export const getInventoriesStateAndStateStartDate = async (ctx, inventories) => {
  const { inventoriesNames, inventoriesPropertyIds, inventoriesBuildingIds } = getInventoriesIdentifiers(inventories);

  const query = `
    SELECT state, "stateStartDate", name, "buildingId", "propertyId"
    FROM db_namespace."Inventory"
    WHERE
    "name" = ANY(:inventoriesNames) AND
    "propertyId" = ANY(:inventoriesPropertyIds)
    AND ( "buildingId" IS NULL OR "buildingId" = ANY(:inventoriesBuildingIds))
  `;
  const { rows } = (await rawStatement(ctx, query, [{ inventoriesNames, inventoriesPropertyIds, inventoriesBuildingIds }])) || {};

  return rows;
};

export const updateInventoryOnHoldByPartyIdAndInvId = async (ctx, { inventoryId, partyId, partyMemberId, assignedPropertyId }) => {
  logger.trace({ ctx, inventoryId, partyId, partyMemberId }, 'updateInventoryOnHoldByPartyIdAndInvId');

  const query = `
    UPDATE db_namespace."InventoryOnHold"
      SET metadata = metadata || '{"primaryPartyMemberId": "${partyMemberId}", "propertyId": "${assignedPropertyId}"}'
    WHERE "inventoryId" = :inventoryId
      AND "partyId" = :partyId
      AND "endDate" IS NULL
      AND metadata ->> 'primaryPartyMemberId' IS NULL
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId, partyId }]);
  return rows && rows[0];
};

export const getFullInventoryName = async (ctx, inventoryId) => {
  logger.trace({ ctx, inventoryId }, 'getFullInventoryName');

  const query = `
    SELECT property."name" AS "propertyName", building."name" AS "buildingName", inventory."name" AS "inventoryName" FROM db_namespace."Inventory" inventory
    JOIN db_namespace."Building" building ON building."id" = inventory."buildingId"
    JOIN db_namespace."Property" property ON property."id" = inventory."propertyId"
    WHERE inventory."id" = :inventoryId
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);
  return rows && rows[0];
};

export const getFullUnitQualifiedNameForInventories = async (ctx, inventoryIds) => {
  logger.trace({ ctx, inventoryIds }, 'getFullUnitQualifiedNameForInventories');

  const query = `
    SELECT property."name" AS "propertyName", building."name" AS "buildingName", inventory.name AS "inventoryName", inventory.id FROM db_namespace."Inventory" inventory
    JOIN db_namespace."Building" building ON building.id = inventory."buildingId"
    JOIN db_namespace."Property" property ON property.id = inventory."propertyId"
    WHERE inventory.id IN (${inventoryIds.map(id => `'${id}'`).join(',')})
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryIds }]);
  return rows;
};

export const updateLastInventoryOnHoldByPartyId = async (ctx, { partyId, partyMemberId, assignedPropertyId }) => {
  logger.trace({ ctx, partyId, partyMemberId }, 'updateLastInventoryOnHoldByPartyId');

  const query = `
    UPDATE db_namespace."InventoryOnHold"
      SET metadata = metadata || '{"primaryPartyMemberId": "${partyMemberId}", "propertyId": "${assignedPropertyId}"}'
    WHERE id = (SELECT id FROM db_namespace."InventoryOnHold"
                  WHERE "partyId" = :partyId
                  ORDER BY created_at DESC
                  LIMIT 1)
      RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows && rows[0];
};

export const updateInventoriesWithAvailabilityOffset = async (ctx, propertiesAndInventoryAvailabilityOffsets) => {
  logger.trace({ ctx, propertiesAndInventoryAvailabilityOffsets }, 'updateInventoriesWithAvailabilityOffset');

  const propertyNames = Object.keys(propertiesAndInventoryAvailabilityOffsets);

  const query = day => `
  UPDATE db_namespace."Inventory" i
  SET "availabilityDate"= (now() + INTERVAL '${day} DAY')::DATE AT TIME ZONE pr.timezone 
  FROM db_namespace."Property" pr
  WHERE i."propertyId" = pr.id AND pr.name = :propertyName AND ARRAY[i.name] <@ :unitIds;
  `;

  await mapSeries(propertyNames, async propertyName => {
    const availabilityOffsets = propertiesAndInventoryAvailabilityOffsets[propertyName].availabilityOffsets;
    if (availabilityOffsets) {
      const days = Object.keys(availabilityOffsets);
      await mapSeries(days, async day => await rawStatement(ctx, query(day), [{ propertyName, unitIds: availabilityOffsets[day] }]));
    }
  });
};

export const getInventoryByInventoryNamePropertyIdAndBuildingName = async (ctx, name, propertyId, buildingName) => {
  const query = `
    SELECT i.* FROM db_namespace."Inventory" i
    INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
    LEFT JOIN db_namespace."Building" b ON i."buildingId" = b.id
    WHERE i.name = :name
    AND p.id = :propertyId
    AND b.name = :buildingName
  `;
  const { rows } = await rawStatement(ctx, query, [{ name, propertyId, buildingName }]);
  return rows && rows[0];
};

export const getInventoriesByExternalIds = async (ctx, externalIds) => {
  logger.trace({ ctx, numberOfExternalIds: externalIds.length }, 'getInventoriesByExternalIds');

  const query = `
    SELECT i.*, p.timezone FROM db_namespace."Inventory" i
    INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
    WHERE i."externalId" IN (${externalIds.map(id => `'${id}'`).join(',')})
  `;
  const { rows } = await rawStatement(ctx, query);

  return rows;
};

export const resetLossLeaderUnitFlag = async ctx => {
  const query = `
    UPDATE db_namespace."Inventory"
      SET "lossLeaderUnit" = NULL
    WHERE "lossLeaderUnit" IS NOT NULL`;

  await rawStatement(ctx, query);
};
