/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  getDocumentsKeyPrefix,
  getPrivateBucket,
  getEncryptionKeyId,
  getKeyPrefixForSignedLeaseDocuments,
  getKeyPrefixForExportedDatabase,
} from '../uploadUtil';
import { deleteObjects, saveFile, getObjectStream } from '../s3';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'aws' });

const bucket = getPrivateBucket();
const encryptionKeyId = getEncryptionKeyId();

export const uploadDocument = async (ctx, document, filePath) => {
  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);
  return saveFile(ctx, bucket, `${keyPrefix}/${document.uuid}`, filePath, {
    metadata: document.metadata.document,
    encryptionType: 'aws:kms',
    keyId: encryptionKeyId,
  });
};

export const downloadDocument = (ctx, documentId) => {
  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);
  return getObjectStream(ctx, bucket, `${keyPrefix}/${documentId}`);
};

export const getS3URLForDocumentById = (ctx, documentId) => {
  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);

  return `https://s3.amazonaws.com/${bucket}/${keyPrefix}/${documentId}`;
};

export const downloadSignedLease = (ctx, documentId, leaseId) => {
  const keyPrefix = getKeyPrefixForSignedLeaseDocuments(ctx.tenantId, leaseId);
  return getObjectStream(ctx, bucket, `${keyPrefix}/${documentId}`);
};

export const downloadExportedDatabase = (ctx, fileName) => {
  const keyPrefix = getKeyPrefixForExportedDatabase(ctx.tenantId);
  return getObjectStream(ctx, bucket, `${keyPrefix}/${fileName}`);
};

export const deleteDocuments = async (ctx, documentIds) => {
  logger.info({ ctx }, `Deleting documents with IDs ${documentIds} from S3 bucket ${bucket}`);
  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);

  await deleteObjects(
    ctx,
    bucket,
    documentIds.map(id => `${keyPrefix}/${id}`),
  );
};
