/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import mergeWith from 'lodash/mergeWith';
import pick from 'lodash/pick';
import { knex, runInTransaction, getOneWhere, rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { SqlValueConverter, formatColumnsToSelect, formatValuesToMultipleInsert, createCteFromArray } from '../helpers/repoHelper';
import { parseAsInTimezone } from '../../common/helpers/moment-utils';
import { getPropertyTimezone, getPropertyByRmsExternalId, getPropertyById } from './propertyRepo';
import { RmsImportError, RmsPricingEvents } from '../../common/enums/enums';
import { DALTypes } from '../../common/enums/DALTypes';
import { prepareRawQuery } from '../common/schemaConstants';
import { throwCustomError } from '../common/errors';
import { isBoolean } from '../../common/helpers/type-of';
import { hasOwnProp } from '../../common/helpers/objUtils';

const logger = loggerModule.child({ subType: 'rmsPricingRepo' });

const RMS_PRICING_TABLE_NAME = 'RmsPricing';
const INVENTORY_TABLE_NAME = 'Inventory';
const INVENTORY_GROUP_TABLE_NAME = 'InventoryGroup';
const PROPERTY_TABLE_NAME = 'Property';
const LEASE_TERM_TABLE_NAME = 'LeaseTerm';

const RMS_PRICING_COLUMNS = [
  'id',
  'inventoryId',
  'fileName',
  'rmsProvider',
  'minRent',
  'minRentStartDate',
  'minRentEndDate',
  'minRentLeaseLength',
  'standardLeaseLength',
  'standardRent',
  'availDate',
  'status',
  'amenityValue',
  'rentMatrix',
  'amenities',
  'renewalDate',
  'type',
  'propertyId',
  'pricingType',
];

const { toVarcharValue, toNumericValue, toJsonValue, toUuidValue } = SqlValueConverter;

const RMS_PRICING_COLUMNS_TYPES_MAPPING = {
  id: toUuidValue,
  inventoryId: toVarcharValue,
  fileName: toVarcharValue,
  rmsProvider: toVarcharValue,
  minRent: toNumericValue,
  minRentStartDate: ({ value, options: { timezone } }) => `'${parseAsInTimezone(value, { timezone }).startOf('day').toJSON()}'`,
  minRentEndDate: ({ value, options: { timezone } }) => `'${parseAsInTimezone(value, { timezone }).endOf('day').toJSON()}'`,
  minRentLeaseLength: toNumericValue,
  standardLeaseLength: toNumericValue,
  standardRent: toNumericValue,
  availDate: ({ value, options: { timezone } }) => `'${parseAsInTimezone(value, { timezone }).startOf('day').toJSON()}'`,
  status: toVarcharValue, // TODO: We should create a map object to handle LRO states
  amenityValue: toNumericValue,
  rentMatrix: toJsonValue,
  amenities: toVarcharValue,
  renewalDate: ({ value, options: { timezone } }) => (value ? `'${parseAsInTimezone(value, { timezone }).startOf('day').toJSON()}'` : 'NULL'),
  type: toVarcharValue,
  propertyId: toVarcharValue,
  pricingType: toVarcharValue,
};

const getDeleteRmsPricingByInventoryIdsQuery = (ctx, { unitsPricing, onlyNonUnits = false }) => {
  const inventoryIds = unitsPricing.filter(({ type }) => (onlyNonUnits ? type !== DALTypes.InventoryType.UNIT : true)).map(({ inventoryId }) => inventoryId);

  const cteName = 'cte_inventory_ids';
  const cteColumnName = ['inventoryId'];
  const inventoryIdsCteQuery = createCteFromArray(inventoryIds, cteName, cteColumnName);

  return `${inventoryIdsCteQuery})
        DELETE FROM db_namespace.:rmsPricingTable: AS rms
        WHERE EXISTS (SELECT 1 FROM "${cteName}" cte WHERE cte."${cteColumnName[0]}" = rms."inventoryId"::varchar );`;
};

const deleteUnitsPricingQueryMapping = {
  [true]: {
    [RmsPricingEvents.EXTERNAL_RMS_IMPORT]: () => 'DELETE FROM db_namespace.:rmsPricingTable: WHERE "propertyId" = :propertyId and type = :unitType;',
    [RmsPricingEvents.REVA_IMPORT]: () => 'DELETE FROM db_namespace.:rmsPricingTable: WHERE "propertyId" = :propertyId and type <> :unitType;',
    [RmsPricingEvents.INVENTORY_STATE_CHANGE]: (ctx, { unitsPricing }) => getDeleteRmsPricingByInventoryIdsQuery(ctx, { unitsPricing, onlyNonUnits: true }),
  },
  [false]: {
    [RmsPricingEvents.EXTERNAL_RMS_IMPORT]: () => '',
    [RmsPricingEvents.REVA_IMPORT]: () => 'DELETE FROM db_namespace.:rmsPricingTable: WHERE "propertyId" = :propertyId;',
    [RmsPricingEvents.INVENTORY_STATE_CHANGE]: (ctx, { unitsPricing }) => getDeleteRmsPricingByInventoryIdsQuery(ctx, { unitsPricing }),
  },
};

const inventoriesToInsertMapping = {
  [true]: {
    [RmsPricingEvents.EXTERNAL_RMS_IMPORT]: unitsPricing => unitsPricing,
    [RmsPricingEvents.REVA_IMPORT]: unitsPricing => unitsPricing.filter(({ type }) => type !== DALTypes.InventoryType.UNIT),
    [RmsPricingEvents.INVENTORY_STATE_CHANGE]: unitsPricing => unitsPricing.filter(({ type }) => type !== DALTypes.InventoryType.UNIT),
  },
  [false]: {
    [RmsPricingEvents.EXTERNAL_RMS_IMPORT]: () => [],
    [RmsPricingEvents.REVA_IMPORT]: unitsPricing => unitsPricing.filter(({ status }) => status !== DALTypes.InventoryState.OCCUPIED),
    [RmsPricingEvents.INVENTORY_STATE_CHANGE]: unitsPricing => unitsPricing.filter(({ status }) => status !== DALTypes.InventoryState.OCCUPIED),
  },
};

const deleteAndInsertUnitsPricing = async (ctx, { propertyId, unitsPricing, pricingSetting, rmsPricingEvent }) => {
  const { tenantId, trx } = ctx;

  const columns = formatColumnsToSelect({ columns: RMS_PRICING_COLUMNS, format: '"{0}"' });
  const timezone = await getPropertyTimezone(ctx, propertyId);

  const inventoriesToInsert = inventoriesToInsertMapping[pricingSetting][rmsPricingEvent](unitsPricing);
  if (!inventoriesToInsert.length) return [];

  const values = formatValuesToMultipleInsert(inventoriesToInsert, {
    columns: RMS_PRICING_COLUMNS,
    columnsTypeMapping: RMS_PRICING_COLUMNS_TYPES_MAPPING,
    options: { timezone },
  });

  const deleteRulesMapping = deleteUnitsPricingQueryMapping[pricingSetting];
  const deleteQuery = await deleteRulesMapping[rmsPricingEvent](ctx, { unitsPricing });

  await await knex
    .raw(prepareRawQuery(deleteQuery, tenantId), { rmsPricingTable: RMS_PRICING_TABLE_NAME, propertyId, unitType: DALTypes.InventoryType.UNIT })
    .transacting(trx)
    .catch(error => {
      trx.rollback();
      throw error;
    });

  return await knex
    .raw(
      prepareRawQuery(
        `INSERT INTO db_namespace.:rmsPricingTable: (${columns})
         VALUES ${values};`,
        tenantId,
      ),
      { rmsPricingTable: RMS_PRICING_TABLE_NAME },
    )
    .transacting(trx)
    .catch(error => {
      trx.rollback();
      throw error;
    });
};

/* This function formats the external ids into PostgreSQL List Values
   This allow us to create a CTE in a simple and high performance way. The execution time
   of this query is almost as twice faster than an IN clause, depending of the amount of data
   it could be 3 times faster
*/
export const getInventoriesByExternalIds = async (ctx, externalIds, propertyId) => {
  const { tenantId, trx } = ctx;

  const executeQuery = async innerTrx => {
    const cteName = 'cte_external_ids';
    const cteColumnName = ['externalId'];
    const externalIdsCteQuery = createCteFromArray(externalIds, cteName, cteColumnName);

    return await knex
      .raw(
        `${externalIdsCteQuery}
        )
        SELECT i.id, COALESCE(NULLIF(i."rmsExternalId", ''), i.id::TEXT) as "rmsExternalId", i.name, COALESCE(b.name, '') as "buildingName", i.type FROM "${tenantId}"."${INVENTORY_TABLE_NAME}" AS i
          LEFT JOIN "${tenantId}"."Building" b ON b.id = i."buildingId"
          WHERE EXISTS (SELECT 1 FROM "${cteName}" cte WHERE (cte."${cteColumnName[0]}" = i."rmsExternalId" OR cte."${cteColumnName[0]}" = i."id"::TEXT) )
            AND i."propertyId" = '${propertyId}'`,
      )
      .transacting(innerTrx)
      .catch(error => {
        innerTrx.rollback();
        throw error;
      });
  };

  const result = await (!trx ? runInTransaction(executeQuery) : executeQuery(trx));

  return result.rows || [];
};

const getRMSInventoryLeaseTerms = enhancedUnitsPricing =>
  enhancedUnitsPricing.reduce((acc, unit) => {
    let leaseTermsByUnit = [];
    if (unit.type === DALTypes.InventoryType.UNIT) {
      leaseTermsByUnit = Object.keys(unit.rentMatrix).map(termLength => [unit.inventoryId, termLength, unit.pricingType, unit.fileName, unit.propertyId]);
    }
    return acc.concat(leaseTermsByUnit);
  }, []);

const getLeaseTermsMismatch = async (ctx, enhancedUnitsPricing) => {
  const leaseTermsByInventory = getRMSInventoryLeaseTerms(enhancedUnitsPricing);
  if (!leaseTermsByInventory.length) return leaseTermsByInventory;

  const { tenantId, trx } = ctx;

  const cteName = 'cte_rmsLeaseTerms';
  const cteColumnsNames = ['inventoryId', 'termLength', 'termState', 'propertyRmsExternalId'];
  const rmsLeaseTermsCteQuery = createCteFromArray(leaseTermsByInventory, cteName, cteColumnsNames);
  const orderByQuery = `ORDER BY "${cteColumnsNames[0]}" ASC, "${cteColumnsNames[1]}" ASC`;

  const result = await knex
    .raw(
      `${rmsLeaseTermsCteQuery}
      ${orderByQuery}
      ),
      "revaLeaseTerms" AS(
        SELECT
          DISTINCT i.id::text "inventoryId",
          lt."termLength"::text "termLength",
          lt.state::text "termState",
          p."rmsExternalId"
        FROM "${tenantId}"."${INVENTORY_TABLE_NAME}" i
        INNER JOIN "${tenantId}"."${INVENTORY_GROUP_TABLE_NAME}" ig ON  i."inventoryGroupId" = ig.id
        INNER JOIN "${tenantId}"."${LEASE_TERM_TABLE_NAME}" lt ON ig."leaseNameId" = lt."leaseNameId"
        INNER JOIN "${cteName}" cte ON i.id::text = cte."${cteColumnsNames[0]}"
        INNER JOIN "${tenantId}"."${PROPERTY_TABLE_NAME}" p ON p.id = i."propertyId"
        ${orderByQuery}
      )
      SELECT
        coalesce("${cteName}"."inventoryId", reva."inventoryId"::text) "inventory",
        string_agg(reva."termState", ',') "revaTermStates",
        string_agg("${cteName}"."termState", ',') "rmsTermStates",
        string_agg("${cteName}"."termLength", ',') "rmsTermLengths",
        string_agg(reva."termLength", ',') "revaTermLengths",
        coalesce(reva."rmsExternalId"::text, "${cteName}"."propertyRmsExternalId") "propertyRmsExternalId"
      FROM "revaLeaseTerms" reva
      FULL OUTER JOIN "${cteName}" on "${cteName}"."inventoryId" = reva."inventoryId" and "${cteName}"."termLength" = reva."termLength" and ("${cteName}"."termState" = reva."termState" OR reva."termState" IS NULL)
      WHERE NOT EXISTS (
        SELECT 1 FROM "${cteName}" cte
        WHERE reva."inventoryId" = cte."${cteColumnsNames[0]}"
        AND reva."termLength" = cte."${cteColumnsNames[1]}"
        AND (reva."termState" = cte."${cteColumnsNames[2]}" OR reva."termState" IS NULL))
      GROUP BY "inventory", "propertyRmsExternalId", "rmsExternalId"`,
    )
    .transacting(trx)
    .catch(error => {
      trx.rollback();
      throw error;
    });

  return result.rows || [];
};

const filterMismatchesBy = (inventoriesMismatches, objectKey) =>
  inventoriesMismatches.reduce((acc, m) => {
    if (!m[objectKey]) return acc;

    acc.push(pick(m, ['externalId', 'propertyRmsExternalId', objectKey]));
    return acc;
  }, []);

const getLeaseMismatchesDetails = (leaseTermsMismatchesGroupedByInventoryKeys, leaseTermsMismatchesGroupedByInventory, enhancedUnitsPricing) =>
  leaseTermsMismatchesGroupedByInventoryKeys.reduce(
    (leaseMismatchDetails, key) => {
      const inventoryId = key;
      const mismatches = leaseTermsMismatchesGroupedByInventory[key];

      const mismatch = mismatches.reduce((acc, current) => mergeWith({}, acc, current, (a, b) => (b === null ? a : undefined)), {});

      const { revaTermStates, revaTermLengths, rmsTermStates, rmsTermLengths } = mismatch;
      if (!revaTermStates || !rmsTermStates) return leaseMismatchDetails;

      const revaTermStatesArray = revaTermStates.split(',');
      const revaTermLengthsArray = revaTermLengths.split(',');

      const { externalId } = enhancedUnitsPricing.find(x => x.inventoryId === inventoryId);

      const hasRenewalPrice = enhancedUnitsPricing.some(x => x.inventoryId === inventoryId && x.pricingType === DALTypes.LeaseState.RENEWAL);
      const hasNewPrice = enhancedUnitsPricing.some(x => x.inventoryId === inventoryId && x.pricingType === DALTypes.LeaseState.NEW);

      const mismatchingRevaTerms = revaTermStatesArray.reduce((acc, state, index) => {
        if ((!hasNewPrice && state === DALTypes.LeaseState.NEW) || (!hasRenewalPrice && state === DALTypes.LeaseState.RENEWAL)) {
          return acc;
        }

        acc.push({ length: revaTermLengthsArray[index], state });

        return acc;
      }, []);

      const rmsTermStatesArray = rmsTermStates.split(',');
      const mismatchingRmsTerms = rmsTermLengths.split(',').map((rmstl, index) => ({ length: rmstl, state: rmsTermStatesArray[index] }));

      leaseMismatchDetails.inventoriesMismatches.push({
        externalId,
        propertyRmsExternalId: mismatch.propertyRmsExternalId,
        mismatchingRevaTerms: mismatchingRevaTerms.map(x => JSON.stringify(x)),
        mismatchingRmsTerms: mismatchingRmsTerms.map(x => JSON.stringify(x)),
      });

      return leaseMismatchDetails;
    },
    { fileName: enhancedUnitsPricing[0].fileName, inventoriesMismatches: [] },
  );

const logLeaseTermMismatches = async (ctx, enhancedUnitsPricing) => {
  const leaseTermsMismatch = await getLeaseTermsMismatch(ctx, enhancedUnitsPricing);
  if (!leaseTermsMismatch.length) return;

  const leaseTermsMismatchesGroupedByInventory = groupBy(leaseTermsMismatch, ({ inventory }) => inventory);
  const leaseTermsMismatchesGroupedByInventoryKeys = Object.keys(leaseTermsMismatchesGroupedByInventory);

  const leaseMismatchesDetails = getLeaseMismatchesDetails(
    leaseTermsMismatchesGroupedByInventoryKeys,
    leaseTermsMismatchesGroupedByInventory,
    enhancedUnitsPricing,
  );

  const { fileName } = leaseMismatchesDetails;
  const shouldAlertMismatchingRevaTerms = false; // This will become a setting
  const inventoriesMismatches = !shouldAlertMismatchingRevaTerms
    ? filterMismatchesBy(leaseMismatchesDetails.inventoriesMismatches, 'mismatchingRmsTerms')
    : leaseMismatchesDetails.inventoriesMismatches;

  inventoriesMismatches.length && logger.error({ ctx, fileName, inventoriesMismatches }, 'Lease Terms mismatches between RMS and Reva');

  if (!shouldAlertMismatchingRevaTerms) {
    const revaInventoriesMismatches = filterMismatchesBy(leaseMismatchesDetails.inventoriesMismatches, 'mismatchingRevaTerms');
    revaInventoriesMismatches.length && logger.warn({ ctx, fileName, inventoriesMismatches: revaInventoriesMismatches }, 'Reva Lease Terms mismatches');
  }
};

const addInventoryDataToUnitsPricing = async (ctx, { unitsPricing, propertyId, propertyName, propertyRmsExternalId, pricingSetting }) => {
  const externalIds = unitsPricing.map(unit => unit.externalId);
  const inventories = await getInventoriesByExternalIds(ctx, externalIds, propertyId);

  const errors = [];

  const enhancedUnitsPricing = unitsPricing.reduce((acc, unitPricing) => {
    const { externalId } = unitPricing;
    const inventory = inventories.find(u => u.rmsExternalId === externalId);
    if (!inventory) {
      const errMsg = `Inventory with RMS external id '${externalId}' does not exists`;
      logger.error({ ctx, rmsExternalId: externalId }, errMsg);
      errors.push({ messages: [errMsg], rmsErrorType: RmsImportError.INVENTORY_NOT_FOUND_IN_DB_ERROR });
      return acc;
    }

    acc.push({
      ...unitPricing,
      inventoryId: inventory.id,
      state: inventory.state,
      fullQualifiedName: `${propertyName}-${inventory.buildingName}-${inventory.name}`,
      propertyRmsExternalId,
      propertyId,
      type: inventory.type,
      pricingType: unitPricing.renewalDate ? DALTypes.LeaseState.RENEWAL : DALTypes.LeaseState.NEW,
    });
    return acc;
  }, []);

  pricingSetting && (await logLeaseTermMismatches(ctx, enhancedUnitsPricing));

  return { enhancedUnitsPricing, errors };
};

export const deleteRmsPricingByPropertyId = async ({ tenantId, trx }, propertyId) =>
  await await knex
    .raw(
      ` DELETE FROM "${tenantId}"."${RMS_PRICING_TABLE_NAME}" rms
      USING "${tenantId}"."Inventory" i
      WHERE rms."inventoryId" = i.id AND i."propertyId"='${propertyId}'`,
    )
    .transacting(trx)
    .catch(error => {
      trx.rollback();
      throw error;
    });

export const saveUnitsPricing = async (ctx, { unitsPricing, propertyId, propertyName, propertyRmsExternalId, pricingSetting, rmsPricingEvent }) =>
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };

    if (!unitsPricing || !unitsPricing.length) return [];

    const { enhancedUnitsPricing, errors } = await addInventoryDataToUnitsPricing(innerCtx, {
      unitsPricing,
      propertyId,
      propertyName,
      propertyRmsExternalId,
      pricingSetting,
    });
    if (!enhancedUnitsPricing.length) return [];

    await deleteAndInsertUnitsPricing(innerCtx, { propertyId, unitsPricing: enhancedUnitsPricing, pricingSetting, rmsPricingEvent });

    return errors;
  });

