/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { expect } from 'chai';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { getAllScreeningResultsForParty, getScreeningRequest } from '../screening';
import { testCtx, createAParty } from '../../../../server/testUtils/repoHelper';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { FadvRequestTypes } from '../../../../common/enums/fadvRequestTypes';
import { generateFADVResponse, createPartyOfSinglePersonScreeningRequest } from '../../test-utils/screening-test-helper';
import { FADV_RESPONSE_STATUS } from '../../../common/screening-constants';
import { createAPartyApplication, createAPersonApplication, createASubmissionRequest, createAPartyMember } from '../../test-utils/repo-helper';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('function getAllScreeningResultsForParty', () => {
  const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';

  describe('When a FADV response is not received for a given request', () => {
    it('should not throw an error', async () => {
      const tenantId = testCtx.tenantId;
      const additionalData = { disclosures: [1] };
      const { partyId } = await createPartyOfSinglePersonScreeningRequest(tenantId, additionalData);

      try {
        const failingResults = await getAllScreeningResultsForParty(testCtx, partyId);
        expect(failingResults.screeningResults[0].applicationDecision).equal(ScreeningDecision.RESULTS_DELAYED);
      } catch (err) {
        expect(false, 'this code should never be executed').to.be.true;
      }
    });
  });

  describe('When we received a FADV response', () => {
    it('should return empty as application decision for unknown error response', async () => {
      const tenantId = testCtx.tenantId;
      const { partyId, screeningRequestId, applicantId, applicants } = await createPartyOfSinglePersonScreeningRequest(tenantId);

      const applicantIdentifier = `${tenantId}:${applicantId}}`;

      await generateFADVResponse(tenantId, {
        scenarioFile: 'scenario-loading-xml-response-error.xml',
        applicantIdentifier,
        screeningRequestId,
        applicants,
        applicationDecision: '',
        basePath: BASE_PATH,
      });

      const failingResults = await getAllScreeningResultsForParty(testCtx, partyId);
      expect(failingResults.screeningResults[0].applicationDecision).equal(ScreeningDecision.RESULTS_DELAYED);
    });

    it('should return APPROVED as application decision for valid response', async () => {
      const tenantId = testCtx.tenantId;
      const { partyId, screeningRequestId, applicantId, applicants } = await createPartyOfSinglePersonScreeningRequest(tenantId);

      const applicantIdentifier = `${tenantId}:${applicantId}}`;

      await generateFADVResponse(tenantId, {
        scenarioFile: 'generic-response-template.xml',
        applicantsIdentifiers: [applicantIdentifier],
        screeningRequestId,
        applicants,
        applicationDecision: ScreeningDecision.APPROVED,
        status: FADV_RESPONSE_STATUS.COMPLETE,
        basePath: BASE_PATH,
      });

      const successfulResult = await getAllScreeningResultsForParty(testCtx, partyId);
      expect(successfulResult.screeningResults[0].applicationDecision).equal(ScreeningDecision.APPROVED);
    });

    it('should return APPROVED as application decision for valid response after an unknown error response', async () => {
      const tenantId = testCtx.tenantId;
      const { partyId, screeningRequestId, applicantId, applicants } = await createPartyOfSinglePersonScreeningRequest(tenantId);

      const applicantIdentifier = `${tenantId}:${applicantId}}`;

      await generateFADVResponse(tenantId, {
        scenarioFile: 'scenario-loading-xml-response-error.xml',
        applicantIdentifier,
        screeningRequestId,
        applicants,
        applicationDecision: '',
        basePath: BASE_PATH,
      });

      const failingResults = await getAllScreeningResultsForParty(testCtx, partyId);
      expect(failingResults.screeningResults[0].applicationDecision).equal(ScreeningDecision.RESULTS_DELAYED);

      await new Promise(resolve => setTimeout(resolve, 1000)); // We wait one second to get another response

      await generateFADVResponse(tenantId, {
        scenarioFile: 'generic-response-template.xml',
        applicantsIdentifiers: [applicantIdentifier],
        screeningRequestId,
        applicants,
        status: FADV_RESPONSE_STATUS.COMPLETE,
        applicationDecision: ScreeningDecision.APPROVED,
        basePath: BASE_PATH,
      });

      const successfulResult = await getAllScreeningResultsForParty(testCtx, partyId);
      expect(successfulResult.screeningResults[0].applicationDecision).equal(ScreeningDecision.APPROVED);
    });
  });

  describe('When a reset credit is sent', () => {
    it('should  return the reset credit response', async () => {
      const tenantId = testCtx.tenantId;
      const { partyId, screeningRequestId, applicantId, applicants, propertyId, partyApplicationId } = await createPartyOfSinglePersonScreeningRequest(
        tenantId,
      );
      const applicantIdentifier = `${tenantId}:${applicantId}}`;

      const resetCreditRequest = await createASubmissionRequest({
        partyApplicationId,
        propertyId,
        rawRequest: '',
        applicantData: { applicants },
        requestType: FadvRequestTypes.RESET_CREDIT,
      });

      await generateFADVResponse(tenantId, {
        scenarioFile: 'generic-response-template.xml',
        applicantsIdentifiers: [applicantIdentifier],
        screeningRequestId: resetCreditRequest.id,
        applicants,
        applicationDecision: ScreeningDecision.APPROVED,
        status: FADV_RESPONSE_STATUS.COMPLETE,
        basePath: BASE_PATH,
      });

      await generateFADVResponse(tenantId, {
        scenarioFile: 'generic-response-template.xml',
        applicantsIdentifiers: [applicantIdentifier],
        screeningRequestId,
        applicants,
        applicationDecision: '',
        status: FADV_RESPONSE_STATUS.INCOMPLETE,
        basePath: BASE_PATH,
      });

      const successfulResult = await getAllScreeningResultsForParty(testCtx, partyId);
      expect(successfulResult.screeningResults).to.have.lengthOf(1);
      expect(successfulResult.screeningResults[0].applicationDecision).equal(ScreeningDecision.APPROVED);
    });
  });
});

