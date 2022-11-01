/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import isEmpty from 'lodash/isEmpty';
import { IDbContext } from '../../../../common/types/base-types';
import { ApplicantReportStatus } from '../../../../common/enums/screeningReportTypes';
import { IApplicantData, IApplicantReport, IApplicantReportRequestTracking, IApplicationData } from '../../helpers/applicant-types';
import {
  getScreeningReportSettingsOnActivePartiesByPersonId,
  getLatestApplicantReportsByPersonId,
  createApplicantReport,
  markNextApplicantReportAsCompiling,
} from '../../dal/applicant-report-repo';
import { getActiveApplicantDataByPersonId } from '../../dal/applicant-data-repo';
import { getPendingRequestTrackingReportsByPersonId } from '../../dal/applicant-report-request-tracking-repo';
import { getApplicantReportsNeededBy, isApplicantReportForInternationalAddress, isPendingRequestTrackingOnTime } from '../../helpers/applicant-report-helper';

import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import { sendMessage } from '../../../../server/services/pubsub';

import loggerModule from '../../../../common/helpers/logger';
import { saveApplicantReportStatusUpdatedEvent } from '../../../../server/services/partyEvent';
import { getActivePartyIdsByPersonId } from '../../../../server/services/party';

const logger = loggerModule.child({ subType: 'applicantReports' });

const requestApplicantReport = async (
  ctx: IDbContext,
  {
    personId,
    reportName,
    applicationData,
    applicantReportId,
    propertyId,
  }: { personId: string; reportName: string; applicationData?: IApplicationData; applicantReportId: string; propertyId?: string },
): Promise<void> =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.REQUEST_APPLICANT_REPORT,
    message: {
      tenantId: ctx.tenantId,
      personId,
      reportName,
      applicationData,
      applicantReportId,
      propertyId,
    },
    ctx,
  });

const reportStatusIsEqualTo = (status: string, applicantReport?: IApplicantReport): boolean => (applicantReport ? applicantReport.status === status : false);

const isCompilingReportOutOfTime = (latestApplicantReport: IApplicantReport, pendingRequestTrackingReport: IApplicantReportRequestTracking): boolean => {
  if (!reportStatusIsEqualTo(ApplicantReportStatus.COMPILING, latestApplicantReport)) return false;

  return !isPendingRequestTrackingOnTime(pendingRequestTrackingReport);
};

const calculateApplicantReportStatus = (applicantData: IApplicantData, latestApplicantReport?: IApplicantReport, isCompilingReportOnTime?: boolean): string => {
  if (isApplicantReportForInternationalAddress(applicantData.applicationData)) return ApplicantReportStatus.COMPLETED;

  if (reportStatusIsEqualTo(ApplicantReportStatus.PENDING, latestApplicantReport)) {
    return ApplicantReportStatus.PENDING;
  }

  if (reportStatusIsEqualTo(ApplicantReportStatus.COMPILING, latestApplicantReport) && isCompilingReportOnTime) {
    return ApplicantReportStatus.PENDING;
  }

  return ApplicantReportStatus.COMPILING;
};

const prepareApplicantReport = (
  applicantData: IApplicantData,
  reportName: string,
  personId: string,
  latestApplicantReport?: IApplicantReport,
  isCompilingReportOnTime?: boolean,
): IApplicantReport => {
  const applicantReport: IApplicantReport = {
    personId,
    reportName,
    applicantDataId: applicantData.id as string,
    status: calculateApplicantReportStatus(applicantData, latestApplicantReport, isCompilingReportOnTime),
  };

  if (isApplicantReportForInternationalAddress(applicantData.applicationData)) {
    applicantReport.reportData = { hasInternationalAddress: true };
  }

  return applicantReport;
};

