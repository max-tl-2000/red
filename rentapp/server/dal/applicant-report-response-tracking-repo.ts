/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { maskSubmissionResponse } from '../helpers/screening-helper';
import { IDbContext } from '../../../common/types/base-types';
import { IApplicantReportResponseTracking } from '../helpers/applicant-types';
import { rawStatement, insertInto, updateOne } from '../../../server/database/factory';

const RESPONSE_TRACKING_TABLE = 'ApplicantReportResponseTracking';

export const createApplicantReportResponseTracking = async (
  ctx: IDbContext,
  applicantReportResponseTracking: IApplicantReportResponseTracking,
): Promise<IApplicantReportResponseTracking> =>
  (await insertInto(ctx, RESPONSE_TRACKING_TABLE, maskSubmissionResponse(applicantReportResponseTracking))) as IApplicantReportResponseTracking;

export const updateApplicantReportResponseTracking = async (
  ctx: IDbContext,
  id: string,
  applicantReportResponseTracking: IApplicantReportResponseTracking,
): Promise<IApplicantReportResponseTracking> =>
  (await updateOne(ctx, RESPONSE_TRACKING_TABLE, id, maskSubmissionResponse(applicantReportResponseTracking), ctx.trx)) as IApplicantReportResponseTracking;

export const getLastSubmissionResponseBySubmissionRequestId = async (
  ctx: IDbContext,
  screeningRequestId: string,
): Promise<IApplicantReportResponseTracking> => {
  const query: string = `
    SELECT rt.* FROM db_namespace."${RESPONSE_TRACKING_TABLE}" as rt
    WHERE "screeningRequestId" = :screeningRequestId
    ORDER BY "created_at" DESC LIMIT 1;
  `;

  const { rows } = await rawStatement(ctx, query, [{ screeningRequestId }]);

  return rows[0] as IApplicantReportResponseTracking;
};
