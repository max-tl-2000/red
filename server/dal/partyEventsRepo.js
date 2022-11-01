/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, rawStatement } from '../database/factory';
import logger from '../../common/helpers/logger';

export const savePartyEvent = async (ctx, data) => {
  const { partyId, event, userId, partyMemberId, metadata, requestIds } = data;
  logger.trace({ ctx, partyId, event, userId, partyMemberId, requestIds }, 'savePartyEvent');

  const insertStatement = `INSERT INTO db_namespace."PartyEvents"
                           (id, "partyId", "event", "userId", "partyMemberId", metadata, "requestIds", transaction_id, created_at, updated_at)
                           VALUES("public".gen_random_uuid(),
                                  :partyId, :event, :userId, :partyMemberId, :metadata, :requestIds,
                                  txid_current(), now(), now())
                          ON CONFLICT ((metadata->>'communicationId'), "partyId", "event") WHERE (event IN ('communication_completed', 'communication_missed_call'))
                          DO
                      		  UPDATE
                      	    SET "metadata" = :metadata, "requestIds" = :requestIds, transaction_id = txid_current(), updated_at = now()
                          RETURNING *;`;

  const partyEvent = {
    partyId,
    event,
    userId: userId || null,
    partyMemberId: partyMemberId || null,
    metadata: metadata || {},
    requestIds: (requestIds || []).filter(reqId => reqId),
  };
  const { rows } = await rawStatement(ctx, insertStatement, [partyEvent]);
  return rows[0];
};

export const clearPartyEvents = async ctx => await initQuery(ctx).from('PartyEvents').del();

export const getEventsByParty = async (ctx, partyId) => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."PartyEvents" WHERE "partyId" = :partyId', [{ partyId }]);

  return rows;
};
