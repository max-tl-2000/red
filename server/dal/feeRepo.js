/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sortBy, intersectionWith, isEqual, uniqBy } from 'lodash'; // eslint-disable-line red/no-lodash
import { mapSeries } from 'bluebird';
import { knex, initQuery, insertOrUpdate, runInTransaction, getOne, rawStatement, bulkUpsert } from '../database/factory';
import { getPriceByPeriod } from '../../common/helpers/utils';
import { getInventoryGroups } from './inventoryGroupRepo';
import { getLeaseTerms } from './leaseTermRepo';
import { getAllConcessions } from './concessionRepo';
import { getInventoryGroupAmenityPrices } from './amenityRepo';
import { getInventoriesByIds } from './inventoryRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { setConcessionsAssociatedToFees } from '../services/concessions';
import { getInventoryItems } from '../services/inventories';
import { LA_TIMEZONE } from '../../common/date-constants';
import { calculateFeeRelativePrice } from '../../common/helpers/quotes';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { getOnlyDepositAndRelativeFeeWithInventoryGroupParentErrorMsg, doesFeeHaveParent } from './helpers/fees';
import { setDefaultVariableAmount, getPriceUsingFloorCeiling } from '../../common/helpers/fee';

const Errors = require('../common/errors');

export const saveFee = (ctx, fee) => insertOrUpdate(ctx.tenantId, 'Fee', fee);

export const getValidFeesByName = async (ctx, name) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT id, name
      FROM db_namespace."Fee"
      WHERE name = :name
    `,
    [{ name }],
  );

  return rows;
};

export const getValidFeesByNameAndPropertyId = async (ctx, feesArray, propertyId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT id, name
      FROM db_namespace."Fee"
      WHERE ARRAY[name] <@ :feesArray
      AND "propertyId" = :propertyId
    `,
    [{ feesArray, propertyId }],
  );

  return rows;
};

export const upsertAssociatedFees = async (ctx, fee, associatedFees) => {
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    await initQuery(innerCtx).from('Associated_Fee').where('primaryFee', fee.id).delete();
    for (let i = 0; i < associatedFees.length; i++) {
      await initQuery(innerCtx).insert(associatedFees[i]).into('Associated_Fee');
    }
  }, ctx);
};

export const deleteAssociatedFeesByFeeIds = async (ctx, feeIds) => {
  if (!feeIds?.length) return null;
  const query = `
     DELETE FROM db_namespace."Associated_Fee"
     WHERE "primaryFee" IN (${feeIds.map(id => `'${id}'`)})
    `;

  return await rawStatement(ctx, query);
};

export const bulkUpsertFeesFromImport = async (ctx, fees) => await bulkUpsert(ctx, 'Fee', fees);
export const bulkUpsertAssociatedFeesFromImport = async (ctx, associatedFees) => await bulkUpsert(ctx, 'Associated_Fee', associatedFees);

// The name of this function could suggest that it returns associated fees, but
// it only returns a promise with the contents of the intermediate table.
// It's not intended to be resolved directly, since it will return the whole
// table. Please use it as a base query, see getParentFeesFromAssociatedFees.
// TODO: check why this function is used as a query builder and an
// actual executable query
// eslint-disable-next-line
const getAssociatedFees = ctx =>
  initQuery(ctx)
    .from('Associated_Fee')
    .select('primaryFee', 'associatedFee', 'isAdditional');

export const getParentFeesFromAssociatedFees = (ctx, parentFees) => getAssociatedFees(ctx).whereIn('associatedFee', parentFees);

export const getFeesByPropertyId = async (ctx, propertyId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT *
      FROM db_namespace."Fee"
      WHERE "propertyId" = :propertyId
    `,
    [{ propertyId }],
  );

  return rows;
};

export const applyFeeToConcession = (ctx, concessionFee) => insertOrUpdate(ctx.tenantId, 'Concession_Fee', concessionFee);

export const getFeeById = async (ctx, feeId) => await getOne(ctx, 'Fee', feeId);

// eslint-disable-next-line
export const getFeesByFilter = (ctx, filterFunc) => filterFunc(initQuery(ctx).from('Fee'));

const getRenewalFeeQuery = `AND (fee."leaseState" = '${DALTypes.FeeLeaseState.RENEWAL}' OR fee."leaseState" IS NULL)`;

const getNewFeeQuery = `AND (fee."leaseState" = '${DALTypes.FeeLeaseState.NEW}' OR fee."leaseState" IS NULL)`;

const getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState = async (ctx, inventoryId, isRenewalQuote) => {
  const condition = isRenewalQuote ? getRenewalFeeQuery : getNewFeeQuery;

  const query = `
    SELECT af."associatedFee" as id, af."isAdditional", childFee."leaseState"
    FROM db_namespace."Associated_Fee" af
      INNER JOIN db_namespace."Fee" childFee ON childFee.id = af."associatedFee"
      INNER JOIN db_namespace."Fee" fee ON fee.id = af."primaryFee"
      INNER JOIN db_namespace."InventoryGroup" ig ON ig."feeId" = fee.id
      INNER JOIN db_namespace."Inventory" inv ON inv."inventoryGroupId" = ig.id
    WHERE inv.id = :inventoryId
      ${condition}
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);
  return rows;
};

