/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as service from '../../services/screening';
import * as validators from '../../../../server/api/helpers/validators';
import { AuthorizationDataError } from '../../../../server/common/errors';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { validateRequestType } from '../../helpers/screening-helper';
import { rerunScreening as rerunScreeningService, forceRescreening as forceRescreeningService } from '../../services/party-application';

export const getScreeningSummary = async req => {
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const { partyId } = req.params;
  const { quoteId, leaseTermId } = req.query || {};

  validators.uuid(partyId, 'INVALID_PARTY_ID');

  return await service.getScreeningSummary(req, { partyId, quoteId, leaseTermId });
};

export const getScreeningReportSummary = async req => {
  // TODO: CPM-5645-Create tests for API
  const partyId = req.params.partyId;
  const { leaseTermId, quoteId } = req.query || {};
  badRequestErrorIfNotAvailable([{ property: partyId, message: 'MISSING_PARTY_ID' }]);

  validators.uuid(partyId, 'INVALID_PARTY_ID');

  const isAllowedToViewReport = await service.canUserViewFullReportSummary(req, partyId, req.authUser);
  if (!isAllowedToViewReport) {
    throw new AuthorizationDataError('INVALID_LAA');
  }
  const screeningReportSummary = await service.getScreeningReportSummary(req, { partyId, quoteId, leaseTermId });
  return {
    content: screeningReportSummary?.backgroundReport || '',
    type: 'html',
  };
};

export const rerunScreening = async req => {
  const partyId = req.params.partyId;
  validators.uuid(partyId, 'INVALID_PARTY_APPLICATION_ID');
  return await rerunScreeningService(req, partyId);
};

export const forceRescreening = async req => {
  const partyId = req.params.partyId;
  const { requestType } = req.body;

  validators.uuid(partyId, 'INVALID_PARTY_APPLICATION_ID');
  validateRequestType(req, requestType);

  return await forceRescreeningService(req, partyId, requestType);
};
