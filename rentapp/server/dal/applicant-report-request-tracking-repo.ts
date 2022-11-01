/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { rawStatement, insertInto, updateOne } from '../../../server/database/factory';
import { IDbContext } from '../../../common/types/base-types';
import { FADV_RESPONSE_STATUS } from '../../common/screening-constants';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';
import { getPastFormattedDateFromDelta } from '../../../common/helpers/date-utils';
import { IApplicantReportRequestTracking, IApplicantReportRequestTrackingWithSettings } from '../helpers/applicant-types';
import { IDateRangeOptions, IOrphanedRequestTimeFrameData, IApplicantReportRequestWithApplicantData } from '../../common/enums/dal-types';

export const getPendingRequestTrackingReportsByPersonId = async (ctx: IDbContext, personId: string): Promise<IApplicantReportRequestTracking[]> => {
  const query: string = `
    WITH _applicantReportsTracking AS (
      SELECT *, row_number() OVER (PARTITION BY "reportName" ORDER BY created_at DESC) AS "rowNumber"
      FROM db_namespace."ApplicantReportRequestTracking"
      WHERE "personId" = :personId
      AND "isObsolete" = FALSE
      AND "requestEndedAt" IS NULL
    )
    SELECT rt.*, p.timezone FROM _applicantReportsTracking as rt
    INNER JOIN db_namespace."Property" AS p ON rt."propertyId" = p.id
    WHERE "rowNumber" = 1;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows as Array<IApplicantReportRequestTracking>;
};

export const createApplicantReportRequestTracking = async (
  ctx: IDbContext,
  applicantReportRequestTracking: IApplicantReportRequestTracking,
): Promise<IApplicantReportRequestTracking> =>
  (await insertInto(ctx, 'ApplicantReportRequestTracking', applicantReportRequestTracking)) as IApplicantReportRequestTracking;

export const updateApplicantReportRequestTracking = async (
  ctx: IDbContext,
  id: string,
  applicantReportRequestTracking: IApplicantReportRequestTracking,
): Promise<IApplicantReportRequestTracking> =>
  (await updateOne(ctx, 'ApplicantReportRequestTracking', id, applicantReportRequestTracking, ctx.trx)) as IApplicantReportRequestTracking;

export const markPreviousApplicantReportRequestsAsObsolete = async (
  ctx: IDbContext,
  personId: string,
  reportName: string,
): Promise<IApplicantReportRequestTracking> => {
  const query: string = `
    WITH _reportRequests AS (
      UPDATE db_namespace."ApplicantReportRequestTracking" as rt
      SET
        "isObsolete" = true
      WHERE "personId" = :personId
      AND "reportName" = :reportName
      RETURNING rt.*
    )
    SELECT rt.*, p.timezone FROM _reportRequests rt
    INNER JOIN db_namespace."Property" AS p ON rt."propertyId" = p.id
    ORDER BY created_at DESC LIMIT 1;
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      personId,
      reportName,
    },
  ]);

  return rows[0] as IApplicantReportRequestTracking;
};

