/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import flattenDeep from 'lodash/flattenDeep';
import uniqBy from 'lodash/uniqBy';
import sortBy from 'lodash/sortBy';

import { getFeeById } from '../../services/fees';
import { getConcessionById } from '../../services/concessions';
import { getInventoryGroupById } from '../../dal/inventoryGroupRepo';
import { getInventoryItem } from '../../services/inventories';
import { getQuoteById } from '../../services/quotes';
import { getInventoriesByIds } from '../../dal/inventoryRepo';
import { getFixedAmount } from '../../../common/helpers/number';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });

/**
 * Retrieves the list of concessions from the lease baselineData.
 *
 * @param {Object} ctx
 * @param {Array} concessions The concessions as taken from the lease baselineData.
 * @param {*} isChargeConcessions True if these are concessions attached to charges in the baselineData.
 * E.g.: A concession that can apply to a specific charge. For example a concession to the pet rent.
 */
const getConcessions = async (ctx, concessions, isChargeConcessions) => {
  logger.trace({ ctx, concessions, isChargeConcessions }, 'getConcessions');

  const result = await mapSeries(Object.keys(concessions), async concessionId => {
    const concession = await getConcessionById(ctx, concessionId);
    const amount = isChargeConcessions ? concessions[concessionId] : concessions[concessionId].amount;
    const relativeAmount = getFixedAmount(concessions[concessionId].relativeAmount, 2) || concessions[concessionId].amountVariableAdjustment;
    const { recurring, recurringCount } = concession;
    return {
      externalChargeCode: concession.externalChargeCode,
      quantity: 1,
      amount,
      relativeAmount,
      recurring,
      recurringCount,
      feeName: concession.name,
      isConcession: true,
      nonRecurringAppliedAt: concession.nonRecurringAppliedAt,
    };
  });

  logger.trace({ ctx, getConcessionsResult: result }, 'getConcessions - result');

  return result;
};

/**
 *Checks if an inventory from the lease baselineData does not exists.
 * Initially introduced because of Property sheet wrong data.
 * @param {Object} ctx
 * @param {Array} { selectedInventories: inventories = [] } The selected inventories as they appear attached to a lease baselineData charge
 * (e.g.: specific garage inventories attached to a parking rent)
 * @returns False if the inventory exists. Otherwise throws an error.
 */
const isInventoryUnavailable = async (ctx, { selectedInventories: inventories = [] }) => {
  const inv = inventories[0];
  if (!inv) return true;

  const inventoryId = inv.id;
  const inventory = inventoryId && (await getInventoryItem(ctx, inventoryId));
  if (!inventory) throw new Error(`Check for nonexistent inventory ${inventoryId}`);
  return false; // see https://github.com/Redisrupt/red/pull/6590/files for discussion of why we're always returning false here
  // return inventory.state !== DALTypes.InventoryState.VACANT_READY;
};

/**
 *Gets data about the concessions attached to a specific charge in the lease baselineData.
 *
 * @param {Object} ctx
 * @param {Array} additionalCharges The additionalCharges section from the lease baselineData.
 */
const getChargeConcessions = async (ctx, charges) => {
  logger.trace({ ctx, charges }, 'getChargeConcessions');

  return await mapSeries(Object.keys(charges), chargeId => charges[chargeId].concessions)
    .filter(concessions => concessions)
    .map(async concessions => await getConcessions(ctx, concessions, true));
};

export const getAllConcessions = async (ctx, lease) => {
  logger.trace({ ctx, leaseId: lease.id }, 'getAllConcessions');

  const { oneTimeCharges, additionalCharges, concessions } = lease.baselineData.publishedLease;
  const concessionFees = await getConcessions(ctx, concessions);
  const additionalChargeConcessions = await getChargeConcessions(ctx, additionalCharges);
  const oneTimeChargeConcessions = await getChargeConcessions(ctx, oneTimeCharges);

  const result = flattenDeep([concessionFees, additionalChargeConcessions, oneTimeChargeConcessions]).filter(x => x);

  logger.trace({ ctx, concessions: result }, 'All exported concessions');
  return result;
};

