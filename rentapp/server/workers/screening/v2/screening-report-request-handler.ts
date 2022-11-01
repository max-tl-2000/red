/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import isEmpty from 'lodash/isEmpty';
import partition from 'lodash/partition';
import { IDbContext, IConsumerResult, IDictionaryHash } from '../../../../../common/types/base-types';
import loggerModule from '../../../../../common/helpers/logger';
import {
  IApplicationData,
  IApplicantReportRequestTracking,
  IApplicantData,
  IReportRequestData,
  IRequestApplicantReportArgs,
} from '../../../helpers/applicant-types';
import { getActiveApplicantDataByPersonId } from '../../../dal/applicant-data-repo';
import {
  markPreviousApplicantReportRequestsAsObsolete,
  getApplicantReportRequestWithSettingsBySubmissionRequestId,
} from '../../../dal/applicant-report-request-tracking-repo';
import { NoRetryError } from '../../../../../server/common/errors';
import { getReportRequestData, handleImmediateScreeningResponse, handleScreeningResubmitRequest } from './helpers/screening-report-request-helpers';
import { postToScreeningProvider } from '../screening-provider-integration-handler';
import { BlockedReasons } from '../../../../../common/enums/applicationTypes';
import { getLastSubmissionResponseBySubmissionRequestId, createApplicantReportResponseTracking } from '../../../dal/applicant-report-response-tracking-repo';
import { shouldStoreScreeningResponse } from '../screening-helper';
import { getOrphanedApplicantReports, getStuckApplicantReports } from '../../../services/screening';
import { ScreeningVersion } from '../../../../../common/enums/screeningReportTypes';
import { handleScreeningSubmitViewRequestReceived } from '../helpers/screening-report-request-handler-helper';
import { PARSE_EXCEPTION } from '../../../../../common/helpers/postXML';

const logger = loggerModule.child({ subType: 'Screening report request handler' });

const handleFADVParseError = async (
  ctx: IDbContext,
  rawResponse: IDictionaryHash<any>,
  { screeningRequestId }: { screeningRequestId: string },
): Promise<void> => {
  if (!screeningRequestId) throw new NoRetryError('screeningRequestId is required');
  const submissionResponse = {
    submissionRequestId: screeningRequestId,
    rawResponse,
    blockedReason: BlockedReasons.UNKNOWN,
  };

  const lastStoredResponse = await getLastSubmissionResponseBySubmissionRequestId(ctx, screeningRequestId);
  if (!shouldStoreScreeningResponse(ctx, { submissionRequestId: screeningRequestId, submissionResponse, lastStoredResponse })) {
    logger.info({ ctx, screeningRequestId }, 'Screening request has already a response with the same data, so doing nothing');
  } else {
    await createApplicantReportResponseTracking(ctx, submissionResponse);
  }
};

