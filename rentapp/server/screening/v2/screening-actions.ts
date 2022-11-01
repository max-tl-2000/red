/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IDbContext, IConsumerResult } from '../../../../common/types/base-types';
import { IApplicationData, IRequestApplicantReportArgs } from '../../helpers/applicant-types';
import { requestApplicantReportHandler } from '../../workers/screening/v2/screening-report-request-handler';

interface INextScreeningAction {
  applicantReportId: string;
  personId: string;
  reportName: string;
  applicationData: IApplicationData;
  propertyId: string;
  screeningTypeRequested?: string;
  forcedNew?: boolean;
}

export const processNextScreeningAction = async (ctx: IDbContext, message: INextScreeningAction): Promise<IConsumerResult> => {
  const { applicantReportId, screeningTypeRequested, forcedNew, personId, reportName, applicationData, propertyId } = message;
  return await requestApplicantReportHandler(ctx, {
    applicantReportId,
    personId,
    reportName,
    applicationData,
    propertyId,
    screeningTypeRequested,
    forcedNew,
  } as IRequestApplicantReportArgs);
};
