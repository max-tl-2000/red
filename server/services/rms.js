/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { getInventoryById } from '../dal/inventoryRepo';
import { calculateLeaseTermAdjustments } from './helpers/leaseTerms';
import { getLeaseTermsByInventoryId } from '../dal/leaseTermRepo';
import { getRMSPricingByInventoryId } from '../dal/rmsPricingRepo';
import { updateLeaseTermsWithConcessions, updateLeaseTermsWithSpecial } from './leaseTerms';
import logger from '../../common/helpers/logger';

export const shouldUseRmsPricing = propertySettings => get(propertySettings, 'integration.import.unitPricing', false) === true;

export const addAdjustmentsToRentMatrix = (ctx, leaseTerms, quoteSelections, rentMatrix, inventoryId) => {
  logger.trace(
    {
      ctx,
      leaseTerms: leaseTerms?.map(leaseTerm => leaseTerm.id).join(', '),
      quoteSelectedLeaseTerms: quoteSelections?.selectedLeaseTerms?.map(selectedLeaseTerm => selectedLeaseTerm.id).join(', '),
      inventoryId,
    },
    'addAdjustmentsToRentMatrix',
  );

  leaseTerms.forEach(leaseTerm => {
    const matrixLeaseTerm = rentMatrix[leaseTerm.termLength];

    Object.keys(matrixLeaseTerm || {}).forEach(startDate => {
      const marketRent = parseFloat(matrixLeaseTerm[startDate].rent);
      matrixLeaseTerm[startDate] = {
        ...matrixLeaseTerm[startDate],
        ...calculateLeaseTermAdjustments(ctx, leaseTerm, marketRent, quoteSelections),
      };
    });

    rentMatrix[leaseTerm.termLength] = matrixLeaseTerm;
  });

  return rentMatrix;
};

export const getRMSPricingWithAdjustments = async (ctx, quote) => {
  logger.trace({ ctx, quoteId: quote?.id, inventoryId: quote?.inventoryId }, 'getRMSPricingWithAdjustments');

  const { inventoryId, selections, leaseState, created_at } = quote;
  const rmsPricing = await getRMSPricingByInventoryId(ctx, inventoryId, leaseState);
  let leaseTerms = await getLeaseTermsByInventoryId(ctx, inventoryId, leaseState);
  leaseTerms = await updateLeaseTermsWithConcessions(ctx, { leaseTerms, inventoryId, createdAt: created_at, leaseState });
  leaseTerms = updateLeaseTermsWithSpecial(ctx, leaseTerms);

  const rentMatrixWithAdjustments =
    rmsPricing && rmsPricing.rentMatrix && addAdjustmentsToRentMatrix(ctx, leaseTerms, selections || {}, rmsPricing.rentMatrix, inventoryId);
  logger.trace({ ctx, rmsPricingId: rmsPricing?.id }, 'rentMatrixWasAdjusted');

  const rmsPricingAdjustments = rentMatrixWithAdjustments && { ...rmsPricing, rentMatrix: rentMatrixWithAdjustments };
  return rmsPricingAdjustments;
};

export const isInventoryPriceUnavailable = async (ctx, inventoryId) => {
  logger.trace({ ctx, inventoryId }, 'isInventoryPriceUnavailable');
  const inventory = await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });
  const inventoryPriceUnavailable = !inventory || (!inventory.marketRent && !inventory.renewalMarketRent);
  logger.trace({ ctx, inventoryId, inventoryPriceUnavailable }, 'isInventoryPriceUnavailable');
  return inventoryPriceUnavailable;
};
