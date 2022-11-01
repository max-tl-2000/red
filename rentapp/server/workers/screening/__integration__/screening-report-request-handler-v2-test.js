/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import '../../../../../server/testUtils/setupTestGlobalContext';
import { createInitialApplicantData } from '../../../test-utils/applicant-report-helper';
import { ctx } from '../../../test-utils/repo-helper';
import { requestApplicantReportHandler } from '../v2/screening-report-request-handler';
import { ApplicantReportNames, ApplicantReportStatus } from '../../../../../common/enums/screeningReportTypes';
import { createApplicantReport } from '../../../dal/applicant-report-repo';
import {
  getApplicantReportRequestsByPersonIdAndReportName,
  createApplicantReportRequestTracking,
  updateApplicantReportRequestTracking,
} from '../../../dal/applicant-report-request-tracking-repo';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import { now } from '../../../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../../../common/date-constants';

describe('Request Applicant Report Handler for personId and reportName', () => {
  let applicationData;
  let personId;
  let propertyId;
  let applicantDataId;
  let applicantReportId;
  const reportName = ApplicantReportNames.CRIMINAL;

  beforeEach(async () => {
    const initialApplicantData = await createInitialApplicantData();
    const applicantData = initialApplicantData.applicantsData[0];
    applicationData = applicantData.applicationData;
    personId = initialApplicantData.personId;
    propertyId = initialApplicantData.propertyId;
    applicantDataId = applicantData.id;
    const applicantReport = await createApplicantReport(ctx, {
      personId,
      reportName: ApplicantReportNames.CRIMINAL,
      applicantDataId,
      status: ApplicantReportStatus.COMPILING,
    });
    applicantReportId = applicantReport.id;
  });

  const evaluateBaseScenario = (resp, applicantReportRequests, lastRequest, { expectedLength = 2, expectedRequestType = FadvRequestTypes.NEW } = {}) => {
    expect(resp.processed).to.equal(true);
    expect(applicantReportRequests).to.have.lengthOf(expectedLength);
    expect(lastRequest.applicantReportId).to.equal(applicantReportId);
    expect(lastRequest.requestType).to.equal(expectedRequestType);

    if (applicantReportRequests[1]) {
      expect(applicantReportRequests[1].isObsolete).to.equal(true);
    }
  };

  describe('When application data does not exists', () => {
    it('should return an error and processed true', async () => {
      try {
        await requestApplicantReportHandler(ctx, { personId: newId() });
      } catch (e) {
        expect(e.message).to.equal('Person application data is missing or empty');
        expect(e.processed).to.equal(true);
      }
    });
  });

  describe("When a previous request doesn't exists", () => {
    it('should send a New request', async () => {
      const resp = await requestApplicantReportHandler(ctx, { applicantReportId, personId, reportName, applicationData, propertyId });
      const applicantReportRequests = await getApplicantReportRequestsByPersonIdAndReportName(ctx, personId, reportName);
      const lastRequest = applicantReportRequests[0];
      evaluateBaseScenario(resp, applicantReportRequests, lastRequest, { expectedLength: 1 });
    });
  });

  describe('When a previous not pending request exists but it has no externalReportId', () => {
    it('should send a New request', async () => {
      const previousRequestApplicantId = newId();
      await createApplicantReportRequestTracking(ctx, {
        personId,
        reportName,
        requestApplicantId: previousRequestApplicantId,
        applicantReportId,
        propertyId,
        requestType: FadvRequestTypes.NEW,
        requestEndedAt: new Date(),
      });
      const resp = await requestApplicantReportHandler(ctx, { applicantReportId, personId, reportName, applicationData, propertyId });
      const applicantReportRequests = await getApplicantReportRequestsByPersonIdAndReportName(ctx, personId, reportName);
      const lastRequest = applicantReportRequests[0];
      evaluateBaseScenario(resp, applicantReportRequests, lastRequest);
      expect(lastRequest.requestApplicantId).to.not.equal(previousRequestApplicantId);
      expect(lastRequest.externalReportId).to.not.equal(null);
    });
  });

  describe('When a previous pending request exists', () => {
    describe('And it was of New type', () => {
      it('should send a New request', async () => {
        const previousRequestApplicantId = newId();
        await createApplicantReportRequestTracking(ctx, {
          personId,
          reportName,
          requestApplicantId: previousRequestApplicantId,
          applicantReportId,
          propertyId,
          requestType: FadvRequestTypes.NEW,
        });
        const resp = await requestApplicantReportHandler(ctx, { applicantReportId, personId, reportName, applicationData, propertyId });
        const applicantReportRequests = await getApplicantReportRequestsByPersonIdAndReportName(ctx, personId, reportName);
        const lastRequest = applicantReportRequests[0];
        evaluateBaseScenario(resp, applicantReportRequests, lastRequest);
        expect(lastRequest.requestApplicantId).to.equal(previousRequestApplicantId);
      });
    });

    describe('And it was of Modify type', () => {
      it('should send a Modify request', async () => {
        const previousRequestApplicantId = newId();
        await createApplicantReportRequestTracking(ctx, {
          personId,
          reportName,
          requestApplicantId: previousRequestApplicantId,
          applicantReportId,
          propertyId,
          requestType: FadvRequestTypes.MODIFY,
        });
        const resp = await requestApplicantReportHandler(ctx, { applicantReportId, personId, reportName, applicationData, propertyId });
        const applicantReportRequests = await getApplicantReportRequestsByPersonIdAndReportName(ctx, personId, reportName);
        const lastRequest = applicantReportRequests[0];
        evaluateBaseScenario(resp, applicantReportRequests, lastRequest, { expectedRequestType: FadvRequestTypes.MODIFY });
        expect(lastRequest.requestApplicantId).to.equal(previousRequestApplicantId);
      });
    });

    describe('And it has time out', () => {
      it('should mark the request as timed out', async () => {
        const previousRequestApplicantId = newId();
        const createdAt = now({ timezone: LA_TIMEZONE }).add(-1, 'minutes').toJSON();
        const { id } = await createApplicantReportRequestTracking(ctx, {
          personId,
          reportName,
          requestApplicantId: previousRequestApplicantId,
          applicantReportId,
          propertyId,
          requestType: FadvRequestTypes.NEW,
        });
        await updateApplicantReportRequestTracking(ctx, id, { created_at: createdAt });
        const resp = await requestApplicantReportHandler(ctx, { applicantReportId, personId, reportName, applicationData, propertyId });
        const applicantReportRequests = await getApplicantReportRequestsByPersonIdAndReportName(ctx, personId, reportName);
        expect(resp.processed).to.equal(true);
        const request = applicantReportRequests[1];
        expect(request.hasTimedOut).to.equal(true);
      });
    });
  });
});
