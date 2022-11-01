/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IApplicationData, IParsedServiceStatusV2 } from '../../server/helpers/applicant-types';

export interface IOrphanedApplicantReport {
  reportId: string;
  applicantDataId: string;
  personId: string;
  reportStatus: string;
  screeningRequestId: string;
  externalReportId?: string;
  reportName: string;
  propertyId: string;
}

export interface IStuckApplicantReport extends IOrphanedApplicantReport {
  responseId: string;
  responseStatus: string;
  serviceStatus: IParsedServiceStatusV2;
}

export interface IApplicantReportRequestWithApplicantData {
  id: string;
  transactionNumber: string;
  propertyId: string;
  rawRequest: string;
  applicantData: IApplicationData;
}

export interface IDateRangeOptions {
  minTime: number;
  maxTime: number;
  timeFrame?: string;
  initialDate?: Date;
}

export interface IOrphanedRequestTimeFrameData {
  minOrphanedScreeningResponseAge: number;
  from: string;
  to: string;
}
