/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { setupTestQuote, createQuotePrerequisites, pricingSetting } from '../../../../../server/testUtils/quoteApiHelper';
import {
  ctx,
  createAPartyApplication,
  createAPersonApplication,
  createASubmissionRequest,
  createASubmissionResponse,
} from '../../../test-utils/repo-helper.js';
import { handlePollScreeningUnreceivedResponses, getScreeningOptions } from '../v1/screening-report-request-handler';
import { getAllScreeningResultsForParty } from '../../../services/screening';
import { waitForQueueIdle } from '../../../../../server/testUtils/queueHelper';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';

const createSubmissionRequest = ({ partyApplicationId, transactionNumber, personId, propertyId }) => {
  const submissionRequest = {
    partyApplicationId,
    rawRequest: '',
    propertyId,
    applicantData: {
      tenantId: ctx.tenantId,
      partyApplicationId,
      applicants: [
        {
          type: 'Applicant',
          email: 'harry@reva.tech',
          dateOfBirth: '1988-01-01',
          firstName: 'Harry',
          lastName: 'Potter',
          personId,
          address: {
            enteredByUser: {
              city: 'Los Angeles',
              line1: 'Line 1',
              state: 'CA',
              address: 'Address',
              postalCode: '12345',
              unparsedAddress: 'unparsedAddress',
            },
          },
          grossIncome: '100000',
          grossIncomeFrequency: 'YEARLY',
          applicantId: newId(),
        },
      ],
    },
    isAlerted: true,
    isObsolete: false,
    transactionNumber,
    rentData: { rent: 5428, deposit: 0, leaseTermMonths: 12 },
  };
  return createASubmissionRequest(submissionRequest);
};

const createSubsmissionResponse = async (screeningRequestId, applicationDecision, status) => {
  const submissionResponse = {
    submissionRequestId: screeningRequestId,
    rawResponse: {},
    applicationDecision,
    applicantDecision: [],
    externalId: '12345',
    status,
  };

  return await createASubmissionResponse(submissionResponse);
};

describe('screening handler request', () => {
  describe('handlePollScreeningUnreceivedResponses ', () => {
    describe('when there is a request with transaction number without response', () => {
      it('should get a response from screening provider', async () => {
        const propertySettings = { screening: { propertyName: '123' }, lease: { propertyName: '123' }, ...pricingSetting };
        const quoteData = await createQuotePrerequisites(propertySettings);
        const { partyMember, partyId, property } = await setupTestQuote(quoteData);
        const msg = { tenantId: ctx.tenantId, partyId };

        const partyApplication = await createAPartyApplication(partyId, newId());
        await createAPersonApplication({ firstName: 'Harry', lastName: 'Potter' }, partyMember.personId, partyId, partyApplication.id);
        await createSubmissionRequest({
          partyApplicationId: partyApplication.id,
          transactionNumber: 123,
          personId: partyMember.personId,
          propertyId: property.id,
        });

        const result = await handlePollScreeningUnreceivedResponses(msg);
        await waitForQueueIdle();
        const { screeningResults } = await getAllScreeningResultsForParty(ctx, partyId, { excludeObsolete: true });
        expect(result.processed).to.equal(true);
        expect(screeningResults).to.have.lengthOf(1);
      });
    });
  });

  describe('getScreeningOptions', () => {
    describe('when lastest response is a pending/incomplete', () => {
      it('should push NEW fadv request if requestedType is modify', async () => {
        const propertySettings = { screening: { propertyName: '123' }, lease: { propertyName: '123' }, ...pricingSetting };
        const quoteData = await createQuotePrerequisites(propertySettings);
        const { partyMember, partyId, property } = await setupTestQuote(quoteData);

        const partyApplication = await createAPartyApplication(partyId, newId());
        await createAPersonApplication({ firstName: 'Harry', lastName: 'Potter' }, partyMember.personId, partyId, partyApplication.id);
        const { id: submissionRequestId } = await createSubmissionRequest({
          partyApplicationId: partyApplication.id,
          transactionNumber: 123,
          personId: partyMember.personId,
          propertyId: property.id,
        });
        await createSubsmissionResponse(submissionRequestId, ScreeningDecision.PENDING, FADV_RESPONSE_STATUS.INCOMPLETE);
        const screeningOptions = await getScreeningOptions(ctx, { partyId, inactiveMembers: [], partyMembers: [] });

        // MODIFY request type is assumed if not specified via screeningTypeRequested
        expect(screeningOptions.requestType).to.equal(FadvRequestTypes.NEW);
      });
      it('should not change the request type if requestedType is RESET_CREDIT', async () => {
        const propertySettings = { screening: { propertyName: '123' }, lease: { propertyName: '123' }, ...pricingSetting };
        const quoteData = await createQuotePrerequisites(propertySettings);
        const { partyMember, partyId, property } = await setupTestQuote(quoteData);

        const partyApplication = await createAPartyApplication(partyId, newId());
        await createAPersonApplication({ firstName: 'Harry', lastName: 'Potter' }, partyMember.personId, partyId, partyApplication.id);
        const { id: submissionRequestId } = await createSubmissionRequest({
          partyApplicationId: partyApplication.id,
          transactionNumber: 123,
          personId: partyMember.personId,
          propertyId: property.id,
        });
        await createSubsmissionResponse(submissionRequestId, ScreeningDecision.PENDING, FADV_RESPONSE_STATUS.INCOMPLETE);
        const screeningOptions = await getScreeningOptions(ctx, {
          partyId,
          screeningTypeRequested: FadvRequestTypes.RESET_CREDIT,
          inactiveMembers: [],
          partyMembers: [],
        });
        expect(screeningOptions.requestType).to.equal(FadvRequestTypes.RESET_CREDIT);
      });
    });
    describe('when lastest response is complete', () => {
      it('should push a MODIFY fadv request', async () => {
        const propertySettings = { screening: { propertyName: '123' }, lease: { propertyName: '123' }, ...pricingSetting };
        const quoteData = await createQuotePrerequisites(propertySettings);
        const { partyMember, partyId, property } = await setupTestQuote(quoteData);

        const partyApplication = await createAPartyApplication(partyId, newId());
        await createAPersonApplication({ firstName: 'Harry', lastName: 'Potter' }, partyMember.personId, partyId, partyApplication.id);
        const { id: submissionRequestId } = await createSubmissionRequest({
          partyApplicationId: partyApplication.id,
          transactionNumber: 123,
          personId: partyMember.personId,
          propertyId: property.id,
        });
        await createSubsmissionResponse(submissionRequestId, ScreeningDecision.APPROVED, FADV_RESPONSE_STATUS.COMPLETE);
        const screeningOptions = await getScreeningOptions(ctx, { partyId, inactiveMembers: [], partyMembers: [] });
        expect(screeningOptions.requestType).to.equal('Modify');
      });
    });
  });
});