export const getApplicantReportRequestsByPersonIdAndReportName = async (
  ctx: IDbContext,
  personId: string,
  reportName: string,
): Promise<IApplicantReportRequestTracking[]> => {
  const query: string = `
    SELECT rt.* FROM db_namespace."ApplicantReportRequestTracking" as rt
    WHERE "personId" = :personId
    AND "reportName" = :reportName
    ORDER BY created_at DESC;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId, reportName }]);

  return rows as Array<IApplicantReportRequestTracking>;
};

export const getApplicantReportRequestsById = async (ctx: IDbContext, id: string): Promise<IApplicantReportRequestTracking> => {
  const query: string = `
    SELECT rt.*, p.timezone FROM db_namespace."ApplicantReportRequestTracking" as rt
    INNER JOIN db_namespace."Property" AS p ON rt."propertyId" = p.id
    WHERE rt."id" = :id;
  `;

  const { rows } = await rawStatement(ctx, query, [{ id }]);

  return rows[0] as IApplicantReportRequestTracking;
};

export const getApplicantReportRequestWithSettingsBySubmissionRequestId = async (
  ctx: IDbContext,
  submissionRequestId: string,
): Promise<IApplicantReportRequestTrackingWithSettings> => {
  const query: string = `
    SELECT
      rt.*,
      per."fullName" AS "applicantFullName",
      pro.timezone,
      json_extract_path(pro.settings::json, 'applicationSettings', pa."leaseType", lower(pm."memberType")) AS "applicantSettings"
    FROM db_namespace."ApplicantReportRequestTracking" AS rt
    INNER JOIN db_namespace."Person" AS per ON rt."personId" = per.id
    INNER JOIN db_namespace."PartyMember" AS pm ON rt."personId" = pm."personId"
    INNER JOIN db_namespace."Party" AS pa ON pm."partyId" = pa.id
    INNER JOIN db_namespace."Property" AS pro ON pa."assignedPropertyId" = pro.id
    WHERE rt."id" = :submissionRequestId LIMIT 1;
  `;

  const { rows } = await rawStatement(ctx, query, [{ submissionRequestId }]);

  return rows[0];
};

export const getApplicantReportRequestWithApplicantData = async (
  ctx: IDbContext,
  submissionRequestId: string,
): Promise<IApplicantReportRequestWithApplicantData> => {
  const query = `SELECT
      request.id,
      request."externalReportId" AS "transactionNumber",
      request."propertyId",
      request."rawRequest",
      "applicantData"."applicationData" AS "applicantData"
    FROM db_namespace."ApplicantReportRequestTracking" AS request
    INNER JOIN db_namespace."ApplicantReport" AS report ON report.id = request."applicantReportId"
    INNER JOIN db_namespace."ApplicantData" AS "applicantData" ON "applicantData".id = report."applicantDataId"
    WHERE request.id = :submissionRequestId LIMIT 1;`;

  const { rows } = await rawStatement(ctx, query, [{ submissionRequestId }]);

  return (rows[0] as IApplicantReportRequestWithApplicantData) || null;
};

const getOrphanedRequestTimeFrameData = (dateRangeOptions: IDateRangeOptions): IOrphanedRequestTimeFrameData => {
  const { minOrphanedScreeningResponseAge } = config.fadv;
  const { minTime, maxTime, timeFrame = 'hours', initialDate = new Date() } = dateRangeOptions;

  return {
    minOrphanedScreeningResponseAge,
    from: getPastFormattedDateFromDelta(maxTime, timeFrame, initialDate),
    to: getPastFormattedDateFromDelta(minTime, timeFrame, initialDate),
  };
};

export const getOrphanedIncompleteApplicantReportRequestIds = async (ctx: IDbContext, dateRangeOptions: IDateRangeOptions): Promise<number[]> => {
  const { minOrphanedScreeningResponseAge, from, to } = getOrphanedRequestTimeFrameData(dateRangeOptions);

  const query = `SELECT DISTINCT
      req.id
    FROM db_namespace."ApplicantReportRequestTracking" req
    LEFT JOIN db_namespace."ApplicantReportResponseTracking" res ON res."screeningRequestId" = req.id
    WHERE req."isObsolete" = false
    GROUP BY req.id, res.id
    HAVING COUNT(CASE WHEN res.status = :completeStatus THEN 1 END) = 0
    AND (SELECT rest.id FROM db_namespace."ApplicantReportResponseTracking" rest
      WHERE rest."screeningRequestId" = req.id ORDER BY rest.created_at DESC LIMIT 1
    ) = res.id
    AND (SELECT rest.created_at FROM db_namespace."ApplicantReportResponseTracking" rest
      WHERE res.id = rest.id
      and rest.created_at < NOW() - INTERVAL '${minOrphanedScreeningResponseAge} MIN'
      order by rest.created_at DESC LIMIT 1
    ) IS NOT NULL
    AND req.created_at <@ '[:from:, :to:]'::tstzrange
    AND req."requestType" <> :requestType;`;

  const { rows } = await rawStatement(ctx, query, [{ from, to, requestType: FadvRequestTypes.RESET_CREDIT, completeStatus: FADV_RESPONSE_STATUS.COMPLETE }]);

  return rows.map(res => res.id) as number[];
};

export const getOrphanedApplicantReportRequestIds = async (ctx: IDbContext, dateRangeOptions: IDateRangeOptions): Promise<number[]> => {
  const { from, to } = getOrphanedRequestTimeFrameData(dateRangeOptions);

  const query = `SELECT DISTINCT
      req.id 
    FROM db_namespace."ApplicantReportRequestTracking" req
    LEFT JOIN db_namespace."ApplicantReportResponseTracking" res ON res."screeningRequestId" = req.id
    WHERE req."isObsolete" = false
    AND res.id IS NULL
    AND req.created_at <@ '[:from:, :to:]'::tstzrange
    AND req."requestType" <> :requestType;`;

  const { rows } = await rawStatement(ctx, query, [{ from, to, requestType: FadvRequestTypes.RESET_CREDIT }]);

  return rows.map(res => res.id) as number[];
};
