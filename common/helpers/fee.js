/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from './nullish';
import { convertToCamelCaseAndRemoveBrackets } from './strings';
import { DALTypes } from '../enums/DALTypes';
import { getFixedAmount } from './number';

export const getMaxAmount = fee => (fee.variableAdjustment ? fee.maxAmount : null);

const calculateFloorPrice = (absolutePrice, relativePrice) => (absolutePrice > relativePrice ? relativePrice : absolutePrice);

const calculateCeilingPrice = (absolutePrice, relativePrice) => (absolutePrice > relativePrice ? absolutePrice : relativePrice);

const priceFloorCeilingHandlerMapping = {
  [DALTypes.PriceFloorCeiling.CEILING]: calculateCeilingPrice,
  [DALTypes.PriceFloorCeiling.FLOOR]: calculateFloorPrice,
};

export const getPriceUsingFloorCeiling = ({ floorCeilingFlag, absolutePrice, relativePrice, parentFeeAmount = 0, priceRelativeToParent = null }) => {
  if (!floorCeilingFlag) return 0;
  const relativeAmount = (parseFloat(parentFeeAmount) * parseFloat(Math.abs(relativePrice))) / 100;
  const feeRelativePrice = priceRelativeToParent || relativeAmount;
  const priceFloorCeiling = priceFloorCeilingHandlerMapping[floorCeilingFlag](parseFloat(absolutePrice), parseFloat(feeRelativePrice));
  return getFixedAmount(priceFloorCeiling, 2);
};

export const updateFeeAmountToInventoryGroupFeeOrFeeAmount = fee => {
  const isIGFee = !!fee.minRent && !!fee.maxRent;
  fee.amount = isIGFee ? fee.minRent : fee.amount;
};

export const updateAdditionalChargesParentFee = (fee, term, parentValue) => {
  if (!fee.parentFeeAmount || fee.hadParentFee === false) {
    fee.hadParentFee = false;
    fee.parentFeeAmount = parentValue || term.adjustedMarketRent;
  }
};

export const setDefaultVariableAmount = (feeOrConcession, currentAmount, setAmount = true) => {
  updateFeeAmountToInventoryGroupFeeOrFeeAmount(feeOrConcession);
  const {
    variableAdjustment,
    priceFloorCeiling,
    relativeDefaultPrice,
    absoluteDefaultPrice,
    originalTotalAmount,
    parentFeeAmount,
    absolutePrice,
    relativePrice,
  } = feeOrConcession;
  const parsedCurrentAmount = parseFloat(currentAmount);
  if (!originalTotalAmount) {
    feeOrConcession.originalTotalAmount = parsedCurrentAmount;
  }
  let defaultAmount;
  let maxAmount;
  if (nullish(absolutePrice) && nullish(relativePrice)) {
    defaultAmount = 0;
  }
  const relativePriceValue = !nullish(relativePrice) && Math.abs(parseFloat(relativePrice));
  const absolutePriceValue = !nullish(absolutePrice) && parseFloat(absolutePrice);
  const amount = relativePriceValue && !nullish(parentFeeAmount) ? (parseFloat(parentFeeAmount) * relativePriceValue) / 100 : absolutePriceValue;
  maxAmount = amount;
  defaultAmount = amount;
  defaultAmount = defaultAmount > 0 ? defaultAmount : parsedCurrentAmount;

  if (priceFloorCeiling) {
    defaultAmount = getPriceUsingFloorCeiling({
      floorCeilingFlag: priceFloorCeiling,
      parentFeeAmount,
      absolutePrice,
      relativePrice,
    });
    maxAmount = defaultAmount;
  }

  if (variableAdjustment) {
    if (nullish(relativeDefaultPrice) && nullish(absoluteDefaultPrice)) {
      defaultAmount = 0;
    } else {
      const relativeDefaultPriceValue = !nullish(relativeDefaultPrice) && Math.abs(parseFloat(relativeDefaultPrice));
      const absoluteDefaultPriceValue = !nullish(absoluteDefaultPrice) && parseFloat(absoluteDefaultPrice);
      const amountVariableAdjustment =
        relativeDefaultPriceValue && !nullish(parentFeeAmount) ? (parseFloat(parentFeeAmount) * relativeDefaultPriceValue) / 100 : absoluteDefaultPriceValue;
      defaultAmount = amountVariableAdjustment > defaultAmount ? defaultAmount : amountVariableAdjustment;
      defaultAmount = defaultAmount > 0 ? defaultAmount : parsedCurrentAmount;
    }
  }
  const feeAmount = parseFloat(feeOrConcession.amount);
  const setAmountValue = Number.isNaN(feeAmount) || setAmount;
  feeOrConcession.amount = setAmountValue ? defaultAmount * feeOrConcession.quantity : feeOrConcession.amount;
  feeOrConcession.price = defaultAmount;
  feeOrConcession.variableAdjustmentAmount = setAmount ? defaultAmount : feeOrConcession.variableAdjustmentAmount;
  feeOrConcession.maxAmountPerItem = maxAmount;
  feeOrConcession.maxAmount = maxAmount * feeOrConcession.quantity;
  feeOrConcession.originalTotalAmount = defaultAmount * feeOrConcession.quantity;
  return defaultAmount;
};
export const getFeeDataId = (fee, feeGroupName, groupByName) =>
  convertToCamelCaseAndRemoveBrackets(`${fee.displayName}${feeGroupName === groupByName ? ` ${fee.parentFeeDisplayName || ''}` : ''}`);

export const getRelativeOrRelativeDefaultTextFromFee = fee => {
  const isRelativePrice = !!fee.relativePrice;
  return isRelativePrice ? 'relativePrice' : 'relativeDefaultPrice';
};