export const getFilteredFeesByLeaseState = async (ctx, propertyId, isRenewalQuote) => {
  const condition = isRenewalQuote ? getRenewalFeeQuery : getNewFeeQuery;

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT fee.id, fee.name, fee."displayName", fee."feeType", fee."quoteSectionName", fee."maxQuantityInQuote", fee."servicePeriod",
        fee."variableAdjustment", fee.estimated, fee."relativePrice", fee."absolutePrice", fee."relativeDefaultPrice", fee."absoluteDefaultPrice",
        fee."priceFloorCeiling", fee."propertyId", fee."marketingQuestionId", fee."quotePaymentScheduleFlag", fee."renewalLetterDisplayFlag", fee."leaseState"
      FROM db_namespace."Fee" fee
      WHERE fee."propertyId" = :propertyId
        ${condition}
    `,
    [{ propertyId }],
  );

  return rows;
};

// here we filter the children fees by leaseState
const getFilteredAssociatedFeesByLeaseState = async (ctx, propertyId, isRenewalQuote) => {
  const condition = isRenewalQuote ? getRenewalFeeQuery : getNewFeeQuery;

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT af."primaryFee", af."associatedFee", af."isAdditional", fee."leaseState"
      FROM db_namespace."Associated_Fee" af
        INNER JOIN db_namespace."Fee" fee ON fee.id = af."associatedFee"
      WHERE fee."propertyId" = :propertyId
        ${condition}
    `,
    [{ propertyId }],
  );

  return rows;
};

const getEnhancedFees = (allFees, feesDetected) =>
  feesDetected.map(fee => {
    const feeDescrp = allFees.find(f => f.id === fee.originalId);
    return { ...feeDescrp, ...fee };
  });

/* returns true if all leaseTerms are in leaseTermsToCompare */
const validateSuperSet = (initialLeaseTerms, leaseTermsComparing) => {
  const result = intersectionWith(initialLeaseTerms, leaseTermsComparing, isEqual);
  return result.length === initialLeaseTerms.length;
};

const findLeaseTermByLeaseNameId = (allLeaseTerms, leaseNameId) =>
  allLeaseTerms.reduce((result, leaseTerm) => {
    if (leaseTerm.leaseNameId === leaseNameId) {
      const { termLength, period, adjustedMarketRent, id } = leaseTerm;
      result.push({ termLength, period, adjustedMarketRent, id });
    }
    return result;
  }, []);

const orderFees = fees => {
  const additionalFees = sortBy(
    fees.filter(fee => fee.isAdditional),
    'displayName',
  );
  const relativeFees = sortBy(
    fees.filter(fee => !fee.isAdditional),
    'displayName',
  );
  return relativeFees.concat(additionalFees);
};

const getPricePlusAmenities = (allPrices, actualPrice, inventoryGroupId) => {
  const sumRelativePrice = allPrices.filter(p => p.inventoryGroupId === inventoryGroupId).reduce((result, p) => result + parseFloat(p.relativePrice), 0);
  const sumAbsolutePrice = allPrices.filter(p => p.inventoryGroupId === inventoryGroupId).reduce((result, p) => result + parseFloat(p.absolutePrice), 0);
  return parseFloat(actualPrice) + (actualPrice * sumRelativePrice) / 100 + sumAbsolutePrice;
};

const getMinAndMaxRentForFee = async (ctx, fee) =>
  await initQuery(ctx)
    .from('InventoryGroup')
    .select('InventoryGroup.id')
    .min('RmsPricing.standardRent as minRent')
    .max('RmsPricing.standardRent as maxRent')
    .innerJoin('Inventory', 'InventoryGroup.id', 'Inventory.inventoryGroupId')
    .innerJoin('RmsPricing', 'Inventory.id', 'RmsPricing.inventoryId')
    .where('InventoryGroup.feeId', fee.originalId)
    .groupBy('InventoryGroup.id');

