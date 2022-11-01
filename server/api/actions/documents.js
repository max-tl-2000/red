/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { getAllDocuments as getAllDocumentsFromDb, getDocuments } from '../../dal/documentsRepo';
import {
  updateDocumentMetadata as updateDocumentData,
  uploadDocuments as uploadDocumentsService,
  deleteDocuments as deleteDocumentsService,
} from '../../services/documents';
import { uuid, defined } from '../helpers/validators';
import { downloadDocument as downloadDocumentFromS3 } from '../../workers/upload/documents/documentsS3Upload';
import { sanitizeFilename } from '../../../common/helpers/strings';

export const uploadDocuments = async (req, accessType) => {
  if (!req.files) {
    throw new ServiceError({
      token: 'NO_FILES',
      status: 400,
    });
  }

  return await uploadDocumentsService(req, req.body, accessType);
};

export const getAllDocuments = async req => await getAllDocumentsFromDb(req);

export const updateDocumentMetadata = async req => {
  const { documentId } = req.params;
  return await updateDocumentData(req, documentId, req.body);
};

export const deleteDocuments = async req => {
  const { documentIds } = req.body;

  defined(documentIds, 'NO_DOCUMENTS_SPECIFIED');
  documentIds.map(id => uuid(id, 'INVALID_DOCUMENT_ID'));

  await deleteDocumentsService(req, documentIds);
};

export const downloadDocument = async req => {
  const { documentId } = req.params;

  uuid(documentId, 'INVALID_DOCUMENT_ID');

  const [doc] = await getDocuments(req, [documentId]);
  if (!doc) {
    throw new ServiceError({
      token: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }

  return {
    type: 'stream',
    filename: sanitizeFilename(doc.metadata.file.originalName, { replaceUnicode: true }),
    stream: downloadDocumentFromS3(req, documentId),
  };
};