export const getPricingSetting = (ctx, { propertyId, settings }) => {
  if (!hasOwnProp(settings?.integration?.import || {}, 'unitPricing')) {
    logger.error({ ctx, propertyId }, 'Pricing Setting is empty');
    throw new Error(`Pricing Setting is empty for property: ${propertyId}`);
  }

  const { unitPricing } = settings?.integration?.import || {};

  if (!isBoolean(unitPricing)) {
    logger.error({ ctx, propertyId, unitPricing }, 'Pricing Setting is not recognized');
    throw new Error(`Pricing Setting is not recognized for property: ${propertyId}`);
  }
  return unitPricing;
};

export const saveUnitsPricingUsingPropertyId = async (ctx, { unitsPricing, propertyId, rmsPricingEvent }) => {
  const { id, name: propertyName, settings, rmsExternalId: propertyRmsExternalId } = (await getPropertyById(ctx, propertyId)) || {};
  if (!id) {
    const errMsg = `Property with Property Id '${propertyId}' does not exists`;
    logger.error({ ctx, propertyId }, errMsg);
    throwCustomError(RmsImportError.PROPERTY_NOT_FOUND_IN_DB_ERROR, [errMsg]);
  }

  const pricingSetting = getPricingSetting(ctx, { propertyId, settings });
  return await saveUnitsPricing(ctx, {
    unitsPricing,
    propertyId: id,
    propertyName,
    propertyRmsExternalId,
    pricingSetting,
    rmsPricingEvent,
  });
};

