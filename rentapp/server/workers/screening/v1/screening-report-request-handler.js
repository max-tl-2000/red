/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partition from 'lodash/partition';
import meanBy from 'lodash/meanBy';
import sumBy from 'lodash/sumBy';
import get from 'lodash/get';
import { mapSeries } from 'bluebird';

import loggerModule from '../../../../../common/helpers/logger';
import { loadPartyMembers } from '../../../../../server/services/party';
import { getPartyApplicationByPartyId as getPartyApplicationByPartyIdInDAL } from '../../../dal/party-application-repo';
import { getPersonApplicationByPersonIdAndPartyApplicationId } from '../../../services/person-application';
import { obscureApplicantProperties, parsePartyApplicants, getApplicantsFormattedFullname } from '../../../helpers/screening-helper';

import {
  getAllScreeningResultsForParty,
  getOrphanedScreeningRequests,
  markAllScreeningRequestsForPartyAsObsolete,
  getStuckSubmissionRequests,
  getScreeningRequest,
} from '../../../services/screening';
import {
  getRentData,
  getApplicants,
  getPropertyIncomePolicies,
  getScreeningPropertyId,
  getScreeningUnitAddress,
  checkApplicantsRoleChange,
  checkApplicantsRemoved,
} from '../screening-helper';
import { postRawRequestToScreeningProvider } from '../screening-provider-integration';
import { postToScreeningProvider } from '../screening-provider-integration-handler';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import {
  updateSubmissionRequest,
  getAmountOfNewSubmissionRequestsByPartyApplication,
  getLastSubmissionRequestsByPartyApplication,
  getSubmissionRequest,
  getPreviousSubmissionResponse,
} from '../../../dal/fadv-submission-repo';
import { FADV_RESPONSE_STATUS, FADV_ERROR_DESCRIPTION, PARSE_ERROR } from '../../../../common/screening-constants';
import { NoRetryError } from '../../../../../server/common/errors';
import config from '../../../../config';
import { logCtx } from '../../../../../common/helpers/logger-utils';
import { notify } from '../../../../../common/server/notificationClient';
import eventTypes from '../../../../../common/enums/eventTypes';
import { shouldReplaceApplicantsIntlAddrWithPropertyAddr as shouldReplaceApplicantsIntlAddrWithPropertyAddrFunc } from '../../../screening/screening-helper';
import { sendStuckRequestDetectedMessage } from '../../../../../server/helpers/notifications';
import { isPartyLevelGuarantor } from '../../../../../server/services/party-settings';
import { getScreeningRequestType } from '../screening-handler-request.ts';
import { areAllGuarantorsLinkedToMembers } from '../../../../../common/helpers/guarantors-check';
import { processScreeningResponseReceived } from './screening-report-response-handler';
import { handleScreeningSubmitViewRequestReceived } from '../helpers/screening-report-request-handler-helper';
import { prepareRawRequestForFadv } from '../../../helpers/fadv-helper';
import { SCREENING_MESSAGE_TYPE } from '../../../../../server/helpers/message-constants';
import { handleParsedFADVResponse } from '../../../screening/fadv/screening-report-parser.ts';
import { execConcurrent } from '../../../../../common/helpers/exec-concurrent';
import { logEntity } from '../../../../../server/services/activityLogService';
import { COMPONENT_TYPES, SUB_COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../../../common/enums/activityLogTypes';
import { handleFADVResponseError } from '../helpers/screening-report-response-handler-helper';
import { PARSE_EXCEPTION } from '../../../../../common/helpers/postXML';

const { ScreeningProviderMode } = DALTypes;

const logger = loggerModule.child({ subType: 'Application Screening Handler' });
const decryptSsn = true;

const shouldHandleScreeningResponse = (screeningMode = ScreeningProviderMode.FAKE) => screeningMode === ScreeningProviderMode.FAKE;

const isAddressUnparsableError = errorDescription => {
  const addressUnparsableExpression = new RegExp(`^${FADV_ERROR_DESCRIPTION.WRONG_ADDRESS}.*`, 'i');
  return addressUnparsableExpression.test(errorDescription);
};

const handleScreeningResponseWithError = async (ctx, response, screeningRequestId) => {
  const responseNode = response.ApplicantScreening?.Response[0];

  const fadvError = isAddressUnparsableError(responseNode?.ErrorDescription[0]) ? ScreeningDecision.ERROR_ADDRESS_UNPARSABLE : ScreeningDecision.ERROR_OTHER;

  await handleFADVResponseError(ctx, response, fadvError, { screeningRequestId });
  return fadvError;
};

const handleImmediateResponse = async (ctx, response, screeningRequestId, status, screeningMode = ScreeningProviderMode.FAKE) => {
  logger.info({ ctx, screeningRequestId, screeningStatus: status }, 'handleImmediateScreeningResponse Sending response from FADV as a posted notification');

  try {
    if (shouldHandleScreeningResponse(screeningMode)) {
      logger.trace({ ctx, screeningRequestId }, 'handleImmediateScreeningResponse calling responseReceived handler');
      await processScreeningResponseReceived(ctx, response);
    } else {
      const request = (await getSubmissionRequest(ctx, screeningRequestId)) || {};
      if (!response) {
        logger.trace(
          {
            ctx,
            submissionResponse: {
              requestId: screeningRequestId,
              status,
              quoteId: request.quoteId,
              requestOrigin: request.origin,
              partyApplicationId: request.partyApplicationId,
            },
          },
          'Skipping handling of immediate response',
        );
        return;
      }
      const responseNode = response.ApplicantScreening?.Response[0];

      const responseInfo = {
        requestId: screeningRequestId,
        reportId: responseNode.RequestID_Returned[0],
        status,
        quoteId: request.quoteId,
        requestOrigin: request.origin,
        partyApplicationId: request.partyApplicationId,
      };
      if (status === FADV_RESPONSE_STATUS.ERROR) {
        const fadvError = await handleScreeningResponseWithError(ctx, response, screeningRequestId);
        responseInfo.errorResponse = responseNode;
        responseInfo.applicationDecision = fadvError;
      } else {
        const parsedResponse = await handleParsedFADVResponse(ctx, response);

        responseInfo.applicationDecision = parsedResponse?.ApplicationDecision;
        responseInfo.serviceStatus = parsedResponse?.serviceStatus;
      }

      logger.trace({ ctx, submissionResponse: responseInfo }, 'Skipping handling of immediate response');
    }
  } catch (err) {
    logger.error({ ctx, screeningRequestId, err }, 'unable to process immediate response!');
    throw err;
  }
};

// This function is used for cases when the response to the request contains usable data
// response is the parsed Response node from FADV
export const handleImmediateScreeningResponse = async (ctx, { response, screeningRequestId }, screeningMode = ScreeningProviderMode.FAKE) => {
  const responseNode = response.ApplicantScreening.Response[0];
  const status = responseNode.Status[0];
  logger.trace({ ctx, screeningRequestId, responseStatus: status }, 'handleImmediateScreeningResponse');

  const hadScreeningResult = status === FADV_RESPONSE_STATUS.COMPLETE;

  const shouldUpdateRequest = [FADV_RESPONSE_STATUS.COMPLETE, FADV_RESPONSE_STATUS.INCOMPLETE].indexOf(status) >= 0 && responseNode.TransactionNumber?.[0];

  if (shouldUpdateRequest) {
    logger.trace({ ctx, screeningRequestId, responseStatus: status }, 'handleImmediateScreeningResponse updating request with transactionNumber');
    await updateSubmissionRequest(ctx, screeningRequestId, {
      transactionNumber: responseNode.TransactionNumber[0],
      requestEndedAt: new Date(),
      requestResult: {
        hadScreeningResult,
      },
    });
  } else {
    logger.error({ ctx, screeningRequestId, screeningResponse: response }, 'missing transaction number on screening response');
  }
  await handleImmediateResponse(ctx, response, screeningRequestId, status, screeningMode);
};

const hasValidApplicationDecision = ({ applicationDecision }) => {
  const invalidScreeningDecisions = [ScreeningDecision.ERROR_ADDRESS_UNPARSABLE, ScreeningDecision.ERROR_OTHER];
  return invalidScreeningDecisions.indexOf(applicationDecision) === -1;
};

const getLatestScreening = async (ctx, partyId) => {
  const options = { filterExpiredApplications: true, excludeObsolete: false };
  const { screeningResults = [] } = await getAllScreeningResultsForParty(ctx, partyId, options);
  const screeningResultsWithoutErrors = screeningResults.filter(screeningResult => hasValidApplicationDecision(screeningResult));
  return screeningResultsWithoutErrors[0] || {};
};

const getRoommatesCombinedIncomeAverage = partyMemberAndPersonApplicationList => {
  const roommates = partyMemberAndPersonApplicationList.filter(({ partyMember }) => partyMember.memberType === DALTypes.MemberType.RESIDENT);
  return meanBy(roommates, 'personApplication.applicationData.grossIncomeMonthly');
};

// TODO: move policy stuff to its own module
const applyPolicyIncomeAmount = (personApplication, policyIncomeAmount) => {
  const originalGrossIncomeMonthly = personApplication.applicationData.grossIncomeMonthly;
  const grossIncomeMonthly = policyIncomeAmount;
  personApplication.applicationData = {
    ...personApplication.applicationData,
    originalGrossIncomeMonthly,
    grossIncomeMonthly,
  };
};

const applyRoommatesIncomePolicy = (roommatesIncomePolicy, partyMemberAndPersonApplicationList) => {
  if (roommatesIncomePolicy !== DALTypes.IncomePolicyRoommates.COMBINED) return;

  const roommatesCombinedIncomeAverage = getRoommatesCombinedIncomeAverage(partyMemberAndPersonApplicationList);

  partyMemberAndPersonApplicationList.forEach(({ partyMember, personApplication }) => {
    if (partyMember.memberType !== DALTypes.MemberType.RESIDENT) return;
    applyPolicyIncomeAmount(personApplication, roommatesCombinedIncomeAverage);
  });
};

const applyGuarantorsProratedIncome = (guarantors, numRoommates, partyMemberAndPersonApplicationList) => {
  const numGuarantors = guarantors.length;
  if (numGuarantors === 1) return;

  const firstGuarantorId = guarantors[0].partyMember.id;
  const guarantorsIncomeTotal = sumBy(guarantors, 'personApplication.applicationData.grossIncomeMonthly');
  const firstGuarantorIncome = guarantorsIncomeTotal * ((numRoommates - numGuarantors + 1) / numRoommates);
  const otherGuarantorsIncome = (guarantorsIncomeTotal - firstGuarantorIncome) / (numGuarantors - 1);

  partyMemberAndPersonApplicationList.forEach(({ partyMember, personApplication }) => {
    if (partyMember.memberType !== DALTypes.MemberType.GUARANTOR) return;

    if (partyMember.id === firstGuarantorId) {
      applyPolicyIncomeAmount(personApplication, firstGuarantorIncome);
      return;
    }

    applyPolicyIncomeAmount(personApplication, otherGuarantorsIncome);
  });
};

const linkGuarantorsToRoommates = (guarantors, numRoommates, partyMemberAndPersonApplicationList) => {
  const numGuarantors = guarantors.length;

  const numFirstGuarantorRoommates = numRoommates - numGuarantors + 1;
  const firstGuarantorId = guarantors[0].partyMember.id;
  let guarantorsIndex = 0;
  let residentsIndex = 0;

  partyMemberAndPersonApplicationList.forEach(({ partyMember }) => {
    if (partyMember.memberType !== DALTypes.MemberType.RESIDENT) return;

    if (residentsIndex < numFirstGuarantorRoommates) {
      partyMember.guaranteedBy = firstGuarantorId;
      residentsIndex++;
      return;
    }
    guarantorsIndex++;
    partyMember.guaranteedBy = guarantors[guarantorsIndex].partyMember.id;
  });
};

const applyGuarantorsIncomePolicy = (guarantorsIncomePolicy, partyMemberAndPersonApplicationList) => {
  if (guarantorsIncomePolicy !== DALTypes.IncomePolicyGuarantors.PRORATED_POOL) return;

  const guarantors = partyMemberAndPersonApplicationList.filter(x => x.partyMember.memberType === DALTypes.MemberType.GUARANTOR);
  if (!guarantors.length) return;

  const numRoommates = partyMemberAndPersonApplicationList.filter(x => x.partyMember.memberType === DALTypes.MemberType.RESIDENT).length;

  linkGuarantorsToRoommates(guarantors, numRoommates, partyMemberAndPersonApplicationList);

  applyGuarantorsProratedIncome(guarantors, numRoommates, partyMemberAndPersonApplicationList);
};

export const applyIncomePolicies = async (ctx, propertyId, partyMemberAndPersonApplicationList) => {
  const { incomePolicyRoommates, incomePolicyGuarantors } = await getPropertyIncomePolicies(ctx, propertyId);

  applyRoommatesIncomePolicy(incomePolicyRoommates, partyMemberAndPersonApplicationList);
  applyGuarantorsIncomePolicy(incomePolicyGuarantors, partyMemberAndPersonApplicationList);
};

const checkForLastIncompleteResponse = latestScreening => {
  const { status, applicationDecision } = latestScreening;
  return applicationDecision === ScreeningDecision.SCREENING_IN_PROGRESS && status === FADV_RESPONSE_STATUS.INCOMPLETE;
};

// TODO: rename to shouldRequestNewScreening
const isForceNewScreeningRequested = (screeningTypeRequested, partyMembers, inactiveMembers, latestScreening = {}) => {
  if (screeningTypeRequested === FadvRequestTypes.NEW || !latestScreening.transactionNumber) return true;

  // A check on the role here as well because of the case where the role changed from Resident to Guarantor a link a to resident is needed before a new screening,
  // that triggers an members_changed event after the applicant_data_updated event.
  const applicants = get(latestScreening, 'applicantData.applicants', []);
  if (checkApplicantsRoleChange(partyMembers, applicants) || checkApplicantsRemoved(inactiveMembers, applicants)) return true;

  return screeningTypeRequested !== FadvRequestTypes.RESET_CREDIT && checkForLastIncompleteResponse(latestScreening);
};

export const getScreeningOptions = async (ctx, { partyId, screeningTypeRequested, inactiveMembers, partyMembers }) => {
  const screeningOptions = { storeRequest: true, requestType: getScreeningRequestType(screeningTypeRequested, FadvRequestTypes.NEW) };
  // TODO: does this require property too?  Can screenings occur under multiple properties?
  // TODO: rename to latestScreeningResponse
  const latestScreening = await getLatestScreening(ctx, partyId);
  logger.trace({ ctx, partyId, latestScreeningId: (latestScreening || {}).id }, 'Latest Screening');

  const forceNewScreeningRequested = isForceNewScreeningRequested(screeningTypeRequested, partyMembers, inactiveMembers, latestScreening);
  if (forceNewScreeningRequested) {
    return {
      ...screeningOptions,
      requestType: FadvRequestTypes.NEW,
    };
  }

  logger.trace({ ctx, partyId, transactionNumber: latestScreening.transactionNumber }, 'got previous screening');

  return {
    ...screeningOptions,
    reportId: latestScreening.transactionNumber,
    requestType: getScreeningRequestType(screeningTypeRequested, FadvRequestTypes.MODIFY),
  };
};

/* Returns the data needed to request screening for the provided party and (optional) rentData.
This includes determining if the request is New or Modified, and validating that conditions
for screening (e.g. all guarantors have residents assigned).
TODO: reduce logic in this function, rename to getDataForScreeningSubmission
*/
const getScreeningData = async (ctx, partyId, rentData, screeningTypeRequested) => {
  logger.trace({ ctx, partyId, rentData, screeningTypeRequested }, 'getScreeningData');

  // if not provided, get rentData using published quotes or property rent data
  if (!rentData) rentData = await getRentData(ctx, partyId);

  logger.trace({ ctx, partyId, rentData }, 'getScreeningData back from getting rentData');

  // TODO: decompose this into validateParyMembers
  const allPartyMembers = await loadPartyMembers(ctx, partyId, { excludeInactive: false, orderBy: 'created_at', sortOrder: 'asc' });
  const [inactiveMembers, partyMembers] = partition(allPartyMembers, 'endDate');

  if (!partyMembers || partyMembers.length === 0) {
    const errorMsg = `There is no party members for partyId: ${partyId}`;
    logger.error({ partyId }, errorMsg);
    throw new NoRetryError(errorMsg);
  }

  if (partyMembers.some(item => item == null || !item.personId)) {
    const errorMsg = `Invalid partyMembers for partyId: ${partyId}`;
    logger.error({ partyId }, errorMsg);
    throw new NoRetryError(errorMsg);
  }

  // TODO: decompose this into validateGuarantorsHaveResidentsAssigned
  if (!(await isPartyLevelGuarantor(ctx)) && !areAllGuarantorsLinkedToMembers(partyMembers)) {
    const errorMsg = 'There are guarantors without relationship';
    logger.error({ partyId }, errorMsg);
    throw new NoRetryError(errorMsg);
  }

  logger.trace({ ctx, partyId, rentData }, 'getScreeningData fetching person apps');
  /* TODO: decompose this */
  const partyApplication = await getPartyApplicationByPartyIdInDAL(ctx, partyId);
  const partyMemberAndPersonApplicationList = await execConcurrent(partyMembers, async partyMember => {
    const personApplication = await getPersonApplicationByPersonIdAndPartyApplicationId(ctx, partyMember.personId, partyApplication.id, { maskSsn: false });
    return {
      partyMember,
      personApplication,
    };
  });

  if (partyMemberAndPersonApplicationList.some(({ personApplication }) => personApplication == null)) {
    const errorMsg = `Some members of partyId: ${partyId} do not have person application information`;
    logger.error({ ctx, partyId }, errorMsg);
    throw new NoRetryError(errorMsg);
  }

  const screeningOptions = await getScreeningOptions(ctx, { partyId, screeningTypeRequested, inactiveMembers, partyMembers });
  const propertyId = await getScreeningPropertyId(ctx, { partyId, leaseNameId: rentData.leaseNameId });
  await applyIncomePolicies(ctx, propertyId, partyMemberAndPersonApplicationList);

  const shouldReplaceApplicantsIntlAddrWithPropertyAddr = shouldReplaceApplicantsIntlAddrWithPropertyAddrFunc(partyMemberAndPersonApplicationList);
  const unitAddress = shouldReplaceApplicantsIntlAddrWithPropertyAddr ? await getScreeningUnitAddress(ctx, { propertyId }) : null;

  const applicantData = {
    partyApplicationId: partyMemberAndPersonApplicationList[0].personApplication.partyApplicationId,
    tenantId: ctx.tenantId,
    applicants: getApplicants(ctx, {
      partyMemberAndPersonApplicationList,
      unitAddress,
      options: { shouldReplaceApplicantsIntlAddrWithPropertyAddr },
    }),
  };

  const screeningData = {
    rentData,
    propertyId,
    applicantData,
  };

  logger.trace({ ctx, ...obscureApplicantProperties(screeningData), screeningOptions }, 'got screening data');

  return { screeningData, screeningOptions };
};

const canCreateNewScreeningRequest = async (ctx, partyId, eventType) => {
  let canCreateNewRequest = true;
  const { newRequestThreshold } = config.fadv;

  const { id: partyApplicationId, overrideNewCountChecks } = await getPartyApplicationByPartyIdInDAL(ctx, partyId);

  const amountOfNewSubmissionRequests = await getAmountOfNewSubmissionRequestsByPartyApplication(ctx, partyApplicationId);
  let hasReachedNewRequestLimit = amountOfNewSubmissionRequests >= newRequestThreshold;

  const loggingData = { ctx, partyId, partyApplicationId, amountOfNewSubmissionRequests, newRequestThreshold, hasReachedNewRequestLimit, eventType };
  logger.trace(loggingData, 'Checking if a new submission request can be performed');

  if (overrideNewCountChecks && hasReachedNewRequestLimit) {
    hasReachedNewRequestLimit = !overrideNewCountChecks;
  }

  // only allow a maximum of 3 consecutive new requests for stuck_request_detected eventType
  if (!hasReachedNewRequestLimit && eventType === SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED) {
    const latestRequests = await getLastSubmissionRequestsByPartyApplication(ctx, partyApplicationId, { limit: 3 });
    if (latestRequests.length >= 3) {
      const allPrevRequestsAreStuckNews = latestRequests.every(
        ({ requestType, origin }) => requestType === FadvRequestTypes.NEW && origin === SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED,
      );
      canCreateNewRequest = !allPrevRequestsAreStuckNews;
      !canCreateNewRequest && logger.warn(loggingData, 'The party has reached the maximum number of consecutive new submission requests for a stuck request');
    }
  }

  if (hasReachedNewRequestLimit) {
    canCreateNewRequest = false;
    logger.warn(loggingData, 'The party has reached the maximum amount of new submission requests in a 1 hour time frame');
  }

  return canCreateNewRequest;
};

/**
 * Handler for screening submit request
 *
 *   @param msg.tenantId {Guid} Tenant id
 *   @param msg.partyId {Guid} Party id
 *   @param msg.rentData {Object} if empty get quotes from party, use most expensive quote
 *    @param msg.rentData {Object}
 *    @param msg.rentData.monthlyRent {Number} rent
 *    @param msg.rentData.leaseMonths {Number} number of months
 *    @param msg.rentData.deposit {Number} deposit
 * @return {Object} return { processed: true } when it is handled correctly
 *                  { processed: false } when there is an error
 */

const uncheckedHandleScreeningSubmitRequest = async msg => {
  const { rentData, screeningTypeRequested, partyId, eventType, ...ctx } = msg;
  logger.trace({ ctx, rentData, screeningTypeRequested, partyId, eventType }, 'handleScreeningSubmitRequest');
  if (!partyId) {
    const errorMsg = 'PartyId is missing or empty';
    logger.error({ ...msg }, errorMsg);
    throw new NoRetryError(msg);
  }

  const { screeningData, screeningOptions } = await getScreeningData(ctx, partyId, rentData, screeningTypeRequested);
  logger.trace({ ...logCtx(msg), partyId }, 'uncheckedHandleScreeningSubmitRequest got screening data');

  try {
    if (screeningOptions.requestType === FadvRequestTypes.NEW) {
      if (await canCreateNewScreeningRequest(ctx, partyId, eventType)) {
        await markAllScreeningRequestsForPartyAsObsolete(ctx, partyId);
      } else {
        return { processed: true };
      }
    }

    const { response, screeningRequestId, screeningMode } = await postToScreeningProvider(
      ctx,
      screeningData.propertyId,
      screeningData.rentData,
      screeningData.applicantData,
      { ...screeningOptions, eventType },
    );

    if (eventType === SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED) {
      const previousResponse = (await getPreviousSubmissionResponse(ctx, partyId, screeningRequestId)) || {};
      const screeningApplicants = screeningData?.applicantData?.applicants;
      const partyApplicants = await parsePartyApplicants(ctx, partyId, screeningApplicants);

      await logEntity(ctx, {
        entity: {
          id: partyId,
          previousApplicationStatus: previousResponse.status,
          residents: getApplicantsFormattedFullname(partyApplicants.residents),
          guarantors: getApplicantsFormattedFullname(partyApplicants.guarantors),
        },
        activityType: ACTIVITY_TYPES.UPDATE,
        component: COMPONENT_TYPES.PARTY,
        subComponent: SUB_COMPONENT_TYPES.RESCREENING,
      });
    }

    const personIds = screeningData.applicantData.applicants.map(applicant => applicant.personId);
    notify({
      ctx,
      event: eventTypes.APPLICATION_UPDATED,
      data: { partyId, personIds }, // [RR] QQ: isn't here missing the applicationId?
    });

    logger.trace({ ctx, partyId }, 'uncheckedHandleScreeningSubmitRequest about to handle immediate response');
    await handleImmediateScreeningResponse(
      ctx,
      {
        response,
        screeningRequestId,
        applicantData: screeningData.applicantData,
      },
      screeningMode,
    );
  } catch (err) {
    logger.error({ err, ctx, partyId, propertyId: screeningData.propertyId }, 'Unable to post message to screening provider');
    if (err.msg === PARSE_EXCEPTION || err.token === PARSE_ERROR) {
      await handleFADVResponseError(ctx, err.data, ScreeningDecision.ERROR_RESPONSE_UNPARSABLE, { screeningRequestId: err.screeningRequestId });
      return { processed: true };
    }

    /* We do not retry here because we do not want to dead-letter in the event of a transient error.
    Instead, we will allow the polling job to actively retry */
    throw new NoRetryError(err);
  }

  return { processed: true };
};

export const handleScreeningSubmitRequest = async amqMsg => {
  try {
    return await uncheckedHandleScreeningSubmitRequest(amqMsg);
  } catch (err) {
    logger.error({ ...logCtx(amqMsg), amqMsg, err }, 'Unexpected error handling screening request');
    return { processed: true };
  }
};

export const handleScreeningResubmitRequest = async msg => {
  const { screeningRequestId, ctx } = msg;
  logger.debug({ ctx, screeningRequestId }, 'handleScreeningResubmitRequest');

  const screeningRequest = await getScreeningRequest(ctx, screeningRequestId, decryptSsn);
  const applicantData = screeningRequest.applicantData;

  try {
    const rawRequest = await prepareRawRequestForFadv(ctx, screeningRequest, applicantData);
    const { response } = await postRawRequestToScreeningProvider(ctx, {
      screeningRequestId,
      payload: rawRequest,
    });
    await handleImmediateScreeningResponse(ctx, {
      response,
      screeningRequestId,
      applicantData,
    });
  } catch (err) {
    logger.error({ err, ctx, screeningRequestId }, 'Unable to post message to screening provider');
    throw new Error('Unable to post message to screening provider');
  }
};

const handlePollOrphanedRequests = async ctx => {
  logger.trace({ ctx }, 'handlePollOrphanedRequests');
  const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;

  const orphanedScreeningRequests = (await getOrphanedScreeningRequests(ctx, { minTime, maxTime })) || [];
  logger.debug({ ctx, numOrphanedRequests: orphanedScreeningRequests.length }, 'orphanedScreeningRequestsWithTransactionNumber');

  const [requestsWithPendingResponse, requestsToRetry] = partition(orphanedScreeningRequests, 'transactionNumber');

  await execConcurrent(
    requestsWithPendingResponse,
    async ({ id: screeningRequestId, partyApplicationId }) => {
      logger.trace(ctx, { screeningRequestId, partyApplicationId }, 'request with pending response');
      const message = { tenantId: ctx.tenantId, msgId: ctx.msgId, screeningRequestId, partyApplicationId };
      return {
        screeningRequestId,
        result: await handleScreeningSubmitViewRequestReceived(message).catch(err =>
          logger.error({ err, ctx, screeningRequestId }, 'handlePollScreeningUnreceivedResponses error on submit view screening request'),
        ),
      };
    },
    10,
  );

  await execConcurrent(
    requestsToRetry,
    async ({ id: screeningRequestId }) => {
      logger.trace(ctx, { screeningRequestId }, 'request with no pending response');
      const message = { ctx, screeningRequestId };
      return {
        screeningRequestId,
        result: await handleScreeningResubmitRequest(message).catch(err =>
          logger.error({ err, ctx, screeningRequestId }, 'error on submit raw screening request'),
        ),
      };
    },
    10,
  );
};

const handlePollStuckRequests = async ctx => {
  logger.debug({ ctx }, 'handlePollStuckRequests');
  const { tenantId } = ctx;
  const submissionRequestsToPoll = await getStuckSubmissionRequests(ctx);

  await mapSeries(submissionRequestsToPoll, async ({ id: screeningRequestId, partyId }) => {
    logger.trace({ ctx, screeningRequestId, partyId }, 'resubmitting stuck request');
    await sendStuckRequestDetectedMessage({ tenantId }, partyId);
    return screeningRequestId;
  });
};

export const handlePollScreeningUnreceivedResponses = async ctx => {
  logger.trace({ ctx }, 'handlePollScreeningUnreceivedResponses');

  logger.time({ ctx }, 'handlePollScreeningUnreceivedResponses- handlePollOrphanedRequests duration');
  await handlePollOrphanedRequests(ctx);
  logger.timeEnd({ ctx }, 'handlePollScreeningUnreceivedResponses- handlePollOrphanedRequests duration');

  logger.time({ ctx }, 'handlePollScreeningUnreceivedResponses- handlePollStuckRequests duration');
  await handlePollStuckRequests(ctx);
  logger.timeEnd({ ctx }, 'handlePollScreeningUnreceivedResponses- handlePollStuckRequests duration');

  return { processed: true };
};
