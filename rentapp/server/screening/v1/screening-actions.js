/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partition from 'lodash/partition';
import { SCREENING_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import { getScreeningOnHoldValues, getUnpaidPartyMembers, getNextUnsubmittedRentLevels } from '../screening-helper';
import {
  getAllScreeningResultsForParty,
  getFirstScreeningForParty,
  getScreeningCreationDate,
  getPendingRequests,
  updateSubmissionRequest,
  markAllScreeningRequestsForPartyAsObsolete,
} from '../../services/screening';
import { isCorporateLeaseType, getTimezoneForParty } from '../../../../server/dal/partyRepo';
import { getPublishedQuotesLengthByPartyId } from '../../../../server/dal/quoteRepo';
import { handleScreeningSubmitRequest } from '../../workers/screening/v1/screening-report-request-handler';
import { APPLICATION_EXPIRATION_DAYS } from '../../../common/screening-constants';

import loggerModule from '../../../../common/helpers/logger';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';

const logger = loggerModule.child({ subType: 'workflow' });

const existsUnpaidPartyMembers = async (ctx, partyId) => {
  const unpaidPartyMembers = await getUnpaidPartyMembers(ctx, partyId);
  const unpaidPersonIds = unpaidPartyMembers.map(m => m.personId);
  if (unpaidPartyMembers && unpaidPartyMembers.length) {
    logger.trace({ ctx, partyId, unpaidPersonIds }, 'There were unpaid party members, so doing nothing...');
    return true;
  }
  return false;
};

const isCorporateApplication = async (ctx, partyId) => {
  if (await isCorporateLeaseType(ctx, partyId)) {
    logger.trace({ ctx, partyId }, 'Is a corporate application, so doing nothing...');
    return true;
  }
  return false;
};

const isApplicationOnHold = async (ctx, partyId) => {
  const { isHeld } = await getScreeningOnHoldValues(ctx, partyId);
  if (isHeld) {
    logger.trace({ ctx, partyId }, 'Application screening is on hold, so doing nothing...');
    return true;
  }
  return false;
};

const isFirstScreeningResponseMissing = async (ctx, partyId) => {
  const firstScreening = await getFirstScreeningForParty(ctx, partyId);
  logger.trace({ ctx, firstScreening }, 'isFirstScreeningResponseMissing got firstScreening');
  // if firstScreening is null, there is not screening request yet
  if (!firstScreening) return false;
  // status comes from the response, if has value we already have a response
  if (firstScreening.status) return false;
  logger.trace({ ctx, partyId }, 'First screening response is missing, so doing nothing');
  return true;
};

const hasExpiredScreeningResults = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'hasExpiredScreeningResults');
  const screeningCreationDate = await getScreeningCreationDate(ctx, partyId);
  const timezone = await getTimezoneForParty(ctx, partyId);
  if (!screeningCreationDate || !screeningCreationDate.created_at) return false;
  logger.trace({ ctx, screeningCreationDate }, 'screeningCreationDate');
  return now({ timezone }).diff(toMoment(screeningCreationDate.created_at, { timezone }), 'days') > APPLICATION_EXPIRATION_DAYS;
};

const hasPublishedQuotes = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'hasPublishedQuotes');
  const areTherePublishedQuotes = !!(await getPublishedQuotesLengthByPartyId(ctx, partyId));
  if (areTherePublishedQuotes) return true;
  logger.trace({ ctx, partyId }, 'Party has no published quotes, so doing nothing');
  return false;
};

const shouldExecuteScreeningExpiredValidation = async (ctx, partyId, options) =>
  options.executeScreeningExpiredValidation && (await hasExpiredScreeningResults(ctx, partyId));

const screenIfNoUnpaidPartyMembers = async (ctx, partyId, eventType, options = {}) => {
  logger.trace({ ctx, partyId, options }, 'screenIfNoUnpaidPartyMembers');
  if (await isCorporateApplication(ctx, partyId)) return { processed: true };
  if (await isApplicationOnHold(ctx, partyId)) return { processed: true };

  if (await existsUnpaidPartyMembers(ctx, partyId)) {
    return { processed: true };
  }
  if (!(await hasPublishedQuotes(ctx, partyId))) {
    logger.trace({ ctx, partyId }, 'screenIfNoUnpaidPartyMembers skipping because missing published quotes');
    return { processed: true };
  }
  if (options.executeMissingResponseValidation && (await isFirstScreeningResponseMissing(ctx, partyId))) {
    logger.debug({ ctx, partyId }, 'screenIfNoUnpaidPartyMembers returning because response is currently pending');
    return { processed: true };
  }
  if (await shouldExecuteScreeningExpiredValidation(ctx, partyId, options)) {
    logger.trace('screenIfNoUnpaidPartyMembers skipping because has expired screenings');
    return { processed: true };
  }
  if (options.markAllScreeningRequestsForPartyAsObsolete) {
    await markAllScreeningRequestsForPartyAsObsolete(ctx, partyId);
  }

  const { screeningTypeRequested } = options;
  const message = { tenantId: ctx.tenantId, msgId: ctx.msgId, authUser: ctx.authUser, partyId, screeningTypeRequested, eventType };
  logger.debug({ ctx, partyId, screeningTypeRequested }, 'processing screening');
  return await handleScreeningSubmitRequest(message);
};

