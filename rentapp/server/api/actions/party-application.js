/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  getDocumentsByPartyApplicationId as getDocumentsByPartyApplicationIdService,
  holdApplicationStatus as holdApplicationStatusService,
  getApplicationDataForPartyApplication as getApplicationDataForPartyApplicationService,
  updatePartyApplicationApplicationData as updatePartyApplicationApplicationDataService,
} from '../../services/party-application';
import * as validators from '../../../../server/api/helpers/validators';
import * as rentappValidators from '../helpers/validators';
import { verifyUploaderPersonInParty } from '../../services/documents';
import { BadRequestError } from '../../../../server/common/errors';

import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'personApplicationService' });

export const getDocumentsMetadataByPartyApplicationId = async req => {
  const ctx = { ...req };
  logger.debug({ ctx }, 'getDocumentsMetadataByPartyApplicationId');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const partyApplicationId = req.params.partyApplicationId;
  validators.uuid(partyApplicationId, 'INVALID_PARTY_APPLICANT_ID');

  const { tenantId, commonUserId } = req.authUser;
  // TODO: why was this necessary?
  ctx.tenantId = tenantId;

  logger.trace({ ctx }, 'verifying uploader person in party');
  await verifyUploaderPersonInParty(ctx, commonUserId, partyApplicationId);
  logger.trace({ ctx }, 'fetching documents');
  const result = await getDocumentsByPartyApplicationIdService(ctx, partyApplicationId);
  logger.trace({ ctx, numDocs: result.length }, 'got documents');
  return result.map(item => item.metadata);
};

export const holdApplicationStatus = async req => {
  const partyId = req.params.partyId;
  validators.uuid(partyId, 'INVALID_PARTY_APPLICATION_ID');

  await rentappValidators.assertNoScreeningRequests(req, partyId);
  return await holdApplicationStatusService(req, partyId, req.body.isHeld, req.body.holdReason);
};

export const getPartyApplicationApplicationData = async req => {
  logger.trace({ ctx: req }, 'getPartyApplicationApplicationData');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const partyApplicationId = req.authUser.partyApplicationId;
  logger.info({ ctx: req, partyApplicationId }, 'getPartyApplicationApplicationData');

  validators.uuid(partyApplicationId, 'INVALID_PARTY_APPLICANT_ID');

  return getApplicationDataForPartyApplicationService(req, partyApplicationId);
};

export const updatePartyApplicationApplicationData = async req => {
  logger.trace({ ctx: req }, 'updatePartyApplicationApplicationData');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const partyApplicationId = req.authUser.partyApplicationId;
  logger.info({ ctx: req, partyApplicationId }, 'updatePartyApplicationApplicationData');
  const partyApplicationRaw = req.body;

  validators.defined(partyApplicationRaw, 'INVALID_PARTY_APPLICANT_BODY');

  if (!partyApplicationId) {
    throw new BadRequestError('ILLEGAL_PARAMETER_ID');
  }
  if (!partyApplicationRaw.applicationData) {
    throw new BadRequestError('ILLEGAL_PARAMETER_APPLICATION_DATA');
  }

  validators.uuid(partyApplicationId, 'INVALID_PARTY_APPLICANT_ID');
  return updatePartyApplicationApplicationDataService(req, partyApplicationId, partyApplicationRaw.applicationData);
};
