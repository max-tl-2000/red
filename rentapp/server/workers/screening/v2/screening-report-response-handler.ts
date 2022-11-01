/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { IConsumerResult, IDbContext } from '../../../../../common/types/base-types';
import logger from '../../../../../common/helpers/logger';
import { handleParsedFADVResponse } from '../../../screening/fadv/screening-report-parser';
import { getSubmissionRequestId } from '../screening-helper';
import {
  IScreeningResponse,
  IApplicantReportResponseTracking,
  IApplicantReport,
  IApplicantReportRequestTrackingWithSettings,
  IScreeningReportSettings,
} from '../../../helpers/applicant-types';
import { getLastSubmissionResponseBySubmissionRequestId, createApplicantReportResponseTracking } from '../../../dal/applicant-report-response-tracking-repo';
import { getApplicantReportRequestWithSettingsBySubmissionRequestId } from '../../../dal/applicant-report-request-tracking-repo';
import { updateApplicantReport } from '../../../dal/applicant-report-repo';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';
import { ScreeningDecision, BlockedReasons } from '../../../../../common/enums/applicationTypes';
import { ApplicantReportStatus } from '../../../../../common/enums/screeningReportTypes';
import { now } from '../../../../../common/helpers/moment-utils';
import { obscureApplicantProperties } from '../../../helpers/screening-helper';
import { handleScreeningResubmitRequest } from './helpers/screening-report-request-helpers';
import { processNextIncomingApplicantReport, sendApplicantReportsUpdatedEvents } from '../../../screening/v2/applicant-report';
import { DEFAULT_GRACE_PERIOD, GRACE_PERIOD_MAPPER, isAddressError, isCreditFreeze, isExpiredError } from './helpers/screening-report-response-helper';
import { createReportDataBuilder } from './helpers/fadv-helper';

const getApplicantReportValidUntilDate = (reportName: string, applicantSettings: IScreeningReportSettings, timezone?: string): Date => {
  const gracePeriodName = GRACE_PERIOD_MAPPER[reportName];
  const gracePeriod = applicantSettings[gracePeriodName] || DEFAULT_GRACE_PERIOD;
  return now({ timezone }).add(gracePeriod, 'days').toDate();
};

// TODO: this will be implemented in another story
const shouldStoreScreeningResponse = (
  ctx: IDbContext,
  { submissionResponse, lastStoredResponse }: { submissionResponse: IApplicantReportResponseTracking; lastStoredResponse?: IApplicantReportResponseTracking },
): boolean => {
  const { screeningRequestId: submissionRequestId } = submissionResponse;
  const { id: lastStoredResponseId } = lastStoredResponse || ({} as IApplicantReportResponseTracking);

  logger.error({ ctx, submissionRequestId, lastStoredResponse, lastStoredResponseId }, 'shouldStoreScreeningResponse() is not implemented yet');

  return true;
};

