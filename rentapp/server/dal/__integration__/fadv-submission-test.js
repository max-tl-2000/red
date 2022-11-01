/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { createAPartyApplication, createASubmissionRequest, createASubmissionResponse, createAPartyMember, ctx } from '../../test-utils/repo-helper';
import {
  getSubmissionRequest,
  updateSubmissionRequest,
  getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm,
  getStuckSubmissionRequests,
  updateSubmissionResponse,
  getAmountOfNewSubmissionRequestsByPartyApplication,
  getPrevSubmissionRequestData,
} from '../fadv-submission-repo';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { FADV_RESPONSE_STATUS } from '../../../common/screening-constants';
import { FadvRequestTypes } from '../../../../common/enums/fadvRequestTypes';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { FADV_TO_DATABASE_SERVICE_STATUS_TRANS } from '../../../common/enums/fadv-service-status';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { applicationDecisionHasErrorOther } from '../../helpers/screening-helper';
import { createAParty } from '../../../../server/testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import config from '../../../config';

describe('dal/fadv-submission-repo', () => {
  const createSubmissionRequest = async ({
    personId,
    partyApplication,
    parentSubmissionRequestId,
    isObsolete = false,
    requestType = FadvRequestTypes.NEW,
    quoteId = getUUID(),
    leaseTermMonths = 12,
  }) => {
    const propertyId = getUUID();
    if (!partyApplication) {
      partyApplication = await createAPartyApplication(getUUID(), getUUID());
    }

    const applicantData = {
      lastName: 'Smith',
      middleName: 'Will',
      firstName: 'Dennis',
      dateOfBirth: '1965-10-19',
      email: 'testemail@reva.tech',
      socSecNumber: '555559999',
      grossIncomeMonthly: 4000.0,
      personId,
      address: {
        enteredByUser: {
          line1: '404 NW Napp Street',
          line2: '',
          city: 'De Kalb',
          state: 'TX',
          postalCode: '75559',
        },
      },
    };
    const submissionRequest = {
      partyApplicationId: partyApplication.id,
      rawRequest: `<Request>
                      <PropertyID>
                        <Identification IDType="Property ID">
                          <IDValue>123456</IDValue>
                        </Identification>
                        <MarketingName>My Properties</MarketingName>
                      </PropertyID>
                      <RequestType>New</RequestType>
                      <ReportOptions>
                        <ReportName>01</ReportName>
                      </ReportOptions>
                      <ReportID>6490560</ReportID>
                      <OriginatorID>26694</OriginatorID>
                      <MarketingSource>Rent.com</MarketingSource>
                      <UserName>rsuser</UserName>
                      <UserPassword>rspassword</UserPassword>
                    </Request>`,
      propertyId,
      applicantData: {
        applicants: [applicantData],
      },
      rentData: {
        rent: 2000,
        deposit: 0,
        leaseTermMonths,
      },
      parentSubmissionRequestId,
      isObsolete,
      requestType,
      quoteId,
    };

    return {
      propertyId,
      partyApplication,
      submissionRequest: await createASubmissionRequest(submissionRequest),
    };
  };

  const getSubmissionResponseServiceStatus = (serviceStatus, partiallyComplete = false) => ({
    '07c02226-1285-4691-a0f4-d9561fb970f0': [
      { serviceName: 'Criminal', status: serviceStatus },
      { serviceName: 'Criminal', status: serviceStatus },
      { serviceName: 'Credit', status: serviceStatus },
    ],
    'e9fd4f50-00b1-4bed-b55f-96aa18ed2a35': [
      { serviceName: 'Criminal', status: serviceStatus },
      { serviceName: 'Criminal', status: serviceStatus },
      { serviceName: 'Credit', status: partiallyComplete ? FADV_TO_DATABASE_SERVICE_STATUS_TRANS.INCOMPLETE : serviceStatus },
    ],
  });

  const createSubmissionResponse = async ({
    submissionRequestId,
    applicationDecision,
    responseStatus = FADV_RESPONSE_STATUS.COMPLETE,
    responseServiceStatus = FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED,
    hasParsingError = false,
    overrideStatus = false,
    partiallyComplete = false,
  }) => {
    const parsingErrorRawResponse =
      '{ "ApplicantScreening": "Response": [{ "ErrorDescription": [ "Unable to parse applicant section, Guarantor..." ], "Status": [ "Error" ] }]';
    const rawResponse = '{ "ApplicantScreening": {} }';
    const hasNoError = !applicationDecisionHasErrorOther(applicationDecision);

    const fadvServiceStatus = partiallyComplete ? FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED : responseServiceStatus;
    const submissionResponse = {
      submissionRequestId,
      rawResponse: hasParsingError ? parsingErrorRawResponse : rawResponse,
      applicationDecision,
      applicantDecision: [{ personId: 't0003504' }],
      externalId: '12345',
      status: hasNoError || overrideStatus ? responseStatus : undefined,
      serviceStatus: hasNoError ? getSubmissionResponseServiceStatus(fadvServiceStatus, partiallyComplete) : undefined,
    };

    return await createASubmissionResponse(submissionResponse);
  };

  describe('given a request to FADV service it should log the request and response', () => {
    it('The request is logged in the database', async () => {
      const { propertyId, partyApplication, submissionRequest } = await createSubmissionRequest({ personId: getUUID() });

      expect(typeof submissionRequest.id !== 'undefined').to.equal(true);
      expect(submissionRequest.partyApplicationId).to.equal(partyApplication.id);
      expect(submissionRequest.propertyId).to.equal(propertyId);
      expect(submissionRequest.parentSubmissionRequestId).to.be.null;

      const { submissionRequest: childSubmissionRequest } = await createSubmissionRequest({
        personId: getUUID(),
        partyApplication,
        parentSubmissionRequestId: submissionRequest.id,
      });
      expect(childSubmissionRequest.parentSubmissionRequestId).to.equal(submissionRequest.id);
    });

    it('The response is logged in the database', async () => {
      const party = await createAParty({
        state: DALTypes.PartyStateType.PROSPECT,
      });
      const member = await createAPartyMember(
        {
          memberType: DALTypes.MemberType.RESIDENT,
          memberState: DALTypes.PartyStateType.APPLICANT,
          fullname: 'TEST',
        },
        party.id,
      );
      const partyApplication = await createAPartyApplication(member.partyId, getUUID(), {});

      const { submissionRequest } = await createSubmissionRequest({ personId: member.personId, partyApplication });

      const submissionResponse = {
        submissionRequestId: submissionRequest.id,
        rawResponse: `<Response>
                        <TransactionNumber>2001</TransactionNumber>
                        <ReportDate>2011-04-08</ReportDate>
                        <ApplicantDecision>Smith, Edgar - APPROVED
                        Smith, Florence - APPROVED
                        </ApplicantDecision>
                        <ApplicationDecision>APPROVED</ApplicationDecision>
                        <Status>Complete</Status>
                        <RequestID_Returned>414926</RequestID_Returned>
                      </Response>`,
        applicationDecision: 'APPROVED',
        applicantDecision: [
          { personId: 't0003504', result: 'APPROVED' },
          { personId: 't0003505', result: 'APPROVED' },
        ],
        externalId: '12345',
      };
      const responseLogged = await createASubmissionResponse(submissionResponse);

      expect(typeof responseLogged.id !== 'undefined').to.equal(true);
      expect(responseLogged.submissionRequestId).to.equal(submissionRequest.id);
      expect(responseLogged.applicantDecision[0].personId).to.equal(submissionResponse.applicantDecision[0].personId);

      submissionRequest.completeSubmissionResponseId = responseLogged.id;
      await updateSubmissionRequest({ tenantId: tenant.id }, submissionRequest.id, submissionRequest);
      const completeSubmissionRequest = await getSubmissionRequest({ tenantId: tenant.id }, submissionRequest.id);

      expect(completeSubmissionRequest.completeSubmissionResponseId).to.equal(responseLogged.id);
    });
  });

  describe('given a set of submission requests', () => {
    it('should return the previous submission request for a given quote and lease term', async () => {
      const quoteId = getUUID();
      const personId = getUUID();
      const isObsolete = true;

      const twelveMonthLeaseSubmissionRequest = { personId, isObsolete, quoteId, leaseTermMonths: 12 };
      await createSubmissionRequest(twelveMonthLeaseSubmissionRequest);
      const { partyApplication, submissionRequest: prevTwelveMonthLeaseRequest } = await createSubmissionRequest(twelveMonthLeaseSubmissionRequest);

      const sixMonthLeaseSubmissionRequest = {
        personId,
        partyApplication,
        isObsolete,
        quoteId,
        leaseTermMonths: 6,
      };
      await createSubmissionRequest(sixMonthLeaseSubmissionRequest);
      const { submissionRequest: prevSixMonthLeaseRequest } = await createSubmissionRequest(sixMonthLeaseSubmissionRequest);

      await createSubmissionRequest({ personId, isObsolete: false });

      let previousRequest = await getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm({ tenantId: tenant.id }, partyApplication.id, quoteId, 6);
      expect(previousRequest.id).to.equal(prevSixMonthLeaseRequest.id);

      previousRequest = await getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm({ tenantId: tenant.id }, partyApplication.id, quoteId, 12);
      expect(previousRequest.id).to.equal(prevTwelveMonthLeaseRequest.id);

      previousRequest = await getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm({ tenantId: tenant.id }, partyApplication.id, quoteId, 15);
      expect(previousRequest).to.be.undefined;
    });

    it('should return the previous submission request', async () => {
      const personId = getUUID();
      const quoteId = getUUID();

      let previousRequest = await getPrevSubmissionRequestData(ctx, getUUID());
      expect(previousRequest).to.be.undefined;

      const { partyApplication, submissionRequest: firstRequest } = await createSubmissionRequest({ personId });
      previousRequest = await getPrevSubmissionRequestData(ctx, partyApplication.id);
      expect(previousRequest.id).to.be.equal(firstRequest.id);

      const { submissionRequest: secondRequest } = await createSubmissionRequest({ personId, partyApplication });
      previousRequest = await getPrevSubmissionRequestData(ctx, partyApplication.id);
      expect(previousRequest.id).to.be.equal(secondRequest.id);

      await createSubmissionRequest({ personId, quoteId, partyApplication });
      const { submissionRequest: fourthRequest } = await createSubmissionRequest({ personId, quoteId, partyApplication });
      previousRequest = await getPrevSubmissionRequestData(ctx, partyApplication.id);
      expect(previousRequest.id).to.be.equal(fourthRequest.id);
    });
  });

  const mockResponseParameters = [
    { incompleteResponse: true, serviceStatusComplete: true, delta: 0 }, // stuck but out of timeframe
    { incompleteResponse: true, serviceStatusComplete: true, delta: 2 }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, serviceStatusComplete: false, delta: 3 }, // not stuck and in timeframe
    { incompleteResponse: true, serviceStatusComplete: true, delta: 4 }, // stuck and in timeframe - MATCH
    { incompleteResponse: false, serviceStatusComplete: true, applicationDecision: ScreeningDecision.APPROVED, delta: 1 }, // not stuck and out of timeframe
    { incompleteResponse: false, serviceStatusComplete: true, applicationDecision: ScreeningDecision.DECLINED, delta: 1 }, // not stuck and out of timeframe
    { incompleteResponse: true, serviceStatusComplete: true, delta: 10 }, // stuck and in timeframe - MATCH
    { incompleteResponse: false, serviceStatusComplete: true, applicationDecision: ScreeningDecision.APPROVED, delta: 3 }, // not stuck and in timeframe
    { incompleteResponse: false, serviceStatusComplete: true, applicationDecision: ScreeningDecision.DECLINED, delta: 5 }, // not stuck and in timeframe
    { incompleteResponse: false, serviceStatusComplete: true, applicationDecision: ScreeningDecision.DECLINED, delta: 5 }, // not stuck and in timeframe
    { incompleteResponse: false, serviceStatusComplete: true, delta: 5 }, // stuck and in timeframe - MATCH (status: complete, serviceStatus: complete, with empty applicationDecision)
    { incompleteResponse: false, serviceStatusComplete: false, applicationDecision: ScreeningDecision.APPROVED, partiallyComplete: true, delta: 5 }, // stuck and in timeframe - MATCH (status: complete, serviceStatus:partially complete, with applicationDecision)
    { incompleteResponse: true, serviceStatusComplete: false, applicationDecision: ScreeningDecision.APPROVED, partiallyComplete: true, delta: 5 }, // stuck and in timeframe - MATCH (status: incomplete, serviceStatus:partially complete,  with applicationDecision)
    { incompleteResponse: true, serviceStatusComplete: false, partiallyComplete: true, delta: 5 }, // not stuck and in timeframe (status: incomplete, serviceStatus:partially complete, without applicationDecision)
    { incompleteResponse: true, serviceStatusComplete: true, delta: 1 }, // stuck but out of timeframe
    { incompleteResponse: true, serviceStatusComplete: true, overrideStatus: true, delta: 1 }, // stuck but out of timeframe
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: true, delta: 8 }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: true, delta: 1 }, // stuck and out of timeframe
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: true, delta: 4 }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: false, delta: 5 }, // not stuck and in timeframe
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: true, delta: 25, timeFrame: 'hours' }, // stuck and out of timeframe
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: true, delta: 23, timeFrame: 'hours' }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, applicationDecision: ScreeningDecision.ERROR_OTHER, hasParsingError: false, delta: 4, timeFrame: 'minutes' }, // not stuck stuck and in timeframe
    { incompleteResponse: true, serviceStatusComplete: true, delta: 30, timeFrame: 'hours' }, // stuck and out of timeframe
    { incompleteResponse: true, serviceStatusComplete: false, delta: 5, timeFrame: 'minutes' }, // not stuck and in timeframe
    { incompleteResponse: true, serviceStatusComplete: true, delta: 12, timeFrame: 'hours' }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, applicationDecision: ScreeningDecision.PENDING, serviceStatusComplete: true, delta: 4 }, // stuck and in timeframe - MATCH
    { incompleteResponse: true, applicationDecision: ScreeningDecision.PENDING, serviceStatusComplete: false, delta: 8 }, // not stuck and in timeframe
    { incompleteResponse: true, applicationDecision: ScreeningDecision.PENDING, serviceStatusComplete: false, partiallyComplete: true, delta: 12 }, // not stuck and in timeframe (status: incomplete, serviceStatus:partially complete, without applicationDecision)
    { incompleteResponse: true, applicationDecision: ScreeningDecision.PENDING, serviceStatusComplete: true, delta: 1 }, // stuck and out of timeframe
  ];

  const updateResponseCreatedAt = async response => {
    const { delta: createdAtDelta, timeFrame } = response;
    const createdAt = toMoment(response.created_at).add(-createdAtDelta, timeFrame);
    [response] = await updateSubmissionResponse({ tenantId: tenant.id }, response.id, {
      created_at: createdAt.toDate(),
    });
    return response;
  };

  const initStuckRequestData = async () =>
    await Promise.all(
      mockResponseParameters.map(async respParams => {
        const {
          incompleteResponse,
          serviceStatusComplete = false,
          applicationDecision,
          hasParsingError,
          overrideStatus,
          partiallyComplete,
          delta,
          timeFrame = 'minutes',
        } = respParams;
        const request = await createSubmissionRequest({ personId: getUUID() });

        const createdResponse = await createSubmissionResponse({
          submissionRequestId: request.submissionRequest.id,
          applicationDecision,
          responseStatus: incompleteResponse ? FADV_RESPONSE_STATUS.INCOMPLETE : FADV_RESPONSE_STATUS.COMPLETE,
          responseServiceStatus: serviceStatusComplete ? FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED : FADV_TO_DATABASE_SERVICE_STATUS_TRANS.INCOMPLETE,
          hasParsingError,
          overrideStatus,
          partiallyComplete,
        });

        // add another incomplete response for the same submission request
        if (applicationDecision === ScreeningDecision.ERROR_OTHER) {
          await createSubmissionResponse({
            submissionRequestId: request.submissionRequest.id,
            applicationDecision,
            responseStatus: incompleteResponse ? FADV_RESPONSE_STATUS.INCOMPLETE : FADV_RESPONSE_STATUS.COMPLETE,
            responseServiceStatus: serviceStatusComplete ? FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED : FADV_TO_DATABASE_SERVICE_STATUS_TRANS.INCOMPLETE,
            hasParsingError,
          });
        }

        return await updateResponseCreatedAt({ ...createdResponse, delta, timeFrame });
      }),
    );

  describe('given a set of submission requests with responses', () => {
    it('should return a list of stuck submission requests based on response interval', async () => {
      await initStuckRequestData();
      const stuckSubmissionRequests = await getStuckSubmissionRequests({ tenantId: tenant.id });
      expect(typeof stuckSubmissionRequests !== 'undefined').to.equal(true);
      expect(stuckSubmissionRequests.length).to.equal(8);
    });
  });

  describe('given a set of submission requests with responses', () => {
    it('should return a list of stuck submission requests based on request interval', async () => {
      await initStuckRequestData();
      const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;
      const stuckSubmissionRequests = await getStuckSubmissionRequests({ tenantId: tenant.id }, { minTime, maxTime, timeframe: 'hours' });
      expect(typeof stuckSubmissionRequests !== 'undefined').to.equal(true);
      expect(stuckSubmissionRequests.length).to.equal(18);
    });
  });

  const initPartyApplicationData = async () =>
    await Promise.all([
      await createAPartyApplication(getUUID(), getUUID()),
      await createAPartyApplication(getUUID(), getUUID()),
      await createAPartyApplication(getUUID(), getUUID()),
    ]);

  const mockRequestData = [
    { partyApplication: 0, requestType: FadvRequestTypes.NEW, delta: 130 },
    { partyApplication: 0, requestType: FadvRequestTypes.MODIFY, delta: 130 },
    { partyApplication: 0, requestType: FadvRequestTypes.VIEW, delta: 128 },
    { partyApplication: 0, requestType: FadvRequestTypes.NEW, delta: 59 },
    { partyApplication: 0, requestType: FadvRequestTypes.MODIFY, delta: 59 },
    { partyApplication: 0, requestType: FadvRequestTypes.NEW, delta: 30 },
    { partyApplication: 0, requestType: FadvRequestTypes.MODIFY, delta: 30 },
    { partyApplication: 1, requestType: FadvRequestTypes.NEW, delta: 125 },
    { partyApplication: 1, requestType: FadvRequestTypes.MODIFY, delta: 125 },
    { partyApplication: 1, requestType: FadvRequestTypes.NEW, delta: 110 },
    { partyApplication: 1, requestType: FadvRequestTypes.MODIFY, delta: 110 },
    { partyApplication: 1, requestType: FadvRequestTypes.NEW, delta: 61 },
    { partyApplication: 1, requestType: FadvRequestTypes.MODIFY, delta: 61 },
    { partyApplication: 2, requestType: FadvRequestTypes.NEW, delta: 30 },
    { partyApplication: 2, requestType: FadvRequestTypes.NEW, delta: 15 },
    { partyApplication: 2, requestType: FadvRequestTypes.VIEW, delta: 5 },
  ];

  const updateRequestCreatedAt = async request => {
    const { submissionRequest, delta: createdAtDelta, timeFrame = 'minutes' } = request;
    const createdAt = toMoment(submissionRequest.created_at).add(-createdAtDelta, timeFrame);
    [request] = await updateSubmissionRequest(ctx, submissionRequest.id, {
      created_at: createdAt.toDate(),
    });
    return request;
  };

  const initRequestData = async partyApplications =>
    await Promise.all(
      mockRequestData.map(async requestParams => {
        const { partyApplication, requestType, delta, timeFrame = 'minutes' } = requestParams;
        const createdRequest = await createSubmissionRequest({ personId: getUUID(), partyApplication: partyApplications[partyApplication], requestType });

        return await updateRequestCreatedAt({ ...createdRequest, delta, timeFrame });
      }),
    );

  describe('given a set of submission requests', () => {
    it('should return the total number of new requests per party application for the default time frame', async () => {
      const partyApplications = await initPartyApplicationData();
      await initRequestData(partyApplications);

      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, getUUID())).to.equal(0);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[0].id)).to.equal(2);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[1].id)).to.equal(0);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[2].id)).to.equal(2);
    });

    it('should return the total number of new requests per party application for a custom time frame', async () => {
      const partyApplications = await initPartyApplicationData();
      await initRequestData(partyApplications);

      const twentyMinuteTimeFrame = { interval: 20, timeFrame: 'minutes' };
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[0].id, twentyMinuteTimeFrame)).to.equal(0);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[1].id, twentyMinuteTimeFrame)).to.equal(0);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[2].id, twentyMinuteTimeFrame)).to.equal(1);

      const fortyFiveMinuteTimeFrame = { interval: 45, timeFrame: 'minutes' };
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[0].id, fortyFiveMinuteTimeFrame)).to.equal(1);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[1].id, fortyFiveMinuteTimeFrame)).to.equal(0);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[2].id, fortyFiveMinuteTimeFrame)).to.equal(2);

      const twoHourTimeFrame = { interval: 2, timeFrame: 'hours' };
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[0].id, twoHourTimeFrame)).to.equal(2);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[1].id, twoHourTimeFrame)).to.equal(2);
      expect(await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplications[2].id, twoHourTimeFrame)).to.equal(2);
    });
  });
});