export const saveUnitsPricingUsingPropertyExternalId = async (ctx, { unitsPricing, propertyExternalId, rmsPricingEvent }) => {
  const { id, name: propertyName, settings, rmsExternalId: propertyRmsExternalId } = (await getPropertyByRmsExternalId(ctx, propertyExternalId)) || {};
  if (!id) {
    const errMsg = `Property with RMS external Id '${propertyExternalId}' does not exists`;
    logger.error({ ctx, rmsExternalId: propertyExternalId }, errMsg);
    throwCustomError(RmsImportError.PROPERTY_NOT_FOUND_IN_DB_ERROR, [errMsg]);
  }

  const pricingSetting = getPricingSetting(ctx, { propertyId: propertyExternalId, settings });
  return await saveUnitsPricing(ctx, {
    unitsPricing,
    propertyId: id,
    propertyName,
    propertyRmsExternalId,
    pricingSetting,
    rmsPricingEvent,
  });
};

export const getUnitsPricingByPropertyId = async (ctx, propertyId) =>
  await knex
    .withSchema(ctx.tenantId)
    .from(RMS_PRICING_TABLE_NAME)
    .innerJoin('Inventory', `${RMS_PRICING_TABLE_NAME}.inventoryId`, 'Inventory.id')
    .where('Inventory.propertyId', propertyId);

