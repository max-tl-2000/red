/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, rawStatement } from '../database/factory';
import { prepareRawQuery } from '../common/schemaConstants';
import { DALTypes } from '../../common/enums/DALTypes';
import { createCteFromArray } from '../helpers/repoHelper';

const nonZeroAmenitiesQuery = includePropertyFilter => {
  const propertyFilter = includePropertyFilter ? '"propertyId" = :propertyId AND ' : '';

  return `
  SELECT
    id,
    category,
    "propertyId",
    "relativePrice",
    "absolutePrice",
    "targetUnit"
  FROM db_namespace."Amenity"
  WHERE ${propertyFilter} ("relativePrice" <> 0::numeric OR "absolutePrice" <> 0::numeric)
  AND "endDate" IS NULL
`;
};

const getInventoryPricesQuery = (inventoryIds, includePropertyFilter) => {
  const cteName = 'cte_inventory_ids';
  const cteColumnName = ['inventoryId'];

  const filterByInventoryIds = inventoryIds?.length;
  const inventoryIdsCteQuery = filterByInventoryIds ? `${createCteFromArray(inventoryIds, cteName, cteColumnName, 'UUID')})` : '';
  const inventoryIdsJoinQuery = filterByInventoryIds ? 'JOIN cte_inventory_ids ON cte_inventory_ids."inventoryId" = i.id' : '';

  const propertyFilter = includePropertyFilter ? 'p.id = :propertyId AND ' : '';

  return `
    ${inventoryIdsCteQuery}
    SELECT
      i.id,
      i.name,
      i.type,
      ig."basePriceMonthly",
      i."inventoryGroupId",
      i."layoutId",
      i."buildingId",
      i."rmsExternalId",
      i.state,
      i."stateStartDate",
      i."availabilityDate",
      p.id "propertyId"
    FROM db_namespace."Inventory" i
    ${inventoryIdsJoinQuery}
    JOIN db_namespace."InventoryGroup" ig ON i."inventoryGroupId" = ig.id
    JOIN db_namespace."Property" p ON i."propertyId" = p.id
    WHERE (${propertyFilter} i.state <> :occupiedState OR i.type != :unitType) AND (COALESCE(NULLIF(p.settings->'integration'->'import'->>'unitPricing', ''), 'false')::boolean = :revaPricingSetting OR i.type <> :unitType)
 `;
};

const inventoryGroupAmenitiesQuery = `
  SELECT
    i.id,
    i.name,
    i.type,
    i."inventoryGroupId",
    i."basePriceMonthly",
    iga."amenityId",
    i."rmsExternalId",
    i.state,
    i."stateStartDate",
    i."availabilityDate",
    i."propertyId"
  FROM inventory_prices i
  JOIN db_namespace."InventoryGroup_Amenity" iga ON i."inventoryGroupId" = iga."inventoryGroupId"
`;

const layoutAmenitiesQuery = `
  SELECT
    i.id,
    i.name,
    i.type,
    i."inventoryGroupId",
    i."basePriceMonthly",
    la."amenityId",
    i."rmsExternalId",
    i.state,
    i."stateStartDate",
    i."availabilityDate",
    i."propertyId"
  FROM inventory_prices i
  JOIN db_namespace."Layout_Amenity" la ON i."layoutId" = la."layoutId"
`;

const inventoryAmenitiesQuery = `
  SELECT
    ia."inventoryId",
    i.name,
    i.type,
    i."inventoryGroupId",
    i."basePriceMonthly",
    ia."amenityId",
    i."rmsExternalId",
    i.state,
    i."stateStartDate",
    i."availabilityDate",
    i."propertyId"
  FROM inventory_prices i
  JOIN db_namespace."Inventory_Amenity" ia ON i.id = ia."inventoryId" AND ia."endDate" IS NULL
`;

