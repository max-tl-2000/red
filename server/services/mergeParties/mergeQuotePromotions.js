/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import * as mergeRepo from '../../dal/mergePartyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const mergeQuotePromotions = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergeQuotePromotions - params');
  const start = new Date().getTime();

  const basePartyPromotions = await mergeRepo.getQuotePromotions(ctx, basePartyId);
  const mergedPartyPromotions = await mergeRepo.getQuotePromotions(ctx, mergedPartyId);
  const basePartyHasActivePromotion = basePartyPromotions.find(p => p.promotionStatus !== DALTypes.PromotionStatus.CANCELED);

  const result = await Promise.reduce(
    mergedPartyPromotions || [],
    async (updatedPromotions, promotion) => {
      const delta = basePartyHasActivePromotion
        ? {
            id: promotion.id,
            partyId: basePartyId,
            promotionStatus: DALTypes.PromotionStatus.CANCELED,
          }
        : { id: promotion.id, partyId: basePartyId };

      const updatedPromotion = await mergeRepo.updatePromotion(ctx, delta);
      return [...updatedPromotions, updatedPromotion];
    },
    [],
  );

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeQuotePromotions - duration');
  return result;
};