export const getRMSPricingByInventoryId = async (ctx, inventoryId, pricingType) => await getOneWhere(ctx, 'RmsPricing', { inventoryId, pricingType });

// eslint-disable-next-line
export const getRenewalRentMatrixQuery = (ctx, { quoteId, inventoryId, partyId }) => {
  const query = quoteId
    ? `
      SELECT r."rentMatrix", q."leaseStartDate", q."publishedQuoteData"->'rentMatrix' as "frozenRentMatrix"
      FROM db_namespace."Quote" q
      LEFT JOIN db_namespace."RmsPricing" r ON r."inventoryId" = q."inventoryId" AND r."renewalDate" IS NOT NULL
      WHERE q.id = :quoteId
    `
    : `
      SELECT 
         r."rentMatrix",  
        (SELECT "leaseData"->>'leaseEndDate' FROM db_namespace."ActiveLeaseWorkflowData" a  
         INNER JOIN db_namespace."Party" p on a."partyId" = p."seedPartyId" 
         where p."id" = :partyId) "activeLeaseEndDate"
      FROM db_namespace."RmsPricing" r
      WHERE r."inventoryId" = :inventoryId AND r."renewalDate" IS NOT NULL
    `;

  const rawQuery = knex.raw(prepareRawQuery(query, ctx.tenantId), {
    quoteId,
    inventoryId,
    partyId,
  });

  return ctx.trx ? rawQuery.transacting(ctx.trx) : rawQuery;
};

