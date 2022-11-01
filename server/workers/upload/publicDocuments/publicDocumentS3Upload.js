/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveFile, getObjectStream } from '../s3';
import { getKeyPrefixForPublicDocuments, getAssetsBucket } from '../uploadUtil';

// we are using the same bucket that we use for assets
const bucket = getAssetsBucket();

export const uploadPublicDocument = async (ctx, publicDocument, filePath, options = {}) => {
  const keyPrefix = getKeyPrefixForPublicDocuments(ctx.tenantId);
  return saveFile(ctx, bucket, `${keyPrefix}/${publicDocument.physicalPublicDocumentId}`, filePath, {
    acl: 'public-read',
    ...options,
  });
};

export const downloadPublicDocument = (ctx, physicalPublicDocumentId) => {
  const keyPrefix = getKeyPrefixForPublicDocuments(ctx.tenantId);
  return getObjectStream(ctx, bucket, `${keyPrefix}/${physicalPublicDocumentId}`);
};

export const getS3URLForPublicDocumentById = (ctx, documentId) => {
  const keyPrefix = getKeyPrefixForPublicDocuments(ctx.tenantId);

  return `https://s3.amazonaws.com/${bucket}/${keyPrefix}/${documentId}`;
};