const MAX_MINUTES_TO_WAIT_FOR_REQUEST = 5;
const markOldRequestsAsTimedOut = async (ctx, oldPendingRequests) =>
  await execConcurrent(oldPendingRequests, async ({ id }) => {
    logger.error({ ctx, id }, 'Submission request time out');

    await updateSubmissionRequest(ctx, id, {
      requestEndedAt: new Date(),
      requestResult: {
        status: 'Time out',
      },
    });
  });

const hasPendingRequests = async (ctx, partyId) => {
  const pendingRequests = await getPendingRequests(ctx, partyId);
  const timezone = await getTimezoneForParty(ctx, partyId);
  const [oldPendingRequests, pendingActiveRequests] = partition(
    pendingRequests,
    req => now({ timezone }).diff(toMoment(req.created_at, { timezone }), 'minutes') > MAX_MINUTES_TO_WAIT_FOR_REQUEST,
  );
  logger.trace({ ctx, partyId, oldPendingRequests, pendingActiveRequests }, 'hasPendingRequests');

  await markOldRequestsAsTimedOut(ctx, oldPendingRequests);

  if (pendingActiveRequests.length > 0) {
    const pendingActiveRequestIds = pendingActiveRequests.map(req => req.id).join(',');
    logger.debug({ ctx, pendingActiveRequestIds }, 'there are pending active requests');
    return true;
  }
  return false;
};

const screenIfUnsubmittedRentLevels = async (ctx, partyId, eventType, options = { executeScreeningExpiredValidation: true }) => {
  const { tenantId } = ctx;
  logger.trace({ ctx, partyId, options }, 'screenIfUnsubmittedRentLevels');
  if (await isCorporateApplication(ctx, partyId)) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because corporate app');
    return { processed: true };
  }
  if (await isApplicationOnHold(ctx, partyId)) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because app is on hold');
    return { processed: true };
  }
  if (await existsUnpaidPartyMembers(ctx, partyId)) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because unpaid party members');
    return { processed: true };
  }
  if (!(await hasPublishedQuotes(ctx, partyId))) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because missing published quotes');
    return { processed: true };
  }
  if (options.executeMissingResponseValidation && (await isFirstScreeningResponseMissing(ctx, partyId))) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because still waiting on first response');
    return { processed: true };
  }
  if (await hasPendingRequests(ctx, partyId)) {
    logger.trace({ ctx, partyId }, 'screenIfUnsubmittedRentLevels skipping because still waiting on response');
    return { processed: true };
  }
  if (await shouldExecuteScreeningExpiredValidation(ctx, partyId, options)) {
    logger.trace('screenIfUnsubmittedRentLevels skipping because has expired screenings');
    return { processed: true };
  }

  const filterExpiredApplications = true;
  const screeningOptions = { filterExpiredApplications, excludeObsolete: true };

  // TODO remove screeningRequests
  const { screeningResults } = await getAllScreeningResultsForParty(ctx, partyId, screeningOptions);

  const unsubmittedRentLevels = await getNextUnsubmittedRentLevels(ctx, partyId, screeningResults);
  logger.trace({ ctx, partyId, unsubmittedRentLevels }, 'got unsubmittedRentLevels');
  const hasUnsubmittedRentLevels = unsubmittedRentLevels && unsubmittedRentLevels.length > 0;

  if (hasUnsubmittedRentLevels) {
    const submitRequest = { ...ctx, tenantId, partyId, eventType };
    submitRequest.rentData = unsubmittedRentLevels[0];
    logger.debug({ ctx, partyId, submitRequest }, 'processing next unsubmitted rent level');
    // TODO: should this send a message, not call the handler directly?
    return await handleScreeningSubmitRequest(submitRequest);
  }
  logger.trace({ ctx, partyId }, 'There are not unsubmitted rent Levels, so doing nothing...');
  return { processed: true };
};

// TODO: decompose message
export const processNextScreeningAction = async (ctx, message, eventType) => {
  logger.debug({ ctx, eventType }, 'processNextScreeningAction');
  const options = { screeningTypeRequested: message.screeningTypeRequested, executeScreeningExpiredValidation: true, executeMissingResponseValidation: true };
  const typeActions = {
    /* We do not need to screen on payment processed, because it will always be accompanied by an
       applicant_data_updated event... */
    [SCREENING_MESSAGE_TYPE.PAYMENT_PROCESSED]: null,
    [SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.APPLICATION_HOLD_STATUS_CHANGED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED]: screenIfUnsubmittedRentLevels,
    [SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_RECEIVED]: screenIfUnsubmittedRentLevels,
    [SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING]: screenIfUnsubmittedRentLevels,
    [SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED]: screenIfNoUnpaidPartyMembers,
    [SCREENING_MESSAGE_TYPE.APPLICANT_MEMBER_TYPE_CHANGED]: screenIfNoUnpaidPartyMembers,
  };
  const action = typeActions[eventType];
  if (
    [SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING, SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED, SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED].includes(
      eventType,
    )
  ) {
    options.executeScreeningExpiredValidation = false;
    options.executeMissingResponseValidation = false;
  }
  if (
    [
      SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED,
      SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED,
      SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED,
      SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED,
      SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED,
      SCREENING_MESSAGE_TYPE.APPLICANT_MEMBER_TYPE_CHANGED,
    ].includes(eventType)
  ) {
    options.markAllScreeningRequestsForPartyAsObsolete = true;
  }

  if (!action) {
    if (eventType !== SCREENING_MESSAGE_TYPE.PAYMENT_PROCESSED) logger.error({ message, eventType }, 'Unexpected event received!');
    return { processed: true };
  }

  return await action(ctx, message.partyId, eventType, options);
};
