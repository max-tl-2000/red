/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as mergeRepo from '../../dal/mergePartyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const mergePartyApplicationDocuments = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergePartyApplicationDocuments - params');
  const start = new Date().getTime();

  const mergedPartyApplication = await mergeRepo.getPartyApplicationByPartyId(ctx, mergedPartyId);
  if (!mergedPartyApplication) return [];

  const mergedPartyApplicationDocuments = await mergeRepo.getPartyApplicationDocumentsByPartyApplicationId(ctx, mergedPartyApplication.id);
  if (!mergedPartyApplicationDocuments.length) return [];

  const partyDocumentIds = mergedPartyApplicationDocuments.map(d => d.id);
  const { id: partyApplicationId } = await mergeRepo.getPartyApplicationByPartyId(ctx, basePartyId);
  const result = await mergeRepo.updatePartyApplicationDocumentsBulk(ctx, partyDocumentIds, { partyApplicationId });

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePartyApplicationDocuments - duration');
  return result;
};