export const getRMSPricingByInventoryIds = async (ctx, inventoryIds, pricingType) => {
  const typeCondition = pricingType ? 'AND "pricingType" = :pricingType' : '';
  const query = `
    SELECT *
    FROM db_namespace."RmsPricing"
      WHERE "inventoryId" = ANY(:inventoryIds)
      ${typeCondition}
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      inventoryIds: `{${inventoryIds.join(',')}}`,
      pricingType,
    },
  ]);
  return rows || [];
};

export const getMinAndMaxRentForAllAvailableInventories = async (ctx, propertyIds, inventoryType, withMarketingLayout = true) => {
  const condition1 = propertyIds ? 'AND ARRAY[rms."propertyId"] <@ :propertyIds' : '';
  const condition2 = withMarketingLayout ? 'AND ml.inactive = false' : '';
  const groupByClause = propertyIds ? 'GROUP BY rms."propertyId"' : '';
  const selectPropertyId = propertyIds ? 'rms."propertyId", ' : '';

  const query = `SELECT ${selectPropertyId} min(rms."minRent") AS min, max(rms."standardRent") AS max
  FROM db_namespace."RmsPricing" rms
  INNER JOIN db_namespace."Inventory" i on i.id=rms."inventoryId"
  INNER JOIN db_namespace."Layout" l on l.id=i."layoutId"
  INNER JOIN db_namespace."MarketingLayout" ml on ml.id=l."marketingLayoutId"
  WHERE rms."renewalDate" IS NULL
  AND l.inactive = false
  AND rms.type = '${inventoryType}'
  ${condition1}
  ${condition2}
  ${groupByClause}
  `;
  const { rows } = await rawStatement(ctx, query, [
    {
      propertyIds,
    },
  ]);
  return rows;
};

export const getPricingForInventory = async (ctx, inventoryId) => {
  const query = `
    SELECT "rentMatrix"
    FROM db_namespace."RmsPricing"
      WHERE "inventoryId" = :inventoryId
      AND "renewalDate" IS NULL
      AND type = :unitType
      AND status = any( :states::text[])
  `;
  const { rows } = await rawStatement(ctx, query, [
    {
      inventoryId,
      unitType: DALTypes.InventoryType.UNIT,
      states: [DALTypes.InventoryState.VACANT_READY, DALTypes.InventoryState.VACANT_MAKE_READY, DALTypes.InventoryState.OCCUPIED_NOTICE],
    },
  ]);
  return rows[0];
};
