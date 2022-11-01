/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import { getPersonIdByTenantIdAndUserId } from '../../../auth/server/services/common-user';
import { BadRequestError, ServiceError } from '../../../server/common/errors';
import { getPersonApplication, getPersonApplicationByDocumentId } from './person-application';
import { getPartyApplication, getPartyApplicationByDocumentId } from './party-application';
import { getPartyIdsByPersonIds } from '../../../server/dal/partyRepo';
import { loadPartyById } from '../../../server/services/party';
import { getDocumentMetadata } from '../../../server/services/documents';
import { allowedToDownloadApplicationDocuments } from '../../../common/acd/access';
import * as dal from '../dal/documents-repo';

import { assert } from '../../../common/assert';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'rentappDocumentService' });

export const verifyUploaderPersonInParty = async (ctx, commonUserId, partyApplicationId) => {
  if (!commonUserId) {
    throw new ServiceError({ token: 'INVALID_UPLOADER', status: 401 });
  }
  logger.trace({ ctx, commonUserId, partyApplicationId }, 'verifyUploaderPerson');
  const personId = await getPersonIdByTenantIdAndUserId(ctx, ctx.tenantId, commonUserId);
  const partyApplication = await getPartyApplication(ctx, partyApplicationId);
  const partyIds = await getPartyIdsByPersonIds(ctx, [personId]);
  if (!partyIds.includes(partyApplication.partyId)) {
    throw new ServiceError({ token: 'INVALID_UPLOADER', status: 401 });
  }
};

export const verifyUploaderPerson = async (ctx, uploadingUser) => {
  const { tenantId, personApplicationId } = uploadingUser;
  assert(tenantId && personApplicationId, 'verifyUploaderPerson requires tenantId and personApplicationId passed in');
  logger.trace({ ctx: uploadingUser, personApplicationId }, 'verifyUploaderPerson');
  // TODO: this should use a simple exists instead of fetching whole app
  const personApplication = await getPersonApplication(ctx, personApplicationId);
  if (!personApplication) {
    throw new ServiceError({
      token: 'PERSON_APPLICATION_NOT_FOUND',
      status: 404,
    });
  }
  const personId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, uploadingUser.commonUserId);
  if (personId !== personApplication.personId) {
    throw new ServiceError({ token: 'INVALID_UPLOADER', status: 401 });
  }
};

export const createDocument = (ctx, personApplicationId, document) => {
  const metadata = {
    documentId: document.documentId,
    accessType: document.accessType,
    uploadingUser: document.metadata.document.uploadingUser,
    documentName: document.metadata.file.originalName,
  };

  return dal.createDocument(ctx, { personApplicationId, metadata });
};

// Using getDocumentList as param so different functions can be passed in case its a person or a party getting the documents
export const fetchDocumentsMetadataTemplate = async (ctx, { validate = () => {}, getDocumentList = () => {} }) => {
  validate();
  const documentList = await getDocumentList();

  if (!documentList || !documentList.length) return documentList;

  const documents = await Promise.all(documentList.map(doc => getDocumentMetadata(ctx, doc.metadata.documentId)));
  return documents.filter(d => d);
};

const hasPartyId = application => application && application.partyId;

export const canUserDownloadDocument = async (ctx, documentId, authUser) => {
  logger.trace({ ctx, documentId }, 'canUserDownloadDocument?');
  const partyApplication = await getPartyApplicationByDocumentId(ctx, documentId);
  const personApplication = await getPersonApplicationByDocumentId(ctx, documentId);

  if (!hasPartyId(partyApplication) && !hasPartyId(personApplication)) {
    throw new BadRequestError('INVALID_DOCUMENT_ID');
  }

  const partyId = !isEmpty(partyApplication) ? partyApplication.partyId : personApplication.partyId;
  const party = await loadPartyById(ctx, partyId);

  return allowedToDownloadApplicationDocuments(authUser, party);
};

export const getDocumentNameById = async (ctx, documentId) => {
  const document = await getDocumentMetadata(ctx, documentId);
  return document.metadata.file.originalName;
};
