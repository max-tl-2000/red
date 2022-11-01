/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import get from 'lodash/get';
import loggerModule from '../../../../../common/helpers/logger';
import { equalsIgnoreCase } from '../../../../../common/helpers/strings';
import { handleParsedFADVResponse } from '../../../screening/fadv/screening-report-parser.ts';
import { notify } from '../../../../../common/server/notificationClient';
import eventTypes from '../../../../../common/enums/eventTypes';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import {
  getSubmissionRequest,
  createSubmissionResponse,
  getSubmissionResponseBySubmissionRequestId,
  updateSubmissionRequest,
} from '../../../dal/fadv-submission-repo';
import { obscureApplicantProperties, maskSubmissionResponse, logMismatchedApplicants } from '../../../helpers/screening-helper';
import { performNextScreeningAction } from '../../../screening/workflow';
import { SCREENING_MESSAGE_TYPE } from '../../../../../server/helpers/message-constants';
import {
  getSubmissionRequestId,
  updatePartyApplicationObject,
  getPersonIdsByParty,
  shouldStoreScreeningResponse,
  isScreeningComplete,
  incompleteIncorrectMembersExist,
  getMismatchedApplicantsFromResponse,
  buildApplicantsToEnableSsnSubmission,
} from '../screening-helper';
import { loadPartyById } from '../../../../../server/services/party';
import { insertQuotePromotion, updateQuotePromotion } from '../../../../../server/services/quotePromotions';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';
import { ScreeningResponseOrigin } from '../../../helpers/applicant-types';
import * as eventService from '../../../../../server/services/partyEvent';
import { getPartyApplication } from '../../../dal/party-application-repo';
import { getQuoteById } from '../../../../../server/dal/quoteRepo';
import { getPropertySettings } from '../../../../../server/dal/propertyRepo';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import { runInTransaction } from '../../../../../server/database/factory';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });

