/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { IApplicantReportRequestTracking, IFadvApplicantData, IRentData, IScreeningResponse } from '../../../../helpers/applicant-types';
import { createApplicantReportRequestTracking } from '../../../../dal/applicant-report-request-tracking-repo';
import { assert } from '../../../../../../common/assert';
import logger from '../../../../../../common/helpers/logger';
import { obscureApplicantProperties } from '../../../../helpers/screening-helper';
import { maskSSNInApplicants } from '../../../../helpers/fadv-mask-applicant-ssn';
import { createFadvRawRequest } from '../../screening-handler-request';
import { IDbContext } from '../../../../../../common/types/base-types';
import { ReportDataBuilder } from './report-data-builder';
import { ApplicantReportNames } from '../../../../../../common/enums/screeningReportTypes';

const createAnApplicantReportRequestTracking = async (
  ctx: IDbContext,
  reportRequestTrackingId: string,
  propertyId: string,
  rentData: IRentData,
  applicantData: any,
  options: any,
): Promise<IApplicantReportRequestTracking> => {
  const { rawRequest } = await createFadvRawRequest(ctx, propertyId, rentData, maskSSNInApplicants(applicantData), options);
  const requestApplicantId = applicantData.applicants[0].applicantId;

  const applicantReportRequestTracking: IApplicantReportRequestTracking = {
    id: reportRequestTrackingId,
    applicantReportId: options.applicantReportId,
    personId: options.personId,
    reportName: options.reportName,
    requestApplicantId,
    propertyId,
    requestType: options.requestType,
    rawRequest,
  };

  return await createApplicantReportRequestTracking(ctx, applicantReportRequestTracking);
};

export const createFadvRequest = async (ctx: IDbContext, propertyId: string, rentData: IRentData, applicantData: IFadvApplicantData, options: any) => {
  assert(rentData && Object.keys(rentData).length > 0, 'createFadvRequest: rentData is missing or empty!');
  logger.debug({ ctx, propertyId, rentData, options, ...obscureApplicantProperties(applicantData) }, 'createAndStoreFadvRequest v2');

  const reportRequestTrackingId = newId();
  const newOptions = {
    ...options,
    submissionRequestId: reportRequestTrackingId,
  };

  const reportRequestResult = await createAnApplicantReportRequestTracking(ctx, reportRequestTrackingId, propertyId, rentData, applicantData, newOptions);
  assert(reportRequestResult.id === reportRequestTrackingId, 'createFadvRequest: the reportRequestTracking id is different');
  logger.debug({ ctx }, 'created submission request');

  const { rawRequest } = await createFadvRawRequest(ctx, propertyId, rentData, applicantData, newOptions);
  logger.debug({ ctx }, 'created raw request');

  logger.debug(
    {
      ctx,
      reportRequestTrackingId,
      propertyId,
      rentData,
      ...obscureApplicantProperties(applicantData),
    },
    'createFadvRequest created request',
  );

  return { rawRequest, id: reportRequestResult.id };
};

export const createReportDataBuilder = (ctx: IDbContext, response: IScreeningResponse, reportLogger?: any) => {
  const reportBuilder = new ReportDataBuilder(ctx, response, reportLogger || logger);
  const buildReport = (reportName: string, applicantId?: string) =>
    reportName === ApplicantReportNames.CREDIT ? reportBuilder.buildCreditReport(applicantId) : reportBuilder.buildCriminalReport(applicantId);
  return {
    buildReport,
    buildCreditReport: (applicantId?: string) => buildReport(ApplicantReportNames.CREDIT, applicantId),
    buildCriminalReport: (applicantId?: string) => buildReport(ApplicantReportNames.CRIMINAL, applicantId),
  };
};