const buildingAmenitiesQuery = `
  SELECT
    i.id,
    i.name,
    i.type,
    i."inventoryGroupId",
    i."basePriceMonthly",
    ba."amenityId",
    i."rmsExternalId",
    i.state,
    i."stateStartDate",
    i."availabilityDate",
    i."propertyId"
  FROM inventory_prices i
  JOIN db_namespace."Building_Amenity" ba ON i."buildingId" = ba."buildingId"
`;

const finalAmenitiesQuery = `
  SELECT
                    t_1.id,
                    t_1.name,
                    t_1.type,
                    (t_1."basePriceMonthly" + t_1."totalAbsolutePrice")::double precision + (t_1."totalRelativePrice" * t_1."basePriceMonthly")::double precision / 100::double precision AS "marketRentMonthly",
                    t_1."inventoryGroupId",
                    t_1."rmsExternalId",
                    t_1.state,
                    t_1."stateStartDate",
                    t_1."availabilityDate",
                    t_1."propertyId"
                FROM ( SELECT
                           u.id,
                           u.name,
                           u.type,
                           u."inventoryGroupId",
                           u."basePriceMonthly",
                           sum(a."absolutePrice") AS "totalAbsolutePrice",
                           sum(a."relativePrice") AS "totalRelativePrice",
                           u."rmsExternalId",
                           u.state,
                           u."stateStartDate",
                           u."availabilityDate",
                           u."propertyId"
                       FROM ( SELECT * FROM inventory_group_amenities

                              UNION

                              SELECT * FROM layout_amenities

                              UNION

                              SELECT * FROM inventory_amenities

                              UNION

                              SELECT ba.*
                              FROM building_amenities ba
                              WHERE ba.type::text = 'unit'::text OR ba.type::text = 'subUnit'::text

                              UNION

                              SELECT ba.*
                              FROM building_amenities ba
                              JOIN non_zero_amenities a_1 ON ba."amenityId" = a_1.id
                              WHERE ba.type::text <> 'unit'::text AND ba.type::text <> 'subUnit'::text AND a_1."targetUnit" = false

                              UNION

                              SELECT
                                  i.id,
                                  i.name,
                                  i.type,
                                  i."inventoryGroupId",
                                  i."basePriceMonthly",
                                  a_1.id as "amenityId",
                                  i."rmsExternalId",
                                  i.state,
                                  i."stateStartDate",
                                  i."availabilityDate",
                                  i."propertyId"
                              FROM inventory_prices i
                              JOIN non_zero_amenities a_1 ON a_1.category::text = 'property'::text
                              WHERE i.type::text = 'unit'::text OR i.type::text = 'subUnit'::text

                              UNION

                              SELECT
                                  i.id,
                                  i.name,
                                  i.type,
                                  i."inventoryGroupId",
                                  i."basePriceMonthly",
                                  a_1.id as "amenityId",
                                  i."rmsExternalId",
                                  i.state,
                                  i."stateStartDate",
                                  i."availabilityDate",
                                  i."propertyId"
                              FROM inventory_prices i
                              JOIN non_zero_amenities a_1 ON a_1.category::text = 'property'::text
                              WHERE i.type::text <> 'unit'::text AND i.type::text <> 'subUnit'::text AND a_1."targetUnit" = false) u

                    JOIN non_zero_amenities a ON u."amenityId" = a.id
                GROUP BY u.id, u.name, u.type, u."inventoryGroupId", u."basePriceMonthly", u."rmsExternalId", u.state, u."stateStartDate", u."availabilityDate", u."propertyId") t_1
`;

