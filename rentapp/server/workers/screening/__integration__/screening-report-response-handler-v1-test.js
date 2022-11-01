/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import screeningResponsePendingApplicationDecisionCompleteStatus from './fixtures/screening-response-pending-application-decision-complete-status.json';
import '../../../../../server/testUtils/setupTestGlobalContext';
import { ctx, createAPartyApplication } from '../../../test-utils/repo-helper';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { processScreeningResponseReceived } from '../v1/screening-report-response-handler';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';
import { createSubmissionRequest, getSubmissionResponseBySubmissionRequestId } from '../../../dal/fadv-submission-repo';
import { createAUser, createATeam, createAParty } from '../../../../../server/testUtils/repoHelper';

const replaceTenantIdAndScreeningRequestIdOnFadvResponse = (response, tenantId, screeningRequestId) => {
  const responseString = JSON.stringify(response);
  const responseWithTenant = responseString.replace(/b950fc38-f29f-49e9-b45d-ffab0e53b904/g, tenantId);
  const responseWithScreeningId = responseWithTenant.replace(/00cbc545-1f0d-4f3a-8b73-71dcab48325b/g, screeningRequestId);

  return JSON.parse(responseWithScreeningId);
};

describe('Applicant Report Response Handler V1', () => {
  let screeningRequest;
  const applicantId = '78a3019b-a119-4ccb-8bdf-579aa60d5872';

  beforeEach(async () => {
    const user = await createAUser();
    const team = await createATeam({
      name: 'team',
      module: 'leasing',
      email: 'team1@reva.tech',
      phone: '12025550190',
    });
    const party = await createAParty({ userId: user.id, teams: [team.id] });
    const partyApplication = await createAPartyApplication(party.id, newId(), {}, ctx.tenantId);
    const propertyId = newId();
    const personId = newId();
    const unencryptedSocSecNumber = '123456789';
    const personData = { firstName: 'Harry', lastName: 'Potter', socSecNumber: unencryptedSocSecNumber };
    const applicantData = { ...personData, personId };

    const submissionRequest = {
      partyApplicationId: partyApplication.id,
      requestType: FadvRequestTypes.NEW,
      rawRequest: '',
      propertyId,
      applicantData,
    };

    screeningRequest = await createSubmissionRequest(ctx, submissionRequest);
  });

  describe('When a pending applicationDecision with status completed response is received', () => {
    it('should be submissionResponse status incomplete', async () => {
      const fadvResponse = replaceTenantIdAndScreeningRequestIdOnFadvResponse(
        screeningResponsePendingApplicationDecisionCompleteStatus,
        ctx.tenantId,
        screeningRequest.id,
      );
      const result = await processScreeningResponseReceived(ctx, fadvResponse);
      expect(result.processed).to.equal(true);

      const applicantReportResponse = await getSubmissionResponseBySubmissionRequestId(ctx, screeningRequest.id, false);
      expect(applicantReportResponse.status).to.equal(FADV_RESPONSE_STATUS.INCOMPLETE);

      expect(applicantReportResponse.applicationDecision).to.equal(ScreeningDecision.PENDING);
      expect(applicantReportResponse.serviceStatus).to.have.property(applicantId);
    });
  });
});
