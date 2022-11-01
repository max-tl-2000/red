/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadParty, updateParty } from '../dal/partyRepo';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { logEntity } from './activityLogService';
import { ServiceError } from '../common/errors';
import { savePartyScoreChangedEvent } from './partyEvent';
import { runInTransaction } from '../database/factory';

const logPartyScoreUpdated = async (ctx, party) =>
  await logEntity(ctx, {
    entity: {
      id: party.id,
      score: party.score,
    },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.PARTY,
  });

export const updateScoreForParty = async (outerCtx, partyId, score) => {
  const party = await loadParty(outerCtx, partyId);
  if (!party) {
    throw new ServiceError({ token: 'PARTY_NOT_FOUND', status: 404, data: { partyId } });
  }

  if (party.score !== score) {
    await runInTransaction(async trx => {
      const ctx = { trx, ...outerCtx };
      const updated = await updateParty(ctx, { id: partyId, score });
      await logPartyScoreUpdated(ctx, updated);
      await savePartyScoreChangedEvent(ctx, { partyId, metadata: { previousScore: party.score, newScore: score } });
    }, outerCtx);
  }
};