const getPricingQuery = (ctx, inventoryIds, propertyId) => {
  const includePropertyFilter = !!propertyId;
  return prepareRawQuery(
    `
      WITH non_zero_amenities AS (
        ${nonZeroAmenitiesQuery(includePropertyFilter)}
      ), inventory_prices AS (
        ${getInventoryPricesQuery(inventoryIds, includePropertyFilter)}
      ), inventory_group_amenities AS (
        ${inventoryGroupAmenitiesQuery}
      ), layout_amenities AS (
        ${layoutAmenitiesQuery}
      ), inventory_amenities AS (
        ${inventoryAmenitiesQuery}
      ), building_amenities AS (
        ${buildingAmenitiesQuery}
      )
      SELECT t.*
        FROM (
         SELECT
            COALESCE(ut.id, ip.id) AS id,
            COALESCE(ut.name, ip.name) AS name,
            COALESCE(ut.type, ip.type) AS type,
            round(COALESCE(ut."marketRentMonthly", ip."basePriceMonthly"::double precision)) AS "marketRentMonthly",
            COALESCE(ut."inventoryGroupId", ip."inventoryGroupId") AS "inventoryGroupId",
            COALESCE(ut."rmsExternalId", ip."rmsExternalId") AS "rmsExternalId",
            COALESCE(ut.state, ip.state) AS state,
            COALESCE(ut."stateStartDate", ip."stateStartDate") AS "stateStartDate",
            COALESCE(ut."availabilityDate", ip."availabilityDate") AS "availabilityDate",
            COALESCE(lt."termLength", 1) AS "termLength",
            COALESCE(lt."relativeAdjustment", 0) AS "relativeAdjustment",
            COALESCE(lt."absoluteAdjustment", 0) AS "absoluteAdjustment",
            lt."state" AS "leaseState",
            COALESCE(ut."propertyId", ip."propertyId") AS "propertyId"
         FROM (${finalAmenitiesQuery}) ut
         RIGHT JOIN inventory_prices ip ON ut.id = ip.id
         INNER JOIN db_namespace."InventoryGroup" ig ON ip."inventoryGroupId" = ig.id
         LEFT JOIN db_namespace."LeaseTerm" lt ON ig."leaseNameId" = lt."leaseNameId"
         WHERE (ut."marketRentMonthly" IS NOT NULL OR ip."basePriceMonthly" IS NOT null)
           AND (lt.inactive IS FALSE OR lt.inactive IS NULL)) t

      `,
    ctx.tenantId,
  );
};

export const getRevaPricing = async (ctx, propertyId, inventoryIds) => {
  const { rows } = await knex.raw(getPricingQuery(ctx, inventoryIds, propertyId), {
    propertyId,
    occupiedState: DALTypes.InventoryState.OCCUPIED,
    revaPricingSetting: false,
    unitType: DALTypes.InventoryType.UNIT,
  });

  return rows || [];
};

export const getRevaPricingByPropertyId = async (ctx, propertyId) => await getRevaPricing(ctx, propertyId);

export const getRevaPricingByInventoryIds = async (ctx, propertyId, inventoryIds) => await getRevaPricing(ctx, propertyId, inventoryIds);

