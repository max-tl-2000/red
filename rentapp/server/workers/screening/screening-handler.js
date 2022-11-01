/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { performNextScreeningAction } from '../../screening/workflow';
import { SCREENING_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import {
  getOrphanedScreeningRequests,
  getLatestUnalertedScreeningRequests,
  updateScreeningRequest,
  existsSubmissionResponse,
  getApplicantIdsWithIncompleteScreening,
} from '../../services/screening';
import { markAllScreeningRequestsForPartyAsObsolete, getLatestBlockedServiceStatusBySubmissionRequestId } from '../../dal/fadv-submission-repo';
import { updateHoldForIntlAddr, updateLinkedGuarantor } from '../../screening/screening-helper';
import config from '../../../config';

import { NoRetryError } from '../../../../server/common/errors';
import { isPartyLevelGuarantor } from '../../../../server/services/party-settings';

import loggerModule from '../../../../common/helpers/logger';
import { now, duration } from '../../../../common/helpers/moment-utils';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes.ts';
import { getPartyUrl } from '../../../../server/helpers/party';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });

/* Handles all AMQ messages related to screening */

// TODO: refactor all of the handler functions to use signatures like
// handleXXX = async( { ...var1, var2, ctx })
const executeHoldTypesValidations = async (ctx, partyId) => {
  // the last validation will give us if the party is hold or not, because we remove hold reasons in order
  await updateHoldForIntlAddr(ctx, partyId);
  return !(await isPartyLevelGuarantor(ctx, partyId)) && (await updateLinkedGuarantor(ctx, partyId));
};

export const handlePaymentProcessed = async amqMsg => {
  try {
    const { partyId, ...ctx } = amqMsg;
    if (await executeHoldTypesValidations(ctx, partyId)) return { processed: true };
    return await performNextScreeningAction(ctx, amqMsg, { eventType: SCREENING_MESSAGE_TYPE.PAYMENT_PROCESSED });
  } catch (e) {
    logger.error({ amqMsg, e }, 'error on handlePaymentProcessed');
    return { processed: false };
  }
};

const handleApplicantDataUpdate = async (amqMsg, eventType, logMsg) => {
  const { partyId, screeningTypeRequested, ...ctx } = amqMsg;

  try {
    logger.info({ ctx, partyId, screeningTypeRequested }, logMsg);
    if (await executeHoldTypesValidations(ctx, partyId)) {
      logger.debug({ ctx, partyId }, 'skipping screening due to hold');
      return { processed: true };
    }
    return await performNextScreeningAction(ctx, amqMsg, { eventType });
  } catch (e) {
    logger.error({ ctx, amqMsg, e }, `error on ${logMsg}`);
    return { processed: false };
  }
};

export const handleApplicantDataUpdated = async amqMsg =>
  await handleApplicantDataUpdate(amqMsg, SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED, 'handleApplicantDataUpdated');

export const handleAdminSsnSendChanged = async amqMsg =>
  await handleApplicantDataUpdate(amqMsg, SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED, 'handleAdminSsnSendChanged');

export const handleStuckRequestDetected = async amqMsg =>
  await handleApplicantDataUpdate(amqMsg, SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED, 'handleStuckRequestDetected');

export const handleApplicantMemberTypeChanged = async amqMsg =>
  await handleApplicantDataUpdate(amqMsg, SCREENING_MESSAGE_TYPE.APPLICANT_MEMBER_TYPE_CHANGED, 'handleApplicantMemberTypeChanged');

export const handleApplicationHoldStatusChanged = async amqMsg => {
  const { partyId, ...ctx } = amqMsg;

  try {
    if (await executeHoldTypesValidations(ctx, partyId)) return { processed: true };
    return await performNextScreeningAction(ctx, amqMsg, { eventType: SCREENING_MESSAGE_TYPE.APPLICATION_HOLD_STATUS_CHANGED });
  } catch (e) {
    logger.error({ ctx, amqMsg, e }, 'error on handleApplicationHoldStatusChanged');
    return { processed: false };
  }
};

export const handlePartyMembersChanged = async amqMsg => {
  const { partyId, ...ctx } = amqMsg;

  try {
    if (await executeHoldTypesValidations(ctx, partyId)) return { processed: true };
    return await performNextScreeningAction(ctx, amqMsg, { eventType: SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED });
  } catch (e) {
    const messageError = 'Unexpected error handling screening request';
    logger.error({ ctx, amqMsg, e }, messageError);
    throw new NoRetryError(messageError);
  }
};

export const handleQuotePublished = async amqMsg => {
  const ctx = amqMsg;

  try {
    /* QUESTION: is this needed?  it wasn't here before...
    const { partyId } = amqMsg;
    if (await executeHoldTypesValidations(ctx, partyId)) return { processed: true };
    */
    return await performNextScreeningAction(ctx, amqMsg, { eventType: SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED });
  } catch (e) {
    logger.error({ ctx, amqMsg, e }, 'error on handleQuotePublished');
    return { processed: false };
  }
};

const formatApplicantFullName = applicant => `${applicant.lastName} ${applicant.firstName}`;