/**
 *Retrieves data about and inventory based on IDs from the charge in the lease baseLineData.
 *
 * @param {Object} ctx
 * @param {Object} charge A charge from the lease baselineData.
 * @param {*} feeIdOrNull If this is not set then we mean we don't have any inventories for this charge.
 * @param {*} feeOrInventoryGroupId Depending on the charge ID, this might be a fee ID or inventory group ID.
 * @returns
 */
const getInventoryData = async (ctx, charge, feeIdOrNull, feeOrInventoryGroupId) => {
  logger.trace({ ctx, chargeId: charge?.id, feeIdOrNull, feeOrInventoryGroupId }, 'getInventoryData');

  if (!feeIdOrNull) return {};

  const inventoryGroup = await getInventoryGroupById(ctx, feeOrInventoryGroupId);
  let unavailableInventory;
  let inventories;

  if (inventoryGroup) {
    if (await isInventoryUnavailable(ctx, charge)) {
      unavailableInventory = true;
    } else {
      inventories = await getInventoriesByIds(
        ctx,
        charge.selectedInventories.map(item => item.id),
      );
    }
  }

  return { inventoryGroup, unavailableInventory, inventories };
};

/**
 *Throws an error if any of the inventories doesn't have an externalId and cannot be exported.
 *Initially added because of missing data in the property sheet.
 * @param {Object} ctx
 * @param {Array} inventories The inventories from a charge that has inventory items.
 */
const checkForMissingExternalId = (ctx, inventories) => {
  if (inventories && inventories.length) {
    logger.trace({ ctx, selectedInventories: inventories }, 'Selected inventories');
    const missingExternalId = inventories.filter(inv => !inv.externalId);
    if (missingExternalId.length) {
      const missing = inventories.map(inv => inv.id).join(', ');
      throw new Error(`Missing externalId for inventories: ${missing}`);
    }
  }
};

/**
 *Retrieves data about a charge from the lease baselineData.
 *
 * @param {*} ctx
 * @param {*} charge One charge from the lease baselineData (additionalCharges or oneTimeCharges section)
 * @param {*} chargeId The charge ID. This is a combination of fee or inventory group IDs.
 * The id is in the format feeId_or_inventoryGroupId[--feeId>>number]

  Examples:
    49fddb65-6812-49d8-b5bc-9d159aceee6e (feeId)
    49fddb65-6812-49d8-b5bc-9d159aceee6e--723798a8-5400-46a3-a50d-bb2770386099  (first is a feeId, second a feeId)
    b51d8c49-72c4-438d-a055-8a04f1a93a87--2a4e7364-f75d-4930-8c1c-87c040f8c9af>>2 (first is an inventoryGroup id, second a feeId, third is an index - starting from 1?!)
 * @returns
 */
const getFeeToExport = async (ctx, charge, chargeId) => {
  logger.trace({ ctx, chargeId }, 'getFeeToExport');

  const [id] = chargeId.split('>');
  const [feeOrInventoryGroupId, feeIdOrNull] = id.split('--').filter(x => x);

  let fee;

  const { inventoryGroup, unavailableInventory, inventories } = await getInventoryData(ctx, charge, feeIdOrNull, feeOrInventoryGroupId);

  if (!inventoryGroup && !unavailableInventory) {
    fee = await getFeeById(ctx, feeOrInventoryGroupId);
  } else if (inventoryGroup) {
    fee = await getFeeById(ctx, inventoryGroup.feeId);
  }

  if (fee && !fee.externalChargeCode) return [];

  checkForMissingExternalId(ctx, inventories);
  const items = [inventoryGroup, fee].filter(x => x);
  const igExternalId = inventoryGroup?.externalId;
  const igPrice = inventoryGroup?.basePriceMonthly || 0;
  // extract everything following the dash following the igName in the externalId
  const itemIdFromExternalId = externalId => {
    const regex = new RegExp(`${igExternalId}-(.*)`);
    const externalIdMatched = externalId.match(regex);
    if (externalIdMatched?.length > 1) return externalIdMatched[1];
    logger.error({ ctx, inventories, inventoryGroup, externalIdMatched }, 'itemIdFromExternalId - error');
    return '';
  };

  return items.map(item => ({
    externalId: item.externalId,
    externalChargeCode: item.externalChargeCode,
    quantity: charge.quantity || 1,
    amount: charge.amount,
    feeName: charge.name || (fee && fee.name),
    feeType: item.feeType,
    servicePeriod: charge.servicePeriod,
    inventories:
      inventories &&
      inventories.map(inventoryItem => ({
        itemType: igExternalId,
        itemId: itemIdFromExternalId(inventoryItem.externalId),
        itemRate: igPrice,
      })),
  }));
};

