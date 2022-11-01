/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from '../../common/helpers/nullish';
import { formatName } from '../../common/inventory-helper';
import { getFeesByPropertyId, getAdditionalOneTimeFeesByPeriod } from '../dal/feeRepo';
import { getInventoryById } from '../dal/inventoryRepo';
import { HoldDepositApplicationSettingsValues } from '../../common/enums/applicationTypes';

/**
 * Get the fee list using a generic reduce
 *
 * @param {Array} fees - A fee
 * @param {Object} opts - Options which will be used in this method.
 *        {Function} opts.fn - function will be executed to get the feeItem by fee type.
 * @param {Object} args - Arguments which could be used in the get feeItem
 * @return {Array} Output is fee with the base attributes and new ones which are using in the front-end.
 * */
const getTransformedFeeItems = (fees, opts = {}, transformFnArgs) =>
  fees.reduce((acc, fee) => {
    acc.push(opts.transformFn(fee, transformFnArgs));
    return acc;
  }, []);

/**
 * Get a fee item with its attributes.
 *
 * @param {Object} fee - A fee
 * @return {Object} Output is fee with the base attributes and new ones which are using in the front-end.
 * */
const getFeeForRentappChargesFrontend = (fee, inventoryName) => ({
  selected: true, // TODO: By the default, the selected is true. There is no property for this in the "Fee" sheet.
  isRequired: true, // TODO: By the default, the isRequired is true. There is no property for this in the "Fee" sheet.
  inventoryName,
  amount: parseFloat(fee.absolutePrice), // TODO: For now, this is returning the absolutePrice. This will be changed once the fee structure is defined in another user story.
  ...fee,
});

/**
 * Get the fee with the attributes.
 *
 * @param {Object} fee - A fee
 * @param {string} unitInfo - This is a compounded parameter to get this format: [Inventory name], [Building], [Property]
 *  e.g  1010, 350 Arballo, Parkmerced Apartments
 * @return {Object} Output is fee with the base attributes and new ones which are using in the front-end,
 * and the diplay name has a format to be shown.
 * */
const getHoldDepositFeeForRentappChargesFrontend = (fee, args) => {
  const { unitInfo, inventory, isHoldDepositRequired } = args;

  return {
    ...getFeeForRentappChargesFrontend(fee, inventory.name),
    unitInfo,
    isRequired: isHoldDepositRequired,
    holdDurationInHours: 72, // TODO: In the client, the hold duration will be added to support multiple languages using t('VALID_FOR', { period: 72 })
  };
};

/**
 * Get the fee list where the type is 'application'
 *
 * @param {Array} fees - Fee list
 * @return {Array} Output is the application fee list
 * */
const getApplicationFees = (fees, inventory = {}) =>
  getTransformedFeeItems(
    fees.filter(fee => fee.feeType === 'application'),
    { transformFn: getFeeForRentappChargesFrontend },
    inventory.name,
  );

/**
 * Get the fee list where the type is 'holdDeposit'
 *
 * @param {Array} fees - Fee list
 * @param {Object} inventory - inventory
 * @param {Object} unitInfo - Unit info e.g Hold deposit (1010, 350 Arballo, Parkmerced Apartments - Valid for 72 hours)
 * @return {Array} Output is the holdDeposit fee list
 * */
const getHoldDepositFees = (fees, inventory = {}, unitInfo, isHoldDepositRequired) =>
  getTransformedFeeItems(
    fees.filter(fee => fee.feeType === 'holdDeposit'),
    { transformFn: getHoldDepositFeeForRentappChargesFrontend },
    { inventory, unitInfo, isHoldDepositRequired },
  );

/**
 * Get the fee list where the type are application and holdDeposit
 *
 * @param {Array} fees - Fee list
 * @param {Object} inventory - inventory
 * @param {boolean} hasQuote - has quote
 * @return {Array} Output is the fee list by fee type. For now, it is returning fees where the fee type are application and holdDeposit
 * */

const getApplicationFeesByFeeType = async (tenantId, inventory, hasQuote, memberTypeSettings) => {
  const { propertyId } = inventory;
  const ctx = { tenantId };
  const fees = await getFeesByPropertyId(ctx, propertyId);
  const holdDepositSetting = hasQuote ? memberTypeSettings.holdDeposit : memberTypeSettings.holdDepositWithoutUnit;
  const shouldReturnHoldDeposit = holdDepositSetting !== HoldDepositApplicationSettingsValues.HIDDEN;
  const isHoldDepositRequired = holdDepositSetting === HoldDepositApplicationSettingsValues.REQUIRED_BY_FIRST_RESIDENT_APPLICANT;

  if (!shouldReturnHoldDeposit) return getApplicationFees(fees, inventory);

  const unitInfo = (hasQuote && formatName(inventory)) || '';

  return [...getApplicationFees(fees, inventory), ...getHoldDepositFees(fees, inventory, unitInfo, isHoldDepositRequired)];
};

/**
 * Get the fees list using the Inventory info
 *
 * @param {string} tenantId - Tenant schema
 * @param {Object} inventoryId - Inventory id
 * @param {boolean} hasQuote - has quote
 * @return {Array} Output is the fee list by fee type. For now, it is returning the fees
 * where the fee type are application and holdDeposit
 * */
const getFeesUsingInventoryInfo = async (tenantId, inventoryId, hasQuote, memberTypeSettings) => {
  const inventory = await getInventoryById(
    { tenantId },
    {
      id: inventoryId,
      expand: true,
    },
  );
  if (!inventory) return [];

  return await getApplicationFeesByFeeType(tenantId, inventory, hasQuote, memberTypeSettings);
};

/**
 * Get the fees list for property
 *
 * @param {string} tenantId - Tenant schema
 * @param {Object} propertyFilter - Filters which will be used in this method.
 *        {string} propertyFilter.propertyId - Property id
 *        {string} propertyFilter.inventoryId - Inventory id
 *        {boolean} propertyFilter.hasQuote - has a quote
 * @return {Array} Output is the fee list by fee type. For now, it is returning the fees
 * where the fee type are application and holdDeposit
 * */
export const getApplicationFeesForProperty = async (tenantId, { propertyId, inventoryId, hasQuote }, memberTypeSettings = {}) => {
  if (inventoryId) {
    return await getFeesUsingInventoryInfo(tenantId, inventoryId, hasQuote, memberTypeSettings);
  }

  return await getApplicationFeesByFeeType(tenantId, { propertyId }, hasQuote, memberTypeSettings);
};

export const getAndFormatAdditionalAndOneTimeChargesByperiod = async (
  ctx,
  { additionalCharges, inventoryId, leaseTerms, propertyTimezone, isRenewalQuote },
) => {
  const AdditionalOneTimeFeesByPeriod = await getAdditionalOneTimeFeesByPeriod(ctx, {
    inventoryId,
    leaseTerms,
    propertyTimezone,
    isRenewalQuote,
  });

  if (!additionalCharges) return AdditionalOneTimeFeesByPeriod;

  const additionalChargesHash =
    additionalCharges.reduce((acc, charge) => {
      acc[charge.id] = charge.amount;
      return acc;
    }, {}) || {};

  return AdditionalOneTimeFeesByPeriod.map(feesByPeriod => {
    feesByPeriod.fees = feesByPeriod.fees.map(item => {
      const quoteAdditionalCharge = additionalChargesHash[item.id];
      if (!nullish(quoteAdditionalCharge)) {
        item.amount = quoteAdditionalCharge;
      }
      return item;
    });
    return feesByPeriod;
  });
};
