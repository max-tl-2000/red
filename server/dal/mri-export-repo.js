/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subtype: 'mri-export-repo' });

export const getMRIExportStats = async (ctx, responseMatch, interval = '24 hours') => {
  const query = `
    SELECT
      mt."partyId",
      count(mt.*)::integer AS "responsesMatched"
    FROM db_namespace."MRIExportTracking" mt
    WHERE
      mt.response like :responseMatch AND
      mt.created_at > NOW() - INTERVAL '${interval}'
    GROUP BY mt."partyId"
    ORDER BY mt."partyId" ASC
  `;
  const { rows } = await rawStatement(ctx, query, [{ responseMatch: `%${responseMatch}%` }]);
  return rows;
};

export const saveMriExportQueueMessage = async (ctx, data) => {
  const { partyId, exportData } = data;
  logger.trace({ ctx, partyId }, 'saveMriExportQueueMessage');
  const { rows } = await rawStatement(
    ctx,
    `
        INSERT INTO db_namespace."MRIExportQueue"
          ("id", "partyId", "exportData")
        VALUES ("public".gen_random_uuid(), :partyId, :exportData)
        RETURNING *;
        `,
    [
      {
        partyId,
        exportData: JSON.stringify(exportData),
      },
    ],
  );

  return rows[0];
};

export const deleteMriExportQueueMessageById = async (ctx, messageId) => {
  logger.trace({ ctx, messageId }, 'deleteMriExportQueueMessageById');
  const query = `
    DELETE FROM db_namespace."MRIExportQueue"
    WHERE id = :messageId;
  `;

  await rawStatement(ctx, query, [{ messageId }]);
};

export const getOldestExportMessageByPartyId = async (ctx, partyId, messageId = null) => {
  logger.trace({ ctx, partyId }, 'getOldestExportMessageByPartyId');
  const messageIdFilter = messageId ? 'AND id != :messageId' : '';

  const query = `
    SELECT * FROM db_namespace."MRIExportQueue"
    WHERE "partyId" = :partyId
    ${messageIdFilter}
    ORDER BY created_at ASC
    LIMIT 1;
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, messageId }]);
  return rows[0];
};

export const updateMRIExportQueueMessageById = async (ctx, id, delta) => {
  logger.trace({ ctx, id, delta }, 'updateMRIExportQueueMessageById');
  const [message] = await initQuery(ctx).from('MRIExportQueue').where({ id }).update(delta).returning('*');
  return message;
};

export const lockMriExportQueueTable = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'lockMriExportQueueTable');
  await rawStatement(ctx, 'SELECT * FROM db_namespace."MRIExportQueue" WHERE "partyId" = :partyId FOR UPDATE;', [{ partyId }]);
};

export const getPartiesWithQueuedExportMessages = async (ctx, { partyIdsFilter }) => {
  logger.trace({ ctx, partyIdsFilter }, 'getPartiesWithQueuedExportMessages');

  const partyFilter = partyIdsFilter ? 'WHERE "partyId" = ANY(:partyIdsFilter)' : '';

  const query = `
    SELECT DISTINCT "partyId"
    FROM db_namespace."MRIExportQueue"
    ${partyFilter}
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyIdsFilter }]);
  return rows.map(row => row.partyId);
};
