/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as mergeRepo from '../../dal/mergePartyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const mergePersonApplicationDocuments = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergePersonApplicationDocuments - params');
  const start = new Date().getTime();

  const mergedPersonApplicationDocuments = await mergeRepo.getPersonApplicationDocumentsByPartyId(ctx, mergedPartyId);
  if (!mergedPersonApplicationDocuments.length) return [];

  const personApplicationDocumentIds = mergedPersonApplicationDocuments.map(d => d.id);
  const { id: personApplicationId } = (await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId))[0];
  const result = await mergeRepo.updatePersonApplicationDocumentsWithNewApplication(ctx, personApplicationDocumentIds, personApplicationId);

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePersonApplicationDocuments - duration');
  return result;
};
