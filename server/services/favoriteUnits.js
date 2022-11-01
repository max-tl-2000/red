/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadPartyById, updatePartyMetadata } from '../dal/partyRepo';
import logger from '../../common/helpers/logger';

export const markUnitsAsFavorite = async (ctx, partyId, toMarkAsFavorite) => {
  logger.trace({ ctx, partyId, toMarkAsFavorite }, 'markUnitAsFavorite');
  const party = await loadPartyById(ctx, partyId);
  const { favoriteUnits = [] } = party.metadata || {};
  const newFavorites = toMarkAsFavorite.filter(unitId => !favoriteUnits.includes(unitId));
  const metadata = {
    ...(party.metadata || {}),
    favoriteUnits: [...favoriteUnits, ...newFavorites],
  };

  await updatePartyMetadata(ctx, partyId, metadata);
};
