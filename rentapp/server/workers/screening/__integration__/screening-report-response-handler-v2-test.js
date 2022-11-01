/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import screeningResponseDisputed from './fixtures/screening-reponse-complete-disputed.json';
import screeningResponseComplete from './fixtures/screening-reponse-complete.json';
import screeningResponseAddressError from './fixtures/screening-reponse-error-address.json';
import screeningResponseOtherError from './fixtures/screening-reponse-error-other.json';
import screeningResponseCreditFreeze from './fixtures/screening-reponse-incomplete-credit-freeze.json';
import screeningResponseIncomplete from './fixtures/screening-reponse-incomplete.json';
import '../../../../../server/testUtils/setupTestGlobalContext';
import { createInitialApplicantData } from '../../../test-utils/applicant-report-helper';
import { ctx } from '../../../test-utils/repo-helper';
import { ApplicantReportNames, ApplicantReportStatus } from '../../../../../common/enums/screeningReportTypes';
import { createApplicantReport, getApplicantReportById } from '../../../dal/applicant-report-repo';
import { createApplicantReportRequestTracking } from '../../../dal/applicant-report-request-tracking-repo';
import { getLastSubmissionResponseBySubmissionRequestId } from '../../../dal/applicant-report-response-tracking-repo';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import { processScreeningResponseReceived } from '../v2/screening-report-response-handler';
import { BlockedReasons } from '../../../../../common/enums/applicationTypes';
import { isDateAfterDate } from '../../../../../common/helpers/date-utils';
import { now } from '../../../../../common/helpers/moment-utils';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';

const replaceTenantIdAndScreeningRequestIdOnFadvResponse = (response, tenantId, screeningRequestId) => {
  const responseString = JSON.stringify(response);
  const responseWithTenant = responseString.replace(/b950fc38-f29f-49e9-b45d-ffab0e53b904/g, tenantId);
  const responseWithScreeningId = responseWithTenant.replace(/00cbc545-1f0d-4f3a-8b73-71dcab48325b/g, screeningRequestId);

  return JSON.parse(responseWithScreeningId);
};
const expectedCompleteReportData = {
  creditScore: null,
  hasTaxLiens: true,
  hasBankruptcy: true,
  hasLegalItems: true,
  hasForeclosure: true,
  hasUtilityDebt: null,
  hasMortgageDebt: null,
  hasRentalCollections: true,
  hasPropertyRentalDebt: null,
  hasNoEstablishedCredit: true,
  hasEvictionNotice: null,
  hasLeaseViolation: null,
  hasNsfOrLatePayMax: null,
  hasNsfOrLatePayMin: null,
  hasSuspiciousSsn: false,
  hasRequiredSsnResponse: null,
};

