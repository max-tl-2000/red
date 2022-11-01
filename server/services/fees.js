/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as feeRepo from '../dal/feeRepo';
import { validateIfElementsExist } from '../helpers/importUtils.js';

export const INVALID_FEES = 'INVALID_FEES_ASSOCIATED';

export const validateFees = async (ctx, entityObj, feesStr, feesColName, propertyFees) => {
  const storedFees = propertyFees || (await feeRepo.getFeesByPropertyId(ctx, entityObj.propertyId));
  const validateObj = {
    elementsStr: feesStr,
    storedElements: storedFees,
    columnName: feesColName,
    errorMessage: INVALID_FEES,
  };

  return await validateIfElementsExist(validateObj);
};

export const getAdditionalOneTimeFeesByPeriod = (ctx, { inventoryId, leaseTerms, propertyTimezone, useDbLeaseTerms, isRenewalQuote = false } = {}) =>
  feeRepo.getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId, leaseTerms, propertyTimezone, useDbLeaseTerms, isRenewalQuote });

export const getFeeById = (ctx, feeId) => feeRepo.getFeeById(ctx, feeId);

export const getValidFeesByName = (ctx, name) => feeRepo.getValidFeesByName(ctx, name);

export const getFeesByFilter = (ctx, filterFunc) => feeRepo.getFeesByFilter(ctx, filterFunc);