export const processScreeningResponseReceived = async (
  ctx: IDbContext,
  screeningResponse: IScreeningResponse,
  // TODO: ask Ivonne why responseOrigin is not used
  _responseOrigin: string = 'http',
): Promise<IConsumerResult> => {
  logger.trace({ ctx }, 'processScreeningResponseReceived v2');
  const response = await handleParsedFADVResponse(ctx, screeningResponse);
  const { tenantId } = response;
  ctx.tenantId = tenantId;
  const customRecords = response.customRecords;
  const submissionRequestId = getSubmissionRequestId(ctx, { customRecords });
  const applicantReportRequest: IApplicantReportRequestTrackingWithSettings =
    (await getApplicantReportRequestWithSettingsBySubmissionRequestId(ctx, submissionRequestId)) || ({} as IApplicantReportRequestTrackingWithSettings);

  const { applicantReportId, timezone } = applicantReportRequest;

  const submissionResponse: IApplicantReportResponseTracking = {
    screeningRequestId: submissionRequestId,
    status: response.Status,
    rawResponse: screeningResponse,
    serviceStatus: response.serviceStatus || null,
    serviceBlockedStatus: response.BlockedStatus || null,
    // TODO add on CPM-12658 origin: responseOrigin,
  };

  const lastStoredResponse = await getLastSubmissionResponseBySubmissionRequestId(ctx, submissionRequestId);

  if (!shouldStoreScreeningResponse(ctx, { submissionResponse, lastStoredResponse })) {
    logger.info({ ctx, submissionRequestId }, 'Screening request already has a response with the same data, so doing nothing');
    return { processed: true };
  }

  const applicantReport: IApplicantReport = {} as IApplicantReport;
  applicantReport.serviceStatus = response.serviceStatus || null;

  if (response.Status === FADV_RESPONSE_STATUS.COMPLETE) {
    applicantReport.creditBureau = response.CreditBureau;
    applicantReport.completedAt = now({ timezone }).toDate();

    if (response.ApplicationDecision === ScreeningDecision.DISPUTED) {
      submissionResponse.blockedReason = BlockedReasons.DISPUTE;
      applicantReport.status = ApplicantReportStatus.BLOCKED_DISPUTE;
      applicantReport.reportData = { blockedBy: BlockedReasons.DISPUTE };

      const { personId, applicantFullName } = applicantReportRequest;
      logger.error({ ctx, applicantReportId, personId, applicantFullName }, 'Disputed application decision for screening response');
    } else {
      const { applicantSettings, reportName } = applicantReportRequest;
      const reportData = createReportDataBuilder(ctx, screeningResponse, logger).buildReport(reportName!);
      applicantReport.status = ApplicantReportStatus.COMPLETED;
      applicantReport.reportData = reportData;
      applicantReport.reportDocument = response.BackgroundReport;
      applicantReport.validUntil = getApplicantReportValidUntilDate(reportName, applicantSettings, timezone);
    }
  }

  if (response.Status === FADV_RESPONSE_STATUS.ERROR) {
    applicantReport.completedAt = now({ timezone }).toDate();

    if (isAddressError(response.ErrorCode)) {
      submissionResponse.blockedReason = BlockedReasons.ADDRESS;
      applicantReport.status = ApplicantReportStatus.BLOCKED_ADDRESS;
      applicantReport.reportData = { blockedBy: BlockedReasons.ADDRESS };
    } else if (isExpiredError(response.ErrorCode)) {
      submissionResponse.blockedReason = BlockedReasons.EXPIRED;
    } else {
      submissionResponse.blockedReason = BlockedReasons.UNKNOWN;
      applicantReport.status = ApplicantReportStatus.ERROR;
      applicantReport.reportData = { error: 'other' };

      const { personId, applicantFullName } = applicantReportRequest;
      logger.error(
        { ctx, applicantReportId, personId, applicantFullName, errorDescription: response.ErrorDescription },
        'Error status received for screening response',
      );
    }
  }

  if (response.Status === FADV_RESPONSE_STATUS.INCOMPLETE) {
    if (isCreditFreeze(response)) {
      submissionResponse.blockedReason = BlockedReasons.CREDIT_FREEZE;
      applicantReport.status = ApplicantReportStatus.BLOCKED_CREDIT_FREEZE;
      applicantReport.completedAt = now({ timezone }).toDate();
      applicantReport.reportData = { blockedBy: BlockedReasons.CREDIT_FREEZE };
    } else {
      applicantReport.status = ApplicantReportStatus.COMPILING;
    }
  }

  const submissionResponseResult = await createApplicantReportResponseTracking(ctx, submissionResponse);
  logger.trace({ ctx }, 'processScreeningResponseReceived created response entity');
  const fadvRequestLog = pick(submissionResponseResult, ['id', 'screeningRequestId', 'externalReportId', 'status']);

  logger.trace(obscureApplicantProperties(fadvRequestLog), 'processScreeningResponseReceived response');

  if (isExpiredError(response.ErrorCode)) {
    await handleScreeningResubmitRequest(ctx, applicantReportRequest);
  } else {
    const updatedApplicantReport = await updateApplicantReport(ctx, applicantReportId!, applicantReport);
    logger.trace({ ctx, applicantReportId: updatedApplicantReport.id }, 'Updated applicant report');
    await sendApplicantReportsUpdatedEvents(ctx, updatedApplicantReport.personId);
  }

  await processNextIncomingApplicantReport(ctx, applicantReportRequest.personId!, applicantReportRequest.reportName!);

  return { processed: true } as IConsumerResult;
};