export const requestApplicantReportHandler = async (
  ctx: IDbContext,
  // TODO: Ask Ivonne why forcedNew was not used
  { applicantReportId, screeningTypeRequested, personId, reportName, applicationData, propertyId /* ,z forcedNew */ }: IRequestApplicantReportArgs,
): Promise<IConsumerResult> => {
  let applicantData: IApplicantData;
  let personApplicationData: IApplicationData = applicationData;
  let applicantPropertyId: string = propertyId;
  if (isEmpty(personApplicationData)) {
    applicantData = await getActiveApplicantDataByPersonId(ctx, personId);

    if (applicantData) {
      personApplicationData = applicantData.applicationData;
      applicantPropertyId = applicantData.propertyId;
    }
  }

  logger.trace({ ctx, personId, reportName, screeningTypeRequested }, 'requestApplicantReportHandler');

  if (!personId || isEmpty(personApplicationData)) {
    const errorMsg = 'Person application data is missing or empty';
    logger.error(errorMsg);
    throw new NoRetryError(errorMsg);
  }
  const latestApplicantReportRequest: IApplicantReportRequestTracking = await markPreviousApplicantReportRequestsAsObsolete(ctx, personId, reportName);

  const { screeningReportData, screeningReportOptions }: IReportRequestData = await getReportRequestData(ctx, latestApplicantReportRequest, {
    applicantReportId,
    screeningTypeRequested,
    personId,
    reportName,
    applicationData: personApplicationData,
    propertyId: applicantPropertyId,
  });

  try {
    const { response, screeningRequestId } = await postToScreeningProvider(
      ctx,
      screeningReportData.propertyId,
      screeningReportData.rentData,
      screeningReportData.applicantData,
      { ...screeningReportOptions, reportName, personId, applicantReportId },
    );

    logger.trace({ ctx }, 'requestApplicantReportHandler about to handle immediate response');
    await handleImmediateScreeningResponse(ctx, {
      response,
      screeningRequestId,
    });
  } catch (err) {
    logger.error(
      { err, ctx, personId, reportName, applicantReportId, propertyId: screeningReportData.propertyId },
      'Unable to post message to screening provider',
    );
    if (err.msg === PARSE_EXCEPTION) {
      await handleFADVParseError(ctx, err.data, { screeningRequestId: err.screeningRequestId });
      return { processed: true };
    }
    throw new NoRetryError(err);
  }

  return { processed: true } as IConsumerResult;
};

export const handleOrphanedApplicantReports = async (ctx: IDbContext): Promise<void> => {
  logger.debug({ ctx }, 'handleOrphanedApplicantReports');
  const { tenantId, msgId } = ctx;
  const applicantReportsToPoll = await getOrphanedApplicantReports(ctx);

  logger.debug({ ctx, numOrphanedRequests: applicantReportsToPoll.length }, 'orphaned screening applicant reports');

  const [requestsWithPendingResponse, requestsToRetry] = partition(applicantReportsToPoll, 'externalReportId');

  await Promise.all(
    requestsWithPendingResponse.map(async requestWithPendingResponse => {
      const { screeningRequestId } = requestWithPendingResponse;
      logger.trace({ ctx, ...requestWithPendingResponse }, 'applicant report request with pending response');
      const message = { tenantId, msgId, screeningVersion: ScreeningVersion.V2, ...requestWithPendingResponse };
      return {
        screeningRequestId,
        result: await handleScreeningSubmitViewRequestReceived(message).catch(err =>
          logger.error({ ctx, err, screeningRequestId }, 'handleOrphanedApplicantReports error on submit view screening request'),
        ),
      };
    }),
  );

  await Promise.all(
    requestsToRetry.map(async requestToRetry => {
      const { screeningRequestId } = requestToRetry;
      logger.trace({ ctx, ...requestToRetry }, 'applicant report request with no pending response');
      const applicantReportRequest = await getApplicantReportRequestWithSettingsBySubmissionRequestId(ctx, screeningRequestId);
      return {
        screeningRequestId,
        result: await handleScreeningResubmitRequest({ ...ctx, screeningVersion: ScreeningVersion.V2 }, applicantReportRequest).catch(err =>
          logger.error({ ctx, err, screeningRequestId }, 'handleOrphanedApplicantReports error on submit raw screening request'),
        ),
      };
    }),
  );
};

const handleStuckApplicantReports = async (ctx: IDbContext): Promise<void> => {
  logger.debug({ ctx }, 'handleStuckApplicantReports');
  const stuckApplicantReports = await getStuckApplicantReports(ctx);

  stuckApplicantReports.map(applicantReport => {
    const logData = pick(applicantReport, ['reportId', 'screeningRequestId', 'applicantDataId', 'reportName', 'responseId']);
    logger.warn({ ctx, ...logData }, 'applicant report is stuck');
    return logData;
  });
};

export const handlePollScreeningUnreceivedResponses = async (ctx: IDbContext): Promise<IConsumerResult> => {
  logger.trace({ ctx }, 'handlePollScreeningUnreceivedResponses');
  await handleOrphanedApplicantReports(ctx);
  await handleStuckApplicantReports(ctx);
  return { processed: true } as IConsumerResult;
};
