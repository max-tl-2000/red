/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import { expect } from 'chai';
import newId from 'uuid/v4';
import { FadvRequestTypes } from 'enums/fadvRequestTypes';
import { readFileAsString } from '../../../../../common/helpers/file';
import { fillHandlebarsTemplate } from '../../../../../common/helpers/handlebars-utils';
import loggerModule from '../../../../../common/helpers/logger';
import { handleParsedFADVResponse } from '../../../screening/fadv/screening-report-parser.ts';
import { createSubmissionResponse, createSubmissionRequest } from '../../../dal/fadv-submission-repo';
import { handleScreeningSubmitRequest } from '../v1/screening-report-request-handler';
import { updatePartyApplicationObject } from '../screening-helper';
import '../../../../../server/testUtils/setupTestGlobalContext';
import { ctx, createAPartyApplication } from '../../../test-utils/repo-helper';
import { createAPersonApplication } from '../../../test-utils/repo-helper.js';
import { setupTestQuote, createQuotePrerequisites } from '../../../../../server/testUtils/quoteApiHelper';

const logger = loggerModule.child({ subType: 'Screening Handler Test' });

describe('given FADV responses to handler for Screening handler received', () => {
  const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';

  const evaluateScenario = async scenarioFile => {
    const partyApplicationId = newId();
    // This uuid is hard-coded because of that we have XML scenarios with that id.
    const applicantId = 'e9d46f19-3534-b417-47df-17f88ed32527';
    const { tenantId } = ctx;
    await createAPartyApplication(tenantId, partyApplicationId);
    // QUESTION: why does this use same ID for both applicants?
    const applicantsIdentifiers = [`${tenantId}:${applicantId}}`, `${tenantId}:${applicantId}}`];
    const propertyId = newId();
    const personId = newId();
    const unencryptedSocSecNumber = '123456789';
    const personData = { firstName: 'Harry', lastName: 'Potter', socSecNumber: unencryptedSocSecNumber };
    const applicantData = { ...personData, personId };

    const submissionRequest = {
      partyApplicationId,
      requestType: FadvRequestTypes.NEW,
      rawRequest: '',
      propertyId,
      applicantData,
    };

    const { id: screeningRequestId } = await createSubmissionRequest(ctx, submissionRequest);
    const template = await readFileAsString(scenarioFile, BASE_PATH);
    const filledResponseTemplate = await fillHandlebarsTemplate(template, {
      applicantsIdentifiers,
      screeningRequestId,
    });
    const parsedResponse = await xml2js(filledResponseTemplate);
    const response = await handleParsedFADVResponse(ctx, parsedResponse);

    const submissionResponse = {
      submissionRequestId: screeningRequestId,
      rawResponse: filledResponseTemplate,
      applicationDecision: response.ApplicationDecision,
      applicantDecision: response.ApplicantDecision,
      externalId: response.externalId,
    };

    const submissionResponseResult = await createSubmissionResponse(ctx, submissionResponse);
    logger.trace(submissionResponseResult);

    const updatePartyApplicationObjectResult = await updatePartyApplicationObject(ctx, partyApplicationId, response);

    return updatePartyApplicationObjectResult;
  };

  it('Ann and Bob have low income and it is DENIED so the Min DeniedAt is set to 5000', async () => {
    const result = await evaluateScenario('scenario-ann-bob-denied.xml');
    expect(parseFloat(result[0].minDeniedAt)).equal(5000.0);
  });

  it('Ann and Bob have low income and it is DENIED so the Min DeniedAt is set to 4000', async () => {
    const result = await evaluateScenario('scenario-ann-bob-denied-mindeniedat.xml');
    expect(parseFloat(result[0].minDeniedAt)).equal(4000.0);
  });

  it('Ann and Bob have low income and it is APPROVED so the Max ApprovedAt is set to 1000', async () => {
    const result = await evaluateScenario('scenario-ann-bob-approved-maxapprovedat.xml');
    expect(parseFloat(result[0].maxApprovedAt)).equal(1000.0);
  });

  it('Ann and Bob have low income and it is APPROVED so the Max ApprovedAt is set to 1500', async () => {
    const result = await evaluateScenario('scenario-ann-bob-approved-maxapprovedat-1.xml');
    expect(parseFloat(result[0].maxApprovedAt)).equal(1500.0);
  });
});

describe('screening handler', () => {
  describe('handleScreeningSubmitRequest ', () => {
    // TODO refactor use mocks
    it('should return object { processed: true } ', async () => {
      try {
        const quoteData = await createQuotePrerequisites();
        const { partyMember, partyId } = await setupTestQuote(quoteData);
        const msg = { tenantId: ctx.tenantId, partyId };

        await createAPersonApplication({ firstName: 'Harry', lastName: 'Potter' }, partyMember.personId, partyId);

        const result = await handleScreeningSubmitRequest(msg);

        expect(result.processed).to.equal(true);
      } catch (e) {
        logger.error({ e }, 'Error on handleScreeningSubmitRequest');
      }
    });
  });
});
