/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../common/helpers/logger';
import { getMinAndMaxBakedFeesAdjustments } from '../../../common/helpers/quotes';

const getManuallyAdjustedRents = (leaseTermId, quoteSelections = {}) => {
  const leaseTerm = (quoteSelections?.selectedLeaseTerms || []).find(selectedLeaseTerm => selectedLeaseTerm.id === leaseTermId);

  return leaseTerm && leaseTerm.originalBaseRent && leaseTerm.overwrittenBaseRent
    ? {
        originalBaseRent: leaseTerm.originalBaseRent,
        overwrittenBaseRent: leaseTerm.overwrittenBaseRent,
      }
    : undefined;
};

export const calculateLeaseTermAdjustments = (ctx, leaseTerm, marketRent, quoteSelections) => {
  const {
    minBakedFeesAdjustment,
    maxBakedFeesAdjustment,
    minFeeAdjustmentIncluded,
    maxFeeAdjustmentIncluded,
    adjustmentsNotIncluded,
    allowBaseRentAdjustment,
  } = getMinAndMaxBakedFeesAdjustments(leaseTerm.concessions, marketRent);

  const manuallyAdjustedRents = getManuallyAdjustedRents(leaseTerm.id, quoteSelections);

  if (allowBaseRentAdjustment) {
    logger.debug(
      {
        ctx,
        minFeeAdjustmentIncluded,
        maxFeeAdjustmentIncluded,
        adjustmentsNotIncluded,
      },
      'Variable BakedIntoAppliedFee adjustments',
    );
  }

  if (manuallyAdjustedRents) {
    return {
      adjustedMarketRent: Math.round(manuallyAdjustedRents.overwrittenBaseRent),
      overwrittenBaseRent: manuallyAdjustedRents.overwrittenBaseRent,
      originalBaseRent: Math.round(manuallyAdjustedRents.originalBaseRent),
      allowBaseRentAdjustment,
      minBakedFeesAdjustment,
      maxBakedFeesAdjustment,
    };
  }

  const adjustedMarketRent = Math.round(marketRent);

  return {
    adjustedMarketRent,
    overwrittenBaseRent: 0,
    originalBaseRent: adjustedMarketRent,
    allowBaseRentAdjustment,
    minBakedFeesAdjustment,
    maxBakedFeesAdjustment,
  };
};

export const getRentableItemIdsFromLease = publishedLease => {
  if (!publishedLease) return [];
  const selectedInventoriesIndex = 1;
  return Object.entries(publishedLease.additionalCharges).reduce((acc, charge) => {
    const additionalCharges = charge[selectedInventoriesIndex];
    if (additionalCharges.selectedInventories) {
      additionalCharges.selectedInventories.forEach(rentableItem => {
        acc.push(rentableItem.id);
      });
    }
    return acc;
  }, []);
};
