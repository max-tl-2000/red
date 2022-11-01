/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, rawStatement, runInTransaction, insertInto } from '../database/factory';

export const createPublicDocument = async (ctx, publicDocument, { shouldCreatePhysicalPublicDocument, checksum } = {}) =>
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };

    const physicalPublicDocument =
      shouldCreatePhysicalPublicDocument && (await insertInto(innerCtx, 'PhysicalPublicDocument', { id: publicDocument.physicalPublicDocumentId, checksum }));

    const [createdPublicDocument] = await initQuery(innerCtx)
      .insert({
        ...publicDocument,
        physicalPublicDocumentId: publicDocument.physicalPublicDocumentId || physicalPublicDocument.id,
      })
      .into('PublicDocument')
      .returning('*');

    return createdPublicDocument;
  }, ctx);

export const getPhysicalPublicDocumentByChecksum = async (ctx, checksum) => {
  const query = `
    SELECT id as "physicalPublicDocumentId" FROM db_namespace."PhysicalPublicDocument"
    WHERE "checksum" = :checksum
    LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ checksum }]);
  return rows && rows[0] && rows[0].physicalPublicDocumentId;
};

export const getPublicDocuments = async (ctx, publicDocumentIds) => await initQuery(ctx).from('PublicDocument').whereIn('uuid', publicDocumentIds);

export const getPublicDocumentById = async (ctx, publicDocumentId) => {
  const query = `
  SELECT * FROM db_namespace."PublicDocument"
  WHERE uuid = :publicDocumentId
  LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ publicDocumentId }]);
  return rows && rows[0];
};

export const deletePublicDocuments = async (ctx, documentIds) => await initQuery(ctx).from('PublicDocument').whereIn('uuid', documentIds).del();
