/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import stringify from 'json-stringify-safe';
import { isString } from '../../common/helpers/type-of';
import { initQuery, rawStatement } from '../database/factory';

export const savePublicApiRequestTracking = async (ctx, part) => {
  const { partyId, documentVersion, payload, urlPath, checksum, sessionId } = part;
  const { rows = [] } = await rawStatement(
    ctx,
    `
    INSERT INTO db_namespace."PublicApiRequestTracking"
      ("id", "partyId", "documentVersion", "sessionId", "payload", "urlPath", "checksum")
    VALUES ("public".gen_random_uuid(), :partyId, :documentVersion, :sessionId, :payload, :urlPath, :checksum)
    RETURNING *;
    `,
    [
      {
        partyId,
        documentVersion,
        sessionId,
        payload: isString(payload) ? payload : stringify(payload),
        urlPath,
        checksum,
      },
    ],
  );

  return rows[0];
};

export const getPublicApiRequestTrackingByPartyId = async (ctx, partyId) => {
  const query = 'SELECT * FROM db_namespace."PublicApiRequestTracking" WHERE "partyId" = :partyId';
  const { rows = [] } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getPublicApiRequestCountByChecksum = async (ctx, partyId, checksum, opts) => {
  const minAgeFilter = opts?.minAgeFilter ? `AND created_at >= NOW() - INTERVAL '${opts.minAgeFilter}'` : '';
  const urlFilter = opts?.urlFilter ? 'AND "urlPath" = :urlPath' : '';
  const sessionIdFilter = opts?.sessionIdFilter ? 'AND "sessionId" = :sessionId' : '';

  const query = `
    SELECT COUNT(*) FROM db_namespace."PublicApiRequestTracking"
    WHERE
    "partyId" = :partyId AND checksum = :checksum
    ${minAgeFilter}
    ${urlFilter}
    ${sessionIdFilter};
    `;

  const { rows = [] } = await rawStatement(ctx, query, [{ partyId, checksum, urlPath: opts?.urlFilter, sessionId: opts?.sessionIdFilter }]);

  return parseInt(rows[0].count ?? 0, 10);
};

export const updatePublicApiRequestTrackingById = async (ctx, id, delta) => {
  const [updatedPART] = await initQuery(ctx).from('PublicApiRequestTracking').where({ id }).update(delta).returning('*');
  return updatedPART;
};

export const cleanupPublicApiRequestTracking = async (ctx, daysToKeep) => {
  const query = 'SELECT db_namespace.cleanuppublicapirequesttracking(:daysToKeep);';
  await rawStatement(ctx, query, [{ daysToKeep }]);
};
