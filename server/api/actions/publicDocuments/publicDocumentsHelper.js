/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../../common/errors';
import { getPublicDocuments, deletePublicDocuments } from '../../../dal/publicDocumentRepo';
import { deletePostsPublicDocumentReference } from '../../../dal/cohortCommsRepo';

import {
  downloadPublicDocument as downloadPublicDocumentFromS3,
  getS3URLForPublicDocumentById,
} from '../../../workers/upload/publicDocuments/publicDocumentS3Upload';

import { uuid } from '../../helpers/validators';
import { sanitizeFilename } from '../../../../common/helpers/strings';

const defaultGetFileId = req => req?.body?.fileId;

export const deleteUploadedPublicDocument = async (req, { invalidFileIdError, fileNotFoundError, getFileId = defaultGetFileId }) => {
  const fileId = getFileId(req);

  uuid(fileId, invalidFileIdError || 'INVALID_DOCUMENT_ID');

  const [doc] = await getPublicDocuments(req, [fileId]);

  if (!doc) {
    throw new ServiceError({
      token: fileNotFoundError || 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }
  await deletePostsPublicDocumentReference(req, fileId);
  await deletePublicDocuments(req, [fileId]);
};

const defaultGetDocumentId = req => req.params.documentId;

export const downloadUploadedPublicDocument = async (req, { getFileId = defaultGetDocumentId, invalidFileIdError, fileNotFoundError }) => {
  const fileId = getFileId(req);

  uuid(fileId, invalidFileIdError || 'INVALID_DOCUMENT_ID');

  const [doc] = await getPublicDocuments(req, [fileId]);
  if (!doc) {
    throw new ServiceError({
      token: fileNotFoundError || 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }

  return {
    type: 'stream',
    filename: sanitizeFilename(doc.metadata.file.originalName, { replaceUnicode: true }),
    stream: downloadPublicDocumentFromS3(req, doc.physicalPublicDocumentId),
  };
};

export const redirectToS3URL = async (req, { getFileId = defaultGetDocumentId, invalidFileIdError, fileNotFoundError }) => {
  const fileId = getFileId(req);

  uuid(fileId, invalidFileIdError || 'INVALID_DOCUMENT_ID');

  const [doc] = await getPublicDocuments(req, [fileId]);
  if (!doc) {
    throw new ServiceError({
      token: fileNotFoundError || 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }

  return {
    type: 'redirect',
    url: getS3URLForPublicDocumentById(req, doc.physicalPublicDocumentId),
  };
};