// get all nested fees for each period, example for Aparment we can get Pet Large and its deposit for month, but for week we can get Pet Small and its deposit
const getFirstFeesAndDescendants = async (
  ctx,
  firstChildrenFees,
  initialLeaseTerms,
  allFees,
  allLeaseTerms,
  allInventoryGroups,
  allAssociatedFees,
  allPriceAmenities,
  allInventories,
  period,
) => {
  let fees = [];

  do {
    firstChildrenFees = getEnhancedFees(allFees, firstChildrenFees);
    await execConcurrent(
      firstChildrenFees.filter(f => f.quoteSectionName),
      // eslint-disable-next-line no-loop-func
      async fee => {
        if (fee.feeType === 'inventoryGroup') {
          const feeFromIG = allInventoryGroups.filter(ig => ig.feeId === fee.originalId);
          const validatedFees = [];

          const minAndMaxRentForFee = await getMinAndMaxRentForFee(ctx, fee);

          feeFromIG.forEach(ig => {
            const actualLeaseTermSet = ig.leaseNameId && findLeaseTermByLeaseNameId(allLeaseTerms, ig.leaseNameId);
            const isSuperSet = actualLeaseTermSet && validateSuperSet(initialLeaseTerms, actualLeaseTermSet);
            const inventories = allInventories.filter(inv => inv.inventoryGroupId === ig.id);
            const hasParentInventory = inventories.length && inventories.every(inv => inv.parentInventory);
            const parentFeeAmount = getPriceByPeriod(ig, period);
            let price = calculateFeeRelativePrice(fee, parentFeeAmount, true);

            if (fee.priceFloorCeiling) {
              price = getPriceUsingFloorCeiling({
                floorCeilingFlag: fee.priceFloorCeiling,
                absolutePrice: fee.absolutePrice,
                priceRelativeToParent: price,
              });
            }

            let minRent = null;
            let maxRent = null;
            minAndMaxRentForFee.forEach(f => {
              if (f.id === ig.id) {
                minRent = f.minRent;
                maxRent = f.maxRent;
              }
            });

            if (!hasParentInventory && price && (isSuperSet || !actualLeaseTermSet)) {
              price = getPricePlusAmenities(allPriceAmenities, price, ig.id);
              const feeParent = fees.find(f => f.children && f.children.some(c => c === fee.id));
              const parentFeeDisplayName = feeParent && feeParent.displayName;
              const hasInventoryPool = inventories.length && !!inventories[0].multipleItemTotal;
              validatedFees.push({
                id: `${ig.id}--${fee.id}`,
                displayName: ig.displayName,
                leaseNameId: ig.leaseNameId,
                quoteSectionName: fee.quoteSectionName,
                price,
                amount: price,
                hasRelativePrice: !!fee.relativePrice,
                parentFeeAmount,
                firstFee: fee.firstFee,
                isAdditional: fee.isAdditional,
                visible: !!fee.firstFee,
                selected: !!fee.firstFee && fee.isAdditional,
                maxQuantityInQuote: fee.maxQuantityInQuote,
                parentFeeDisplayName,
                quantity: 1,
                relativeDefaultPrice: fee.relativeDefaultPrice,
                absoluteDefaultPrice: fee.absoluteDefaultPrice,
                initialFeeId: fee.originalId,
                inventoryGroupId: ig.id,
                hasInventoryPool,
                minRent,
                maxRent,
                selectedInventories: [],
                priceFloorCeiling: fee.priceFloorCeiling,
                marketingQuestionId: fee.marketingQuestionId,
                quotePaymentScheduleFlag: fee.quotePaymentScheduleFlag,
                renewalLetterDisplayFlag: fee.renewalLetterDisplayFlag,
              });
            }
          });

          if (validatedFees.length) {
            const feeWithChild = fees.find(f => f.children && f.children.some(c => c === fee.id));
            if (feeWithChild) {
              // replacing with inventory groups instead fees
              const children = feeWithChild.children.filter(c => c !== fee.id).concat(validatedFees.map(f => f.id));
              fees = fees.map(f => {
                if (f.id === feeWithChild.id) {
                  f = { ...f, children };
                }
                return f;
              });
            }
            // add inventory groups to the fees arrays
            fees.push(...validatedFees);
          } else {
            delete fee.children;
            firstChildrenFees = firstChildrenFees.filter(f => f.originalId !== fee.originalId);
          }
        } else {
          const isValidPeriod = fee.servicePeriod === period || !fee.servicePeriod || fee.servicePeriod === 'oneTime';
          let leaseTerms;
          let parentFeeAmount;
          let hasAnIGParent = false;

          if (fee.feeType === DALTypes.FeeType.DEPOSIT) {
            if (fee.firstFee) {
              leaseTerms = initialLeaseTerms;
            } else {
              const parentFeeIG = fees.find(f => f.initialFeeId && f.children && f.children.some(c => c === fee.id));
              if (parentFeeIG) {
                // parent fee is feeType  == IG
                const parentLeaseTermsIG = findLeaseTermByLeaseNameId(allLeaseTerms, parentFeeIG.leaseNameId);
                if (parentLeaseTermsIG.length > 0) {
                  // IG with inventoryType = unit, so it has leaseTerms
                  leaseTerms = parentLeaseTermsIG;
                  hasAnIGParent = true;
                } else {
                  // IG with inventoryType != unit doesn't have leaseterms (simplification for Pilot)
                  parentFeeAmount = parentFeeIG.amount;
                }
              } else {
                // parent fee is feetype != IG
                const parentFeeNoIG = fees.find(f => f.children && f.children.some(c => c === fee.id));
                parentFeeAmount = parentFeeNoIG.amount;
              }
            }
          } else {
            const parentFeeIG = fees.find(f => f.initialFeeId && f.children && f.children.some(c => c === fee.id));
            if (parentFeeIG && fee.relativePrice) {
              throw new Error(getOnlyDepositAndRelativeFeeWithInventoryGroupParentErrorMsg(fee.displayName));
            }

            const parentFeeNoIG = fees.find(f => f.children && f.children.some(c => c === fee.id));
            parentFeeAmount = (parentFeeNoIG || {}).amount;
          }

          if (isValidPeriod) {
            if (fee.relativePrice && !fee.firstFee && !doesFeeHaveParent(fee.id, fees)) {
              throw new Errors.FeeRelativePriceError(fee.displayName);
            }

            const feeRelativePrice = calculateFeeRelativePrice(fee, parentFeeAmount);
            let price = hasAnIGParent ? fee.absolutePrice : feeRelativePrice;
            if (fee.priceFloorCeiling) {
              price = getPriceUsingFloorCeiling({
                floorCeilingFlag: fee.priceFloorCeiling,
                absolutePrice: fee.absolutePrice,
                priceRelativeToParent: feeRelativePrice,
              });
            }

            fees.push({
              ...fee,
              parentFeeAmount,
              price,
              amount: price,
              visible: !!fee.firstFee,
              selected: !!fee.firstFee && fee.isAdditional,
              leaseTerms,
              quantity: 1,
            });
          } else {
            // deleting fee because is not necessary
            firstChildrenFees = firstChildrenFees.filter(f => f.id !== fee.id);
          }
        }
        return fee;
      },
    );

    firstChildrenFees = firstChildrenFees.reduce((result, fee) => { // eslint-disable-line
      const children = allAssociatedFees.filter(f => f.primaryFee === fee.originalId);
      const _children = [];
      if (children.length) {
        // insert children to the parent
        fees = fees.map((f, index) => {
          const feeId = f.initialFeeId || f.originalId;
          if (feeId === fee.originalId) {
            f.children = children.map(c => `${c.associatedFee}--${f.id}>>${index}`);
            children.forEach(c => {
              _children.push({
                id: `${c.associatedFee}--${f.id}>>${index}`,
                originalId: c.associatedFee,
                isAdditional: c.isAdditional,
                parentFeeDisplayName: f.displayName,
              });
            });
          }
          return f;
        });
        result.push(..._children);
      }
      return result;
    }, []);
  } while (firstChildrenFees.length);
  fees = uniqBy(fees, 'id');
  fees = orderFees(fees);
  return fees;
};

