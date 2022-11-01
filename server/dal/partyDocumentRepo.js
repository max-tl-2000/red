/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, initQuery, runInTransaction, rawStatement, update, insertInto } from '../database/factory';
import { prepareRawQuery } from '../common/schemaConstants';
import { DALTypes } from '../../common/enums/DALTypes';
import logger from '../../common/helpers/logger';

const { NotificationChannel } = DALTypes;

export const getPartyDocumentByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPartyDocumentByPartyId');
  const doc = await initQuery(ctx).from('PartyDocumentHistory').where({ partyId }).orderBy('created_at', 'desc').first();

  return doc;
};

export const getPartyDocumentIdsByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPartyDocumentIdsByPartyId');
  const ids = await initQuery(ctx).from('PartyDocumentHistory').columns('id').where({ partyId }).orderBy('created_at', 'asc');

  return ids;
};

export const getPartyDocumentById = async (ctx, documentId) => {
  logger.trace({ ctx, documentId }, 'getPartyDocumentById');

  const { rows } = await knex.raw(
    prepareRawQuery(
      `SELECT pdh.* from db_namespace."PartyDocumentHistory" pdh
       WHERE pdh."id" = :id`,
      ctx.tenantId,
    ),
    {
      id: documentId,
    },
  );
  return rows[0];
};

export const acquireDocument = async (ctx, id) => {
  logger.trace({ ctx, id }, 'acquireDocument');
  return await runInTransaction(async trx => {
    const { rows } = await knex
      .raw(
        prepareRawQuery(
          `UPDATE db_namespace."PartyDocumentHistory" pdh
           SET status = :new_status,
               acquired_at = now()
           WHERE pdh."id" = (
              SELECT p."id"
              FROM db_namespace."PartyDocumentHistory" p
              WHERE p.id = :id
              AND p."status" = :status
              FOR UPDATE SKIP LOCKED
              LIMIT 1
           )
           RETURNING *;`,
          ctx.tenantId,
        ),
        {
          id,
          status: DALTypes.PartyDocumentStatus.PENDING,
          new_status: DALTypes.PartyDocumentStatus.SENDING,
        },
      )
      .transacting(trx);

    const acquired = rows[0];

    logger.trace({ ctx, id, acquired: !!acquired }, 'acquireDocument - completed');
    return acquired;
  }, ctx);
};

export const markAsCompleted = async (ctx, id, responses) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `UPDATE db_namespace."PartyDocumentHistory"
       SET (status, completed_at, "deliveryStatus") = (:new_status, now(), :responses)
       WHERE "id" = :id
       AND "status" = :status
       RETURNING *`,
      ctx.tenantId,
    ),
    { id, status: DALTypes.PartyDocumentStatus.SENDING, new_status: DALTypes.PartyDocumentStatus.SENT, responses: JSON.stringify(responses) },
  );

  return rows[0];
};

export const markAsNoMatchingSubscriptions = async (ctx, id, responses) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `UPDATE db_namespace."PartyDocumentHistory"
       SET (status, "deliveryStatus") = (:new_status, :responses)
       WHERE "id" = :id
       AND "status" = :status
       RETURNING *`,
      ctx.tenantId,
    ),
    {
      id,
      status: DALTypes.PartyDocumentStatus.SENDING,
      new_status: DALTypes.PartyDocumentStatus.NO_MATCHING_SUBSCRIPTIONS,
      responses: JSON.stringify(responses),
    },
  );

  return rows[0];
};

export const markAsFailed = async (ctx, id, responses) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `UPDATE db_namespace."PartyDocumentHistory"
       SET (status, "deliveryStatus") = (:new_status, :responses)
       WHERE "id" = :id
       AND "status" = :status
       RETURNING *`,
      ctx.tenantId,
    ),
    { id, status: DALTypes.PartyDocumentStatus.SENDING, new_status: DALTypes.PartyDocumentStatus.FAILED, responses: JSON.stringify(responses) },
  );

  return rows[0];
};

export const sendPendingVersions = async ctx => {
  logger.trace({ ctx }, 'sendPendingVersions');
  await knex.raw(
    prepareRawQuery(
      `
      DO $$
      DECLARE party_document_id record;
      BEGIN
          FOR party_document_id IN (SELECT id FROM db_namespace."PartyDocumentHistory" WHERE status='${DALTypes.PartyDocumentStatus.PENDING}' order by transaction_id asc)
             LOOP
              PERFORM pg_notify(
                 '${NotificationChannel.PARTY_UPDATED}',
                 json_build_object(
                   'tenantId', replace('${ctx.tenantId}', '"', ''),
                   'table', 'PartyDocumentHistory',
                   'type', 'insert',
                   'id', party_document_id.id
                 )::text
               );
             END LOOP;
      END$$;
      `,
      ctx.tenantId,
    ),
  );
};

export const cleanupPartyDocuments = async (ctx, batchSize, versionsToKeep, daysToKeep) => {
  logger.trace({ ctx, batchSize, versionsToKeep, daysToKeep }, 'cleanupPartyDocuments');

  await knex.raw(
    prepareRawQuery(
      `
      SELECT db_namespace.cleanuppartydocumenthistory(:batchSize, :versionsToKeep, :daysToKeep);
      `,
      ctx.tenantId,
    ),
    { batchSize, versionsToKeep, daysToKeep },
  );
};

export const getUnprocessedDocuments = async (ctx, options) => {
  const { minTime, maxTime, timeFrame = 'hours', includeDocument } = options || {};
  const { PartyDocumentStatus } = DALTypes;
  const timeInterval =
    minTime && maxTime ? `AND created_at < NOW() - INTERVAL '${minTime} ${timeFrame}' AND created_at > NOW() - INTERVAL '${maxTime} ${timeFrame}'` : '';
  const query = `SELECT
      id,
      "partyId",
      transaction_id,
      triggered_by,
      status,
      acquired_at,
      created_at,
      updated_at,
      "deliveryStatus"
      ${includeDocument ? ', document' : ''}
    FROM db_namespace."PartyDocumentHistory"
    WHERE (status = :pending OR status = :sending)
    ${timeInterval}
    ORDER BY created_at DESC LIMIT 100;`;

  const { rows } = await rawStatement(ctx, query, [{ pending: PartyDocumentStatus.PENDING, sending: PartyDocumentStatus.SENDING }]);
  return rows;
};

export const createPartyDocumentHistory = async (ctx, documentHistory) => await insertInto(ctx, 'PartyDocumentHistory', documentHistory);

export const updatePartyDocumentHistory = async (ctx, id, documentHistory) => await update(ctx, 'PartyDocumentHistory', { id }, documentHistory);
