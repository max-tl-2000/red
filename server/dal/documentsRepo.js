/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, updateJSONBField, exists, getOneWhere } from '../database/factory';
import * as validators from '../api/helpers/validators';
import { ServiceError } from '../common/errors';
import { execConcurrent } from '../../common/helpers/exec-concurrent';

export const createDocument = async (ctx, document) => await insertInto(ctx.tenantId, 'Documents', document, { outerTrx: ctx.trx });

export const getAllDocuments = async ctx => await initQuery(ctx).from('Documents');

export const getDocuments = async (ctx, documentIds) => await initQuery(ctx).from('Documents').whereIn('uuid', documentIds);

const validateDocument = async (ctx, documentId) => {
  validators.uuid(documentId, 'INCORRECT_DOCUMENT_ID');
  const document = await exists(ctx, 'Documents', documentId, 'uuid');
  if (!document) {
    throw new ServiceError({
      token: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }
};

export const updateDocumentMetadata = async (ctx, documentId, metadata) => {
  await validateDocument(ctx, documentId);

  return await execConcurrent(
    Object.keys(metadata),
    async key =>
      await updateJSONBField({
        ctx,
        table: 'Documents',
        tableId: documentId,
        tableColumn: 'uuid',
        field: 'metadata',
        key,
        value: metadata[key],
      }),
  );
};

export const getDocumentMetadata = (schema, uuid) => getOneWhere(schema, 'Documents', { uuid }, ['metadata']);

export const deleteDocuments = async (ctx, documentIds) => await initQuery(ctx).from('Documents').whereIn('uuid', documentIds).del();

export const getSignedDocumentsForLease = async (ctx, leaseId) =>
  initQuery(ctx).from('Documents').whereRaw(`"context" = 'signed-lease' and "metadata" ->> 'leaseId' = '${leaseId}'`).returning('*');