const excludeFeesByLeaseState = (fee, leaseState) => fee.leaseState !== leaseState;
/* This object is created to be able to mock getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState function, other options like using
 * getters/setters or proxyquire are more complicated, because they require more code and helper files.
 */
export const feeRepoUtils = { getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState };

// TODO: remove the LA_TIMEZONE was added to prevent integration tests from breaking
export const getAdditionalOneTimeFeesByPeriod = async (
  ctx,
  { inventoryId, leaseTerms, propertyTimezone, useDbLeaseTerms = true, isRenewalQuote = false } = {},
) => {
  if (!useDbLeaseTerms && !leaseTerms.length) {
    return {};
  }
  propertyTimezone = propertyTimezone || LA_TIMEZONE;
  leaseTerms = leaseTerms.length
    ? leaseTerms.map(l => ({
        id: l.id,
        termLength: l.termLength,
        period: l.period,
        adjustedMarketRent: l.adjustedMarketRent,
      }))
    : null;
  // get all the first fees (single structure), example for Apartment we can get Parking indoor but not EV Fee(second nested structure) or EV Fee Deposit(third nested structure).
  const firstChildrenFees = (await feeRepoUtils.getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState(ctx, inventoryId, isRenewalQuote))
    .filter(fee => (isRenewalQuote ? excludeFeesByLeaseState(fee, DALTypes.FeeLeaseState.NEW) : excludeFeesByLeaseState(fee, DALTypes.FeeLeaseState.RENEWAL)))
    .map(fee => ({
      ...fee,
      originalId: fee.id,
      firstFee: true,
    }));

  const { propertyId } = (await getInventoriesByIds(ctx, [inventoryId]))[0];
  const allFees = await getFilteredFeesByLeaseState(ctx, propertyId, isRenewalQuote);
  const allAssociatedFees = await getFilteredAssociatedFeesByLeaseState(ctx, propertyId, isRenewalQuote);
  const allInventoryGroups = await getInventoryGroups(ctx);
  const allLeaseTerms = useDbLeaseTerms ? await getLeaseTerms(ctx) : leaseTerms;
  const allPriceAmenities = await getInventoryGroupAmenityPrices(ctx);
  const allInventories = await getInventoryItems(ctx);
  const allConcessions = await getAllConcessions(ctx);
  // we use filter on allAssociatedFees to filter all the fees that have as parent a specific leaseState
  const resultPeriodsWithFees = mapSeries(Object.keys(DALTypes.LeasePeriod), async period => {
    const name = period.toLowerCase();
    let fees = await getFirstFeesAndDescendants(
      ctx,
      firstChildrenFees,
      leaseTerms,
      allFees,
      allLeaseTerms,
      allInventoryGroups,
      allAssociatedFees.filter(fee =>
        isRenewalQuote ? excludeFeesByLeaseState(fee, DALTypes.FeeLeaseState.NEW) : excludeFeesByLeaseState(fee, DALTypes.FeeLeaseState.RENEWAL),
      ),
      allPriceAmenities,
      allInventories,
      name,
    );
    fees = await setConcessionsAssociatedToFees(ctx, { allConcessions, period: name, inventoryId, fees, propertyTimezone });

    fees = fees.map(fee => {
      setDefaultVariableAmount(fee, fee.amount);
      return fee;
    });
    return { name, fees };
  });
  return resultPeriodsWithFees;
};