export const getPropertiesWherePricingRelatedTablesChanged = async ctx => {
  const query = `
    select "propertyId" from (
      with "EarliestUpdatedPricing" as (
        select i."propertyId", min(r.updated_at) as "earliestUpdatedPricing" from db_namespace."RmsPricing" r inner join db_namespace."Inventory" i on r."inventoryId"=i.id group by i."propertyId"
      ), "LastUpdatedAmenity" as (
        select a."propertyId", max(a.updated_at) as "lastUpdatedAmenity" from db_namespace."Amenity" a group by a."propertyId"
      ), "LastUpdatedBuildingAmenity" as (
        select b."propertyId", max(ba.updated_at) as "lastUpdatedBuildingAmenity" from db_namespace."Building" b inner join db_namespace."Building_Amenity" ba on ba."buildingId"=b.id group by b."propertyId"
      ), "LastUpdatedLayoutAmenity" as (
        select l."propertyId", max(la.updated_at) as "lastUpdatedLayoutAmenity" from db_namespace."Layout" l inner join db_namespace."Layout_Amenity" la on la."layoutId"=l.id group by l."propertyId"
      ), "LastUpdatedInventoryGroupAmenity" as ( -- last updated IG and last inventoryGroupAmenity
        select ig."propertyId", greatest(max(ig.updated_at), max(COALESCE(iga.updated_at, to_timestamp(0)))) as "lastUpdatedInventoryGroupAmenity" from db_namespace."InventoryGroup" ig left join db_namespace."InventoryGroup_Amenity" iga on iga."inventoryGroupId"=ig.id group by ig."propertyId"
      ), "LastUpdatedInventory" as ( -- lastupdated inventory and last inventory amenity
        select i."propertyId", greatest(max(i.updated_at), max(COALESCE(ia.updated_at, to_timestamp(0)))) as "lastUpdatedInventory" from db_namespace."Inventory" i left join db_namespace."Inventory_Amenity" ia on ia."inventoryId"=i.id
        inner join db_namespace."Property" p on i."propertyId"=p.id
        where COALESCE(NULLIF(p.settings->'integration'->'import'->>'unitPricing', ''), 'false')::boolean = false OR i.type <> 'unit'
        group by i."propertyId"
      ), "LastUpdatedLeaseTerm" as (
        select n."propertyId", max(t.updated_at) as "lastUpdatedLeaseTerm" from db_namespace."LeaseName" n inner join db_namespace."LeaseTerm" t on t."leaseNameId"=n.id group by n."propertyId"
      )

    select p.id as "propertyId", COALESCE("earliestUpdatedPricing", to_timestamp(0)) as "earliestUpdatedPricing", greatest("lastUpdatedAmenity", "lastUpdatedBuildingAmenity", "lastUpdatedLayoutAmenity", "lastUpdatedInventoryGroupAmenity", "lastUpdatedInventory", "lastUpdatedLeaseTerm") as "lastIndirectChange",
      "lastUpdatedAmenity", "lastUpdatedBuildingAmenity", "lastUpdatedLayoutAmenity", "lastUpdatedInventoryGroupAmenity", "lastUpdatedInventory", "lastUpdatedLeaseTerm"
    from db_namespace."Property" p
    left join "EarliestUpdatedPricing" lup on p.id=lup."propertyId"
    left join "LastUpdatedAmenity" lua on p.id=lua."propertyId"
    left join "LastUpdatedBuildingAmenity" luba on p.id=luba."propertyId"
    left join "LastUpdatedLayoutAmenity" lula on p.id=lula."propertyId"
    left join "LastUpdatedInventoryGroupAmenity" luiga on p.id=luiga."propertyId"
    left join "LastUpdatedInventory" lui on p.id=lui."propertyId"
    left join "LastUpdatedLeaseTerm" lult on p.id=lult."propertyId"
    ) as pr

    where "earliestUpdatedPricing" <= "lastIndirectChange" and "lastUpdatedInventory" is not null;`;

  const { rows } = await rawStatement(ctx, query);

  return rows || [];
};

export const getInventoriesUpdatedAfterLastPriceUpdate = async ctx => {
  const query = `
    with "LastUpdatedPricing" as (
    SELECT i."propertyId", max(r.updated_at) as updated_at
    FROM db_namespace."RmsPricing" r
    INNER JOIN db_namespace."Inventory" i ON r."inventoryId" = i.id
    GROUP BY i."propertyId"
    )
    SELECT i."propertyId", p.name as "propertyName", i.id, i.name as "inventoryName", state, i.updated_at as "inventoryUpdated", d.updated_at as "rmsUpdated"
    FROM db_namespace."Inventory" as i
    INNER JOIN db_namespace."Property" as p ON p.id = i."propertyId"
    LEFT JOIN "LastUpdatedPricing" as d ON d."propertyId" = i."propertyId"
    WHERE (COALESCE(NULLIF(p.settings->'integration'->'import'->>'unitPricing', ''), 'false')::boolean = false OR i.type <> 'unit')
    AND (i.updated_at >= d.updated_at OR d.updated_at IS NULL);`;

  const { rows } = await rawStatement(ctx, query);

  return rows || [];
};
