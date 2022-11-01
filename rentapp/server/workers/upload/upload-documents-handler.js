/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { verifyUploaderPerson, verifyUploaderPersonInParty, createDocument } from '../../services/documents';
import { createPartyApplicationDocument, deletePartyApplicationDocument } from '../../services/party-application';
import { deletePersonApplicationDocument } from '../../services/person-application';

import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({
  subType: 'Application Upload Documents Handler',
});

export const handleApplicationUploadResponseReceived = async message => {
  const { msgCtx } = message;
  const uploadingUser = message.metadata.document.uploadingUser;
  msgCtx.tenantId = uploadingUser.tenantId; // the context (and the meesage) do not contain the tenantId

  logger.trace(
    { ctx: msgCtx, partyId: uploadingUser?.partyId, partyApplicationId: uploadingUser?.partyApplicationId },
    'handleApplicationUploadResponseReceived',
  );

  if (message.metadata.document.partyApplicationId) {
    await verifyUploaderPersonInParty(msgCtx, uploadingUser.commonUserId, message.metadata.document.partyApplicationId);
    await createPartyApplicationDocument(msgCtx, message.metadata.document.partyApplicationId, message);
  } else {
    logger.trace(
      {
        tenantId: uploadingUser.tenantId,
        personApplicationId: uploadingUser.personApplicationId,
      },
      'Request for uploading the person application documents',
    );
    await verifyUploaderPerson(msgCtx, uploadingUser);
    await createDocument(msgCtx, uploadingUser.personApplicationId, message);
  }

  return { processed: true };
};

export const handleDeleteApplicationDocuments = async message => {
  const { documentId, metadata } = message;
  const { uploadingUser, partyApplicationId: sharedDocumentId } = metadata.document || {};
  const { tenantId, personApplicationId, partyApplicationId } = uploadingUser;
  const ctx = { ...message, tenantId };
  const isSharedDocument = !!sharedDocumentId;
  const commonLogContents = {
    ctx,
    isSharedDocument,
    documentId,
    personApplicationId,
    partyApplicationId,
  };

  logger.info(commonLogContents, 'Starting to delete application document');
  const deletedDocuments = await (isSharedDocument
    ? deletePartyApplicationDocument(ctx, partyApplicationId, documentId)
    : deletePersonApplicationDocument(ctx, uploadingUser.personApplicationId, documentId));

  if (deletedDocuments) {
    logger.info({ ctx, deletedDocuments, ...commonLogContents }, 'Application document deleted');
  } else {
    logger.error(ctx, commonLogContents, 'Missing application document');
  }

  return { processed: true };
};
