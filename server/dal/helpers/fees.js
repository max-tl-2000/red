/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { trimAndSplitByComma } from '../../../common/regex';

export const doesFeeFromSheetHaveParent = (feeName, fees, propertyName) =>
  fees
    .filter(({ data: { property } }) => (propertyName || '').trim() === (property || '').trim())
    .some(fee => {
      const {
        data: { additionalFees, relatedFees },
      } = fee;
      const additionalFeesList = trimAndSplitByComma((additionalFees || '').toLowerCase());
      const relatedFeesList = trimAndSplitByComma((relatedFees || '').toLowerCase());
      return [...additionalFeesList, ...relatedFeesList].includes(feeName);
    });

export const doesFeeHaveParent = (feeId, fees) => fees.some(fee => (fee.children || []).includes(feeId));

export const getOnlyDepositAndRelativeFeeWithInventoryGroupParentErrorMsg = (feeDisplayName, relativePropName) =>
  `For a fee with ${relativePropName}, only fee of the type deposit can be dependent upon the fee of the type inventory group. ${feeDisplayName} is not a fee of the type deposit and it is dependent upon a fee that is of the type inventory group.`;

export const getRelativePriceFeeDependencyErrorMsg = feeName => `No dependency specified for ${feeName} fee with relative price`;