const processIncomingApplicantReport = async (
  ctx: IDbContext,
  personId: string,
  reportName: string,
  applicantData: IApplicantData,
  latestApplicantReports: Array<IApplicantReport>,
  pendingRequestTrackingReports: Array<IApplicantReportRequestTracking>,
) => {
  const latestApplicantReport = latestApplicantReports.find(report => report.reportName === reportName) || ({} as IApplicantReport);
  const pendingRequestTrackingReport = pendingRequestTrackingReports.find(
    report => report.reportName === reportName && report.applicantReportId === latestApplicantReport.id,
  );

  const shouldMarkCompilingReportAsCanceled = isCompilingReportOutOfTime(latestApplicantReport, pendingRequestTrackingReport!);
  const applicantReportData = prepareApplicantReport(applicantData, reportName, personId, latestApplicantReport, !shouldMarkCompilingReportAsCanceled);
  const previousApplicantReportId = latestApplicantReport && latestApplicantReport.id;
  const applicantReport = await createApplicantReport(ctx, applicantReportData, previousApplicantReportId, shouldMarkCompilingReportAsCanceled);

  logger.trace({ ctx, applicantReport: { ...applicantReportData, id: applicantReport.id } }, 'applicant report created');

  if (reportStatusIsEqualTo(ApplicantReportStatus.COMPILING, applicantReport)) {
    await requestApplicantReport(ctx, {
      personId,
      reportName,
      applicationData: applicantData.applicationData,
      applicantReportId: applicantReport.id!,
      propertyId: applicantData.propertyId,
    });
  }
  return applicantReport;
};

export const sendApplicantReportsUpdatedEvents = async (ctx: IDbContext, personId: string): Promise<void> => {
  logger.info({ ctx, personId }, 'Getting active parties for applicant');
  const activePartyIds = await getActivePartyIdsByPersonId(ctx, personId);

  logger.debug({ ctx, personId, activePartyIds: activePartyIds.join(',') }, 'Calling applicant report status updated event');

  await mapSeries(activePartyIds, async partyId => {
    await saveApplicantReportStatusUpdatedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id,
      metadata: {
        personId,
      },
    });
  });
};

// After insert a record in applicant data table, call this method
export const refreshApplicantReports = async (ctx: IDbContext, personId: string, applicantDataUpdated?: boolean): Promise<object[]> => {
  logger.trace({ ctx, personId, applicantDataUpdated }, 'refreshApplicantReports');

  const [screeningReportSettings, latestApplicantReports, pendingRequestTrackingReports, applicantData] = await Promise.all([
    getScreeningReportSettingsOnActivePartiesByPersonId(ctx, personId),
    getLatestApplicantReportsByPersonId(ctx, personId),
    getPendingRequestTrackingReportsByPersonId(ctx, personId),
    getActiveApplicantDataByPersonId(ctx, personId),
  ]);

  if (!applicantData) {
    logger.warn({ ctx, personId, applicantDataUpdated }, 'there is not any applicant data to process');
    return [];
  }

  if (isEmpty(applicantData.applicationDataDiff)) {
    logger.warn({ ctx, personId, applicantDataUpdated }, 'applicationDataDiff is empty');
    return [];
  }

  const applicantDataDiff = applicantDataUpdated ? applicantData.applicationDataDiff : null;
  const applicantReports = getApplicantReportsNeededBy(screeningReportSettings, applicantDataDiff);

  const processedApplicantReports = await mapSeries(applicantReports, reportName =>
    processIncomingApplicantReport(ctx, personId, reportName, applicantData, latestApplicantReports, pendingRequestTrackingReports),
  );

  if (applicantReports.length) await sendApplicantReportsUpdatedEvents(ctx, personId);

  return processedApplicantReports;
};

// Call this method when we update requestEndedAt after posting the request to fadv
export const processNextIncomingApplicantReport = async (ctx: IDbContext, personId: string, reportName: string): Promise<IApplicantReport | null> => {
  const applicantReport: IApplicantReport = await markNextApplicantReportAsCompiling(ctx, personId, reportName);
  if (!applicantReport) return null;

  logger.trace({ ctx, personId, reportName, applicantReportId: applicantReport.id }, 'processNextIncomingApplicantReport');
  await requestApplicantReport(ctx, { personId, reportName, applicantReportId: applicantReport.id! });

  return applicantReport;
};