export const processScreeningResponseReceived = async (ctx, screeningResponse, responseOrigin = ScreeningResponseOrigin.HTTP) => {
  logger.trace({ ctx }, 'processScreeningResponseReceived');
  if (!screeningResponse) throw new Error('missing screeningResponse!');

  try {
    const response = await handleParsedFADVResponse(ctx, screeningResponse);
    const { tenantId } = response;

    ctx.tenantId = tenantId;

    const submissionRequestId = getSubmissionRequestId(ctx, response);

    const submissionRequest = await getSubmissionRequest(ctx, submissionRequestId);
    const partyApplicationId = submissionRequest.partyApplicationId;
    logger.info({ ctx, partyApplicationId, submissionRequestId, responseOrigin }, 'Handling received response');

    const submissionResponse = {
      submissionRequestId,
      rawResponse: screeningResponse,
      applicationDecision: response.ApplicationDecision,
      applicantDecision: response.ApplicantDecision,
      externalId: response.externalId,
      status: response.Status,
      serviceStatus: response.serviceStatus || null,
      origin: responseOrigin,
    };

    if (response.criteriaResult) {
      submissionResponse.criteriaResult = response.criteriaResult;
    }

    if (response.BackgroundReport) {
      submissionResponse.backgroundReport = response.BackgroundReport;
    }

    submissionResponse.recommendations = response.recommendations || [];

    const { applicationDecision: origDecision, applicantDecision: origApplicantDecision } = submissionResponse;
    logger.trace({ ctx, origDecision, origApplicantDecision }, 'about to possibly correct status based on FADV incorrect behavior');
    if (origDecision && equalsIgnoreCase(origDecision, ScreeningDecision.PENDING) && submissionResponse.status !== FADV_RESPONSE_STATUS.INCOMPLETE) {
      // sometimes FADV sends us Complete status with a PENDING decision. We will treat
      // all pending decisions as incomplete
      logger.warn({ ctx, partyApplicationId, submissionRequestId, origStatus: submissionResponse.status }, 'forcing incomplete status for pending decision');
      submissionResponse.status = FADV_RESPONSE_STATUS.INCOMPLETE;
    }
    // CPM-20070
    // sometimes FADV sends us Complete status with a PENDING decision. We will treat
    // all pending decisions as incomplete
    if (
      submissionResponse.status === FADV_RESPONSE_STATUS.COMPLETE &&
      origApplicantDecision?.some(({ result }) => equalsIgnoreCase(result, ScreeningDecision.PENDING))
    ) {
      logger.warn(
        { ctx, partyApplicationId, submissionRequestId, origApplicantDecision, origStatus: submissionResponse.status },
        'forcing incomplete status and pending decision for pending applicantDecision',
      );
      submissionResponse.status = FADV_RESPONSE_STATUS.INCOMPLETE;
      submissionResponse.applicationDecision = ScreeningDecision.PENDING;
    }

    const includeOnlyComplete = false;
    const lastStoredResponse = await getSubmissionResponseBySubmissionRequestId(ctx, submissionRequestId, includeOnlyComplete);

    logger.trace({ ctx, tenantId, submissionRequestId, lastStoredResponse: !!lastStoredResponse }, 'processScreeningResponseReceived maybe storing response');

    const { partyId } = await getPartyApplication(ctx, partyApplicationId);
    // applicants should not normally be empty, but it is during some integration tests
    const { applicantData: { applicants } = {} } = submissionRequest;
    const isResponseWithIncompleteIncorrectMembers = incompleteIncorrectMembersExist(ctx, partyId, applicants, submissionResponse);

    if (isResponseWithIncompleteIncorrectMembers) {
      logger.error({ ctx, submissionRequestId, origResponseStatus: submissionResponse.status }, 'updating complete status due to incorrect members');
      submissionResponse.status = FADV_RESPONSE_STATUS.INCOMPLETE_INCORRECT_MEMBERS;
    }

    // Storing responses on closed parties until we get a Complete one.
    const party = await loadPartyById(ctx, partyId);

    const isClosedPartyWithCompleteResponse = party.endDate && lastStoredResponse && lastStoredResponse.status === FADV_RESPONSE_STATUS.COMPLETE;

    if (isClosedPartyWithCompleteResponse) {
      logger.info(
        { ctx, partyApplicationId, submissionRequestId, partyId },
        'Screening request has already a complete response for the closed party, so doing nothing',
      );
      return { processed: true };
    }

    if (!shouldStoreScreeningResponse(ctx, { submissionRequestId, submissionResponse, lastStoredResponse })) {
      logger.info({ ctx, partyApplicationId, submissionRequestId }, 'Screening request has already a response with the same data, so doing nothing');
      return { processed: true };
    }

    const submissionResponseResult = await createSubmissionResponse(ctx, submissionResponse);
    logger.trace({ ctx }, 'processScreeningResponseReceived created response entity');
    const fadvRequestLog = pick(submissionResponseResult, [
      'id',
      'submissionRequestId',
      'applicationDecision',
      'applicantDecision',
      'recommendations',
      'externalId',
      'status',
      'origin',
    ]);

    logger.trace({ ctx, ...obscureApplicantProperties(fadvRequestLog) }, 'processScreeningResponseReceived response');

    await logMismatchedApplicants(ctx, partyId, submissionResponse.externalId, getMismatchedApplicantsFromResponse(ctx, submissionResponse, applicants));

    const [updatePartyApplicationObjectResult] = await updatePartyApplicationObject(ctx, partyApplicationId, response);

    logger.trace({ ctx, updatePartyApplicationObjectResult }, 'Update party application result');

    const personIds = await getPersonIdsByParty(tenantId, partyId);

    notify({
      ctx,
      event: eventTypes.APPLICATION_UPDATED,
      data: { partyId, personIds }, // [RR] QQ: isn't here missing the applicationId?
      routing: { teams: party.teams },
    });

    if (lastStoredResponse && (await isScreeningComplete(ctx, partyId, submissionRequest.applicantData, lastStoredResponse))) {
      logger.debug({ ctx, submissionRequestId }, 'already have a complete response, so not calling performNextScreeningAction');
      return { processed: true };
    }

    const ssnSubmissionBuilder = await buildApplicantsToEnableSsnSubmission(ctx, screeningResponse);
    if (submissionResponse.status === FADV_RESPONSE_STATUS.COMPLETE) {
      await updateSubmissionRequest(ctx, submissionRequestId, {
        completeSubmissionResponseId: submissionResponseResult.id,
      });

      !ssnSubmissionBuilder.enableSsnSubmission &&
        (await performNextScreeningAction(ctx, { tenantId, partyId }, { eventType: SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_RECEIVED }));
    }

    if (ssnSubmissionBuilder.enableSsnSubmission) {
      await ssnSubmissionBuilder.updateApplicants();
      await performNextScreeningAction(ctx, { tenantId, partyId, automaticallySubmission: true }, { eventType: SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED });
    }

    const propertySettings = party.assignedPropertyId && (await getPropertySettings(ctx, party.assignedPropertyId));
    if (propertySettings?.applicationReview?.sendAALetterOnDecline && submissionResponseResult.applicationDecision === ScreeningDecision.DECLINED) {
      logger.trace({ ctx, submissionRequestId, partyId: party.id }, 'Declining application and creating the contact party task');
      const quote = await getQuoteById(ctx, submissionRequest.quoteId);

      const leaseTermId = quote.publishedQuoteData.leaseTerms.length ? quote.publishedQuoteData.leaseTerms[0].id : null;
      const quotePromotion = {
        partyId: party.id,
        quoteId: quote.id,
        leaseTermId,
        promotionStatus: DALTypes.PromotionStatus.CANCELED,
      };

      const conditions = {
        additionalNotes: 'Auto declined based on screening result',
        leaseTermsLength: submissionRequest.rentData.leaseTermMonths,
        unit: get(quote, 'inventory.fullQualifiedName', ''),
        skipEmail: true,
        createDeclinedTask: true,
      };

      await runInTransaction(async trx => {
        const innerCtx = { ...ctx, trx };
        const promotion = await insertQuotePromotion(innerCtx, quotePromotion, false, conditions);
        await updateQuotePromotion(innerCtx, partyId, promotion.quotePromotion.id, DALTypes.PromotionStatus.CANCELED, conditions);
      });
    }

    await eventService.saveScreeningResponseProcessedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id,
    });

    logger.trace({ ctx, updatePartyApplicationObjectResult }, 'processScreeningResponseReceived processing complete');
    return { processed: true };
  } catch (err) {
    const { rawResponse: maskedRawResponse } = (screeningResponse && maskSubmissionResponse({ rawResponse: { ...screeningResponse } })) || {};
    logger.error({ err, ctx, maskedRawResponse }, 'processScreeningResponseReceived processing failed');
    throw err;
  }
};
