/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { uploadPublicDocuments as uploadPublicDocumentsService } from '../../services/publicDocuments';
import { redirectToS3URL, downloadUploadedPublicDocument, deleteUploadedPublicDocument } from './publicDocuments/publicDocumentsHelper';

export const uploadPublicDocuments = async req => {
  if (!req.files) {
    throw new ServiceError({
      token: 'NO_FILES',
      status: 400,
    });
  }

  return await uploadPublicDocumentsService(req, req.body);
};

export const uploadImageFile = async req => {
  req?.log.trace({ ctx: req, body: req.body }, 'publicDocument uploadImageFile');
  const { clientFileId } = req.body;
  if (!req.files || !req.files.length) {
    throw new ServiceError({
      token: 'NO_FILES',
      status: 400,
    });
  }

  req.files.forEach(file => {
    file.clientFileId = clientFileId;
  });

  await uploadPublicDocuments(req);
};

export const fetchPublicImage = async req =>
  redirectToS3URL(req, { getFileId: () => req.params.imageId, invalidFileIdError: 'INVALID_IMAGE_ID', fileNotFoundError: 'IMAGE_NOT_FOUND' });

export const downloadImage = async req =>
  downloadUploadedPublicDocument(req, { getFileId: () => req.params.imageId, invalidFileIdError: 'INVALID_IMAGE_ID', fileNotFoundError: 'IMAGE_NOT_FOUND' });

export const deleteUploadedImage = async req =>
  await deleteUploadedPublicDocument(req, {
    invalidFileIdError: 'INVALID_IMAGE_FILE_ID',
    fileNotFoundError: 'IMAGE_NOT_FOUND',
    getFileId: () => req.params.imageId,
  });