/**
 *Returns the fees and concessions to be exported and the necessary data.
 *
 * @param {Object} ctx
 * @param {Obhect} lease The published lease.
 * @returns {Array} All the fees and concessions from the lease baselineData.
 */
const getFees = async (ctx, lease) => {
  const { additionalCharges, oneTimeCharges } = lease.baselineData.publishedLease;

  logger.trace({ ctx, additionalCharges, oneTimeCharges }, 'All lease charges');

  const oneTimes = await mapSeries(Object.keys(oneTimeCharges), async chargeId => await getFeeToExport(ctx, oneTimeCharges[chargeId], chargeId));
  const additionals = await mapSeries(Object.keys(additionalCharges), async chargeId => await getFeeToExport(ctx, additionalCharges[chargeId], chargeId));
  const fees = oneTimes.concat(additionals);

  const feesToExport = flattenDeep(fees);
  logger.trace({ ctx, leaseCharges: feesToExport }, 'Exported lease charges');

  return feesToExport;
};

export const getFeesToExport = async (ctx, lease, concessions) => {
  const fees = await getFees(ctx, lease);
  const result = flattenDeep([fees, concessions]).filter(x => x);

  logger.trace({ ctx, feesToExports: result }, 'All selected items and fees to be exported');

  return result;
};

/**
 *Gets the charges that are available on the lease but were not selected.
 *These are sent with amount zero to MRI, to not let MRI put a default value instead.
 *
 * @param {*} ctx
 * @param {*} lease
 * @param {*} feesToExport The fees to be exported, as retrieved by the getFees function.
 * @returns All the unselected charges (which were available on the lease but were not selected).
 */
const getUnselectedCharges = async (ctx, lease, feesToExport) => {
  logger.trace({ ctx, leaseId: lease.id, feesToExport }, 'getUnselectedCharges');

  const { additionalAndOneTimeCharges } = await getQuoteById(ctx, lease.quoteId);
  const chargesFromQuote = uniqBy(flattenDeep(additionalAndOneTimeCharges.map(c => c.fees)), 'id');

  const allAvailableCharges = await mapSeries(chargesFromQuote, async charge => await getFeeToExport(ctx, charge, charge.id));

  const selectedCharges = feesToExport.map(r => r.feeName).filter(x => x);
  const isChargeSelected = charge => charge && !selectedCharges.includes(charge.feeName);

  const flattened = uniqBy(flattenDeep(allAvailableCharges), 'externalChargeCode');

  const result = flattened.filter(isChargeSelected).map(charge => ({ ...charge, amount: 0 }));
  logger.trace({ ctx, leaseId: lease.id, unselectedChargesResult: result }, 'getUnselectedCharges - result');

  return result;
};

export /**
 *Retrieves the list of all the available/exportable charges (fees, concessions)
 *
 * @param {*} ctx
 * @param {*} lease
 * @param {*} selectedFeesToExport The selected fees to be exported, as retrieved by the getFees function.
 * @returns
 */
const getAllAvailableCharges = async (ctx, lease, selectedFeesToExport) => {
  const unselectedCharges = await getUnselectedCharges(ctx, lease, selectedFeesToExport);

  const result = sortBy([...selectedFeesToExport, ...unselectedCharges], ['feeName', 'feeType']);
  logger.trace({ ctx, allAvailableCharges: result }, 'All available charges to be exported with ConfirmLease.');

  return result;
};