describe('given a person with applications in two parties', () => {
  const decryptSsn = true;
  const unencryptedSocSecNumber = '123456789';
  const personData = { firstName: 'Dennis', lastName: 'Smith', socSecNumber: unencryptedSocSecNumber };

  let screeningData = {};
  let anotherPartyApplication;
  let anotherPersonApplication;

  const createSubmissionRequest = async ({ personId, partyApplication, quoteId = getUUID() }) => {
    const applicantData = { ...personData, personId };
    await createAPersonApplication(applicantData, personId, partyApplication.partyId, partyApplication.id, false, null, true);
    const submissionRequest = {
      partyApplicationId: partyApplication.id,
      propertyId: getUUID(),
      rawRequest: '<Request></Request>',
      applicantData: {
        applicants: [applicantData],
      },
      quoteId,
    };

    return {
      personId,
      partyApplication,
      submissionRequest: await createASubmissionRequest(submissionRequest),
    };
  };

  beforeEach(async () => {
    const party = await createAParty({ state: DALTypes.PartyStateType.PROSPECT });
    const member = await createAPartyMember({ memberType: DALTypes.MemberType.RESIDENT, memberState: DALTypes.PartyStateType.APPLICANT }, party.id);
    const partyApplication = await createAPartyApplication(member.partyId, getUUID(), {});

    screeningData = await createSubmissionRequest({ personId: member.personId, partyApplication });

    anotherPartyApplication = await createAPartyApplication(getUUID(), getUUID(), {});
    anotherPersonApplication = await createAPersonApplication(
      { ...personData, firstName: 'Denis', personId: member.personId },
      member.personId,
      anotherPartyApplication.partyId,
      anotherPartyApplication.id,
      false,
      null,
      true,
    );
  });

  it('returns a screening request for the correct application by partyId', async () => {
    const { submissionRequest, partyApplication, personId } = screeningData;
    const screeningRequest = await getScreeningRequest({ tenantId: tenant.id }, submissionRequest.id, decryptSsn);

    expect(partyApplication.id).to.not.eq(anotherPartyApplication.id);
    expect(screeningRequest.partyApplicationId).to.eq(partyApplication.id);
    expect(screeningRequest.applicantData.applicants[0].personId).to.eq(personId);
    expect(screeningRequest.applicantData.applicants[0].firstName).to.eq(submissionRequest.applicantData.applicants[0].firstName);
    expect(screeningRequest.applicantData.applicants[0].firstName).to.not.eq(anotherPersonApplication.applicationData.firstName);
    expect(screeningRequest.applicantData.applicants[0].socSecNumber).to.eq(unencryptedSocSecNumber);
  });
});