export const getFeesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const { tenantId } = ctx;
  const simpleFieldsToSelect = simpleFields.map(field => `Fee.${field}`);
  const foreignKeysToSelect = ['Property.name as property', ' MarketingQuestions.name as marketingQuestionName'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .select(
      knex.raw(
        `ARRAY(select f.name
              from :tenantId:."Associated_Fee"
              inner join :tenantId:."Fee" as f on "Associated_Fee"."associatedFee" = f.id
              where "Associated_Fee"."isAdditional" = true and "Fee".id = "Associated_Fee"."primaryFee"
        ) as "additionalFees"`,
        {
          tenantId,
        },
      ),
    )
    .select(
      knex.raw(
        `ARRAY(select f.name
              from :tenantId:."Associated_Fee"
              inner join :tenantId:."Fee" as f on "Associated_Fee"."associatedFee" = f.id
              where "Associated_Fee"."isAdditional" = false and "Fee".id = "Associated_Fee"."primaryFee"
          ) as "relatedFees"`,
        {
          tenantId,
        },
      ),
    )
    .from('Fee')
    .innerJoin('Property', 'Fee.propertyId', 'Property.id')
    .leftJoin('MarketingQuestions', 'Fee.marketingQuestionId', 'MarketingQuestions.id')
    .whereIn('Property.id', propertyIdsToExport);
};

export const getFeesAdditionalDataByIds = async (ctx, feeIds) => {
  const formattedFeeIds = feeIds.map(id => id.split('--')[1] || id);

  const { rows } = await rawStatement(
    ctx,
    `SELECT fee.id, fee.description, fee."externalChargeCode", fee."feeType", fee."servicePeriod"
      FROM db_namespace."Fee" fee
      WHERE ARRAY[fee.id] <@ :feeIds
    `,
    [{ feeIds: formattedFeeIds }],
  );

  return rows;
};