const logOrphanedScreeningRequests = async (ctx, logMessage, requests = [], level = 'error') => {
  if (!requests.length) return;

  // time is in ISO here
  const age = time => duration(now().diff(time)).humanize();

  const requestLogs = await mapSeries(
    requests,
    async ({ id: screeningRequestId, partyApplicationId, partyId, created_at, transactionNumber, applicantData }) => {
      let applicantsIncompleteScreening = [];
      let applicantsBlockedServices = [];
      let hasSubmissionResponse = true;
      if (!(await existsSubmissionResponse(ctx, screeningRequestId))) {
        hasSubmissionResponse = false;
        applicantData.applicants.forEach(applicant => {
          applicantsIncompleteScreening.push({ applicant: formatApplicantFullName(applicant), services: [] });
          applicantsBlockedServices.push({ applicant: `No information: ${formatApplicantFullName(applicant)}`, services: [] });
        });
      } else {
        const { applicantsWithIncompleteScreening, applicantsWithBlockedServiceStatus } = await getApplicantIdsWithIncompleteScreening(
          ctx,
          screeningRequestId,
          applicantData,
        );

        const getApplicantServiceStatus = (applicantId, serviceStatus) => serviceStatus.find(app => app.applicantId === applicantId).services || [];
        const getApplicantIncompleteServiceStatus = (applicant, applicantsServiceStatus) => ({
          applicant: formatApplicantFullName(applicant),
          services: getApplicantServiceStatus(applicant.applicantId, applicantsServiceStatus),
        });

        applicantsIncompleteScreening = applicantData.applicants
          .filter(applicant => applicantsWithIncompleteScreening.find(app => app.applicantId === applicant.applicantId))
          .map(applicant => getApplicantIncompleteServiceStatus(applicant, applicantsWithIncompleteScreening));

        applicantsBlockedServices = applicantData.applicants
          .filter(applicant => applicantsWithBlockedServiceStatus.find(app => app.applicantId === applicant.applicantId))
          .map(applicant => getApplicantIncompleteServiceStatus(applicant, applicantsWithBlockedServiceStatus));
      }
      return {
        screeningRequestId,
        partyApplicationId,
        partyId,
        transactionNumber,
        created_at,
        age: age(created_at),
        partyUrl: await getPartyUrl(ctx, partyId),
        applicantsIncompleteScreening,
        applicantsBlockedServices,
        blockedStatus:
          hasSubmissionResponse && applicantsBlockedServices.length ? await getLatestBlockedServiceStatusBySubmissionRequestId(ctx, screeningRequestId) : '',
      };
    },
  );

  logger[level]({ ctx, requestLogs }, logMessage);
};

export const handleScreeningResponseValidation = async msg => {
  const { msgCtx: ctx } = msg;
  logger.time({ ctx, msg }, 'Recurring Jobs - handleScreeningResponseValidation duration');

  const { minTime, maxTime } = config.fadv.screeningValidationInterval;
  const orphanedScreeningRequests = await getOrphanedScreeningRequests(ctx, { minTime, maxTime });
  await logOrphanedScreeningRequests(ctx, 'Missing screening response', orphanedScreeningRequests);

  logger.timeEnd({ ctx, msg }, 'Recurring Jobs - handleScreeningResponseValidation duration');
  return { processed: true };
};

export const handleLongRunningScreeningRequests = async ctx => {
  logger.time({ ctx }, 'Recurring Jobs - handleLongRunningScreeningRequests duration');
  const unalertedScreeningRequests = await getLatestUnalertedScreeningRequests(ctx);
  await logOrphanedScreeningRequests(ctx, 'Screening validation is taking longer than expected', unalertedScreeningRequests, 'warn');

  await mapSeries(unalertedScreeningRequests, async screeningRequest => {
    await updateScreeningRequest(ctx, screeningRequest.id, {
      isAlerted: true,
    });
  });

  logger.timeEnd({ ctx }, 'Recurring Jobs - handleLongRunningScreeningRequests duration');
  return { processed: true };
};

const handleScreeningActionWithoutRetries = async (amqMsg, { eventType, errorMessage }) => {
  const { partyId, msgCtx: ctx } = amqMsg;

  try {
    if (await executeHoldTypesValidations(ctx, partyId)) return { processed: true };
    return await performNextScreeningAction(ctx, amqMsg, { eventType });
  } catch (e) {
    logger.error({ ctx, amqMsg, e }, errorMessage);
    throw new NoRetryError(errorMessage);
  }
};

export const handleRerunExpiredScreening = async amqMsg =>
  await handleScreeningActionWithoutRetries(amqMsg, {
    eventType: SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING,
    errorMessage: 'Unexpected error handling re-run screening',
  });

export const handleForceRecreeningRequested = async amqMsg => {
  const message = { ...amqMsg, msgCtx: { ...amqMsg.msgCtx, authUser: amqMsg.authUser } };
  return await handleScreeningActionWithoutRetries(message, {
    eventType: SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED,
    errorMessage: 'Unexpected error handling force rescreening requested',
  });
};

export const handlePartyArchivedOrClosed = async amqMsg => {
  const { partyId, msgCtx: ctx } = amqMsg;

  try {
    await markAllScreeningRequestsForPartyAsObsolete(ctx, partyId);
  } catch (error) {
    logger.error({ ctx, amqMsg, error }, 'error on handlePartyArchivedOrClosed');
    return { processed: false };
  }

  return { processed: true };
};

export const handleRequestApplicantReport = async amqMsg => {
  const { msgCtx: ctx } = amqMsg;

  try {
    return await performNextScreeningAction(ctx, amqMsg, { version: ScreeningVersion.V2 });
  } catch (error) {
    logger.error({ ctx, amqMsg, error }, 'error on handleRequestApplicantReport');
    return { processed: false };
  }
};
