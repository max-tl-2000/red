/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validTenant, uuid } from '../../../../server/api/helpers/validators';
import { AuthorizationDataError, InternalServerError } from '../../../../server/common/errors';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { canUserDownloadDocument, getDocumentNameById } from '../../services/documents';
import { downloadDocument } from '../../../../server/workers/upload/documents/documentsS3Upload';
import { sanitizeFilename } from '../../../../common/helpers/strings';

import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'documentsAction' });

export const getDocumentCategory = () => {
  // TODO in CPM-4575
};

export const getApplicationDocumentByDocId = async req => {
  const {
    tenantId,
    params: { documentId },
    authUser,
  } = req;
  await validTenant(tenantId, 'INVALID_TENANT_ID');
  badRequestErrorIfNotAvailable([{ property: documentId, message: 'MISSING_DOCUMENT_ID' }]);

  uuid(documentId, 'INVALID_DOCUMENT_ID');

  logger.debug({ ctx: req, documentId }, 'getApplicationDocumentByDocId checking for permission');
  const isAllowedToDownload = await canUserDownloadDocument(req, documentId, authUser);
  if (!isAllowedToDownload) {
    throw new AuthorizationDataError('USER_NOT_ALLOWED_TO_DOWNLOAD');
  }

  logger.debug({ ctx: req, documentId }, 'getApplicationDocumentByDocId getting document name');
  const documentName = await getDocumentNameById({ tenantId }, documentId);
  logger.trace({ ctx: req, documentName, documentId }, 'application document name');

  let stream = null;
  try {
    logger.trace({ ctx: req, documentId }, 'getting application document stream');
    stream = downloadDocument(req, documentId);
    logger.trace({ ctx: req, documentId }, 'got application document stream');
  } catch (e) {
    throw new InternalServerError('ERROR_ON_GETTING_DOCUMENT');
  }

  return {
    type: 'stream',
    filename: sanitizeFilename(documentName, { replaceUnicode: true }),
    stream,
  };
};