describe('Applicant Report Response Handler', () => {
  let personId;
  let propertyId;
  let applicantDataId;
  let applicantReportId;
  let screeningRequestId;
  let screeningRequest;
  const reportName = ApplicantReportNames.CREDIT;

  beforeEach(async () => {
    const initialApplicantData = await createInitialApplicantData();
    const applicantData = initialApplicantData.applicantsData[0];
    personId = initialApplicantData.personId;
    propertyId = initialApplicantData.propertyId;
    applicantDataId = applicantData.id;
    const applicantReport = await createApplicantReport(ctx, {
      personId,
      reportName,
      applicantDataId,
      status: ApplicantReportStatus.COMPILING,
    });
    applicantReportId = applicantReport.id;

    screeningRequest = await createApplicantReportRequestTracking(ctx, {
      personId,
      reportName,
      requestApplicantId: newId(),
      applicantReportId,
      propertyId,
      requestType: FadvRequestTypes.NEW,
    });
    screeningRequestId = screeningRequest.id;
  });

  const evaluateScenario = async (fileName, { blockReason, responseStatus, applicantReportStatus, reportData, assertNullReportDocument = true }) => {
    const fadvResponse = replaceTenantIdAndScreeningRequestIdOnFadvResponse(fileName, ctx.tenantId, screeningRequestId);
    const result = await processScreeningResponseReceived(ctx, fadvResponse);
    expect(result.processed).to.equal(true);

    const applicantReportResponse = await getLastSubmissionResponseBySubmissionRequestId(ctx, screeningRequestId);
    blockReason && expect(applicantReportResponse.blockedReason).to.equal(blockReason);
    expect(applicantReportResponse.status).to.equal(responseStatus);
    const applicantReport = await getApplicantReportById(ctx, applicantReportId);
    expect(applicantReport.status).to.equal(applicantReportStatus);
    reportData && expect(applicantReport.reportData).to.deep.equal(reportData);

    assertNullReportDocument && expect(applicantReport.reportDocument).to.equal(null);

    return applicantReport;
  };

  describe('When a complete response is received', () => {
    describe("And it's Disputed", () => {
      it('should create a new applicant response tracking with a dispute block reason', async () => {
        await evaluateScenario(screeningResponseDisputed, {
          blockReason: BlockedReasons.DISPUTE,
          responseStatus: FADV_RESPONSE_STATUS.COMPLETE,
          applicantReportStatus: ApplicantReportStatus.BLOCKED_DISPUTE,
          reportData: { blockedBy: BlockedReasons.DISPUTE },
        });
      });
    });

    describe("And it's not Disputed", () => {
      it('should create a new complete applicant response tracking', async () => {
        const applicantReport = await evaluateScenario(screeningResponseComplete, {
          responseStatus: FADV_RESPONSE_STATUS.COMPLETE,
          applicantReportStatus: ApplicantReportStatus.COMPLETED,
          assertNullReportDocument: false,
        });
        expect(applicantReport.reportDocument).to.not.equal(null);
        expect(applicantReport.reportData).to.deep.equal(expectedCompleteReportData);
        expect(isDateAfterDate(applicantReport.validUntil, now())).to.equal(true);
      });
    });
  });

  describe('When an error response is received', () => {
    describe("And it's an address error", () => {
      it('should create a new applicant response tracking with a address block reason', async () => {
        await evaluateScenario(screeningResponseAddressError, {
          blockReason: BlockedReasons.ADDRESS,
          responseStatus: FADV_RESPONSE_STATUS.ERROR,
          applicantReportStatus: ApplicantReportStatus.BLOCKED_ADDRESS,
          reportData: { blockedBy: BlockedReasons.ADDRESS },
        });
      });
    });

    describe("And it's of other error", () => {
      it('should create a new applicant response tracking with an unknown block reason', async () => {
        await evaluateScenario(screeningResponseOtherError, {
          blockReason: BlockedReasons.UNKNOWN,
          responseStatus: FADV_RESPONSE_STATUS.ERROR,
          applicantReportStatus: ApplicantReportStatus.ERROR,
          reportData: { error: 'other' },
        });
      });
    });
  });

  describe('When an incomplete response is received', () => {
    describe("And it's a Credit Freeze", () => {
      it('should create a new applicant response tracking with a credit freeze block reason', async () => {
        await evaluateScenario(screeningResponseCreditFreeze, {
          blockReason: BlockedReasons.CREDIT_FREEZE,
          responseStatus: FADV_RESPONSE_STATUS.INCOMPLETE,
          applicantReportStatus: ApplicantReportStatus.BLOCKED_CREDIT_FREEZE,
          reportData: { blockedBy: BlockedReasons.CREDIT_FREEZE },
        });
      });
    });

    describe("And it's any other delay", () => {
      it('should create a new complete applicant response tracking with applicant report status compiling', async () => {
        await evaluateScenario(screeningResponseIncomplete, {
          responseStatus: FADV_RESPONSE_STATUS.INCOMPLETE,
          applicantReportStatus: ApplicantReportStatus.COMPILING,
        });
      });
    });
  });
});
