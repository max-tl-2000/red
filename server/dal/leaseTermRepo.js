/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertOrUpdate, getOne, knex, rawStatement, bulkUpsert } from '../database/factory';

export const saveLeaseName = (ctx, leaseName) => {
  const conflictColumns = ['name', 'propertyId'];
  return insertOrUpdate(ctx.tenantId, 'LeaseName', leaseName, {
    conflictColumns,
  });
};

export const saveLeaseTerm = (ctx, leaseTerm) => {
  const conflictColumns = ['termLength', 'leaseNameId', 'period'];
  return insertOrUpdate(ctx.tenantId, 'LeaseTerm', leaseTerm, {
    conflictColumns,
  });
};

export const saveLeaseTerms = async (ctx, leaseTerms) => await bulkUpsert(ctx, 'LeaseTerm', leaseTerms, ['termLength', 'leaseNameId', 'period']);

export const getLeaseTerms = async ctx => await initQuery(ctx).from('LeaseTerm');

export const getLeaseTermById = async (ctx, leaseTermId) => await initQuery(ctx).from('LeaseTerm').where({ id: leaseTermId }).first();

export const getLeaseByNameAndProperty = async (ctx, leaseName, propertyId) =>
  await initQuery(ctx).from('LeaseName').where('name', leaseName).andWhere('propertyId', propertyId).first();

export const getLeaseByNameAndPropertyName = async (ctx, leaseName, property) =>
  await initQuery(ctx)
    .from('LeaseName')
    .select('LeaseName.*')
    .innerJoin('Property', 'LeaseName.propertyId', 'Property.id')
    .where('Property.name', property)
    .andWhere('LeaseName.name', leaseName)
    .first();

export const getAllLeaseNames = async ctx => {
  const query = `
    SELECT ln.*, p.name as "propertyName"
    FROM db_namespace."LeaseName" ln
    INNER JOIN db_namespace."Property" p ON ln."propertyId" = p.id;`;

  const results = await rawStatement(ctx, query);
  return results && results.rows;
};

export const getLeaseNamesByPropertyId = async (ctx, propertyId) => await initQuery(ctx).from('LeaseName').where('propertyId', propertyId);

export const getLeaseNameById = (ctx, id) => getOne(ctx, 'LeaseName', id);

export const getLeaseTermsByInventoryId = async (ctx, inventoryId, leaseTermState, filterInactive = false) => {
  const inactiveCondition = filterInactive ? 'AND lt.inactive::BOOLEAN = FALSE' : '';
  const leaseTermsQuery = `
    SELECT lt.id, lt."termLength", lt.period, lt."relativeAdjustment", lt."absoluteAdjustment", lt."leaseNameId", lt.state
    FROM db_namespace."Inventory" i
    INNER JOIN db_namespace."InventoryGroup" ig ON ig.id = i."inventoryGroupId"
    INNER JOIN db_namespace."LeaseTerm" lt ON lt."leaseNameId" = ig."leaseNameId"
    WHERE i.id = :inventoryId ${inactiveCondition}
  `;

  const leaseTermStateFilterQuery = leaseTermState ? `${leaseTermsQuery} AND (lt.state = :leaseTermState OR lt.state IS NULL)` : leaseTermsQuery;
  const results = await rawStatement(ctx, leaseTermStateFilterQuery, [{ inventoryId, leaseTermState }]);
  return results && results.rows;
};

export const getOneMonthLeaseTermByInventoryId = async (ctx, inventoryId, leaseTermState) => {
  const query = `
    SELECT lt.id, lt."termLength", lt.period, lt."relativeAdjustment", lt."absoluteAdjustment", lt."leaseNameId", lt.state
    FROM db_namespace."Inventory" i
    INNER JOIN db_namespace."InventoryGroup" ig ON ig.id = i."inventoryGroupId"
    INNER JOIN db_namespace."LeaseTerm" lt ON lt."leaseNameId" = ig."leaseNameId"
    WHERE i.id = :inventoryId 
    AND ( lt.state = :leaseTermState OR lt.state IS NULL) 
    AND lt."termLength" = 1
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId, leaseTermState }]);
  return rows[0];
};

export const getLeaseTermsByInventoryGroupIds = async (ctx, inventoryGroupIds, filterInactive = false) => {
  const inactiveCondition = filterInactive ? 'AND lt.inactive::BOOLEAN = FALSE' : '';
  const leaseTermsQuery = `
    SELECT lt.id, lt."termLength", lt.period, lt."relativeAdjustment", lt."absoluteAdjustment", lt."leaseNameId", lt.state, ig.id as "inventoryGroupId"
    FROM db_namespace."LeaseTerm" lt
    INNER JOIN db_namespace."InventoryGroup" ig ON lt."leaseNameId" = ig."leaseNameId"
    WHERE ig.id = ANY(:inventoryGroupIds) ${inactiveCondition}
  `;

  const results = await rawStatement(ctx, leaseTermsQuery, [{ inventoryGroupIds: `{${inventoryGroupIds.join(',')}}` }]);
  return results && results.rows;
};

export const getLeaseTermsByPropertyIds = async (ctx, propertyIds) =>
  await initQuery(ctx)
    .from('LeaseTerm')
    .select(
      knex.raw(
        `distinct on ("InventoryGroup"."propertyId","LeaseTerm"."termLength", "LeaseTerm"."period")
        "InventoryGroup"."propertyId",
        "LeaseTerm"."id",
        "LeaseTerm"."termLength",
        "LeaseTerm"."period",
        "LeaseTerm"."state"`,
      ),
    )
    .innerJoin('InventoryGroup', 'LeaseTerm.leaseNameId', 'InventoryGroup.leaseNameId')
    .whereIn('InventoryGroup.propertyId', propertyIds)
    .orderBy('InventoryGroup.propertyId', 'asc')
    .orderBy('LeaseTerm.termLength', 'asc')
    .orderBy('LeaseTerm.period', 'asc');

export const getLeaseTermsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `LeaseTerm.${field}`);
  const foreignKeysToSelect = ['Property.name as property', 'LeaseName.name as leaseName'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('LeaseTerm')
    .innerJoin('LeaseName', 'LeaseTerm.leaseNameId', 'LeaseName.id')
    .innerJoin('Property', 'LeaseName.propertyId', 'Property.id')
    .whereIn('LeaseName.propertyId', propertyIdsToExport);
};

export const getLeasesByIdsWhereIn = async (ctx, leaseIds) => await initQuery(ctx).select('name').from('LeaseName').whereIn('id', leaseIds);
