/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import { rawStatement, insertInto, updateOne, getOne, runInTransaction } from '../../../server/database/factory';
import { IDbContext } from '../../../common/types/base-types';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { IScreeningReportSettings, IScreeningReportSettingsOnActiveParties, IApplicantReport } from '../helpers/applicant-types';
import { screeningReportSettingFields, statesOnActiveParties } from '../helpers/applicant-report-helper';
import { ApplicantReportStatus } from '../../../common/enums/screeningReportTypes';
import { IDateRangeOptions, IOrphanedApplicantReport, IStuckApplicantReport } from '../../common/enums/dal-types';
import { getOrphanedApplicantReportRequestIds, getOrphanedIncompleteApplicantReportRequestIds } from './applicant-report-request-tracking-repo';
import { FADV_TO_DATABASE_SERVICE_STATUS_TRANS } from '../../common/enums/fadv-service-status';

const extractScreeningReportSettings = (applicantSettings: object): IScreeningReportSettings => {
  const settings = screeningReportSettingFields.reduce((acc, key) => {
    acc[key] = applicantSettings[key];
    return acc;
  }, {});

  return settings as IScreeningReportSettings;
};

export const getScreeningReportSettingsOnActivePartiesByPersonId = async (
  ctx: IDbContext,
  personId: string,
): Promise<IScreeningReportSettingsOnActiveParties[]> => {
  const query: string = `
    SELECT
      pro.id AS "propertyId",
      pa."leaseType",
      pm."memberType",
      json_extract_path(pro.settings::json, 'applicationSettings', pa."leaseType", lower(pm."memberType")) AS "applicantSettings"
    FROM db_namespace."Person" AS per
    INNER JOIN db_namespace."PartyMember" AS pm ON per.id = pm."personId"
    INNER JOIN db_namespace."Party" AS pa ON pm."partyId" = pa.id
    INNER JOIN db_namespace."Property" AS pro ON pa."assignedPropertyId" = pro.id
    WHERE per.id = :personId AND
      per."mergedWith" IS NULL AND
      pm."endDate" IS NULL AND
      pa."endDate" IS NULL AND
      pa.state = any(string_to_array(:statesOnActiveParties, ',')::varchar[])
    GROUP BY pro.id, pa."leaseType", pm."memberType"
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      personId,
      statesOnActiveParties: statesOnActiveParties.join(','),
    },
  ]);

  return rows.map(
    ({ applicantSettings, ...rest }) =>
      ({
        ...rest,
        applicantSettings: extractScreeningReportSettings(applicantSettings),
      } as IScreeningReportSettingsOnActiveParties),
  );
};

export const getApplicantReportById = async (ctx: IDbContext, applicantReportId: string): Promise<IApplicantReport> =>
  (await getOne(ctx, 'ApplicantReport', applicantReportId)) as IApplicantReport;

export const updateApplicantReport = async (ctx: IDbContext, id: string, applicantReport: IApplicantReport): Promise<IApplicantReport> =>
  (await updateOne(ctx, 'ApplicantReport', id, applicantReport, ctx.trx)) as IApplicantReport;

export const createApplicantReport = async (
  ctx: IDbContext,
  applicantReport: IApplicantReport,
  previousApplicantReportId?: string,
  shouldCancelPreviousReport?: boolean,
): Promise<IApplicantReport> =>
  runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const newApplicantReport = (await insertInto(innerCtx, 'ApplicantReport', applicantReport)) as IApplicantReport;

    const isPendingStatus = applicantReport.status === ApplicantReportStatus.PENDING;
    if (previousApplicantReportId && !isPendingStatus) {
      await updateApplicantReport(innerCtx, previousApplicantReportId, {
        obsoletedBy: newApplicantReport.id,
        ...(shouldCancelPreviousReport ? { status: ApplicantReportStatus.CANCELED } : {}),
      } as IApplicantReport);
    }
    return newApplicantReport;
  });

export const getLatestApplicantReportsByPersonId = async (ctx: IDbContext, personId: string): Promise<IApplicantReport[]> => {
  const query: string = `
    WITH _applicantReports AS (
      SELECT *, row_number() OVER (PARTITION BY "reportName" ORDER BY created_at DESC) AS "rowNumber"
      FROM db_namespace."ApplicantReport"
      WHERE "personId" = :personId
    )
    SELECT * FROM _applicantReports WHERE "rowNumber" = 1;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows as Array<IApplicantReport>;
};

export const markNextApplicantReportAsCompiling = async (ctx: IDbContext, personId: string, reportName: string): Promise<IApplicantReport> => {
  const query: string = `
    WITH _applicantReports AS (
      SELECT id, row_number() OVER (ORDER BY created_at DESC) AS "rowNumber"
      FROM db_namespace."ApplicantReport"
      WHERE "personId" = :personId
      AND "reportName" = :reportName
      AND status = :pendingStatus
    )
    UPDATE db_namespace."ApplicantReport" as ar
    SET
      status = CASE WHEN iar."rowNumber" = 1 THEN :compilingStatus ELSE :canceledStatus END,
      "obsoletedBy" = CASE
        WHEN iar."rowNumber" <> 1 THEN (SELECT id FROM _applicantReports AS o WHERE o."rowNumber" = 1 LIMIT 1)
        ELSE NULL
      END
    FROM _applicantReports AS iar
    WHERE iar.id = ar.id
    RETURNING ar.*;
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      personId,
      reportName,
      pendingStatus: ApplicantReportStatus.PENDING,
      compilingStatus: ApplicantReportStatus.COMPILING,
      canceledStatus: ApplicantReportStatus.CANCELED,
    },
  ]);

  return rows[0] as IApplicantReport;
};

export const getOrphanedApplicantReports = async (ctx: IDbContext, dateRangeOptions: IDateRangeOptions): Promise<IOrphanedApplicantReport[]> => {
  const screeningRequestIds = flatten(
    await execConcurrent([getOrphanedApplicantReportRequestIds(ctx, dateRangeOptions), getOrphanedIncompleteApplicantReportRequestIds(ctx, dateRangeOptions)]),
  );

  if (!screeningRequestIds.length) return [] as IOrphanedApplicantReport[];

  const query = `SELECT DISTINCT
      report.id AS "reportId",
      report."applicantDataId",
      report."personId",
      report.status AS "reportStatus",
      request.id AS "screeningRequestId",
      request."externalReportId",
      request."reportName",
      request."propertyId"
    FROM db_namespace."ApplicantReport" report
    INNER JOIN db_namespace."ApplicantReportRequestTracking" request ON request."applicantReportId" = report.id
    WHERE report.status = :compilingReportStatus
    AND report."obsoletedBy" IS NULL
    AND request.id IN (${screeningRequestIds.map(id => `'${id}'`).join(',')})`;

  const { rows } = await rawStatement(ctx, query, [{ compilingReportStatus: ApplicantReportStatus.COMPILING }]);

  return rows as IOrphanedApplicantReport[];
};

export const getStuckApplicantReports = async (ctx: IDbContext, dateRangeOptions: IDateRangeOptions): Promise<IStuckApplicantReport[]> => {
  const screeningRequestIds = await getOrphanedIncompleteApplicantReportRequestIds(ctx, dateRangeOptions);

  if (!screeningRequestIds.length) return [] as IStuckApplicantReport[];

  const onlyResponsesWithCompletedServiceStatuses = (stuckApplicantRequest: IStuckApplicantReport): boolean => {
    const { serviceStatus } = stuckApplicantRequest;
    const isServiceStatusCompleted = status => status === FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED;

    const allServicesStatuses = Object.keys(serviceStatus).map(service => serviceStatus[service].status);

    if (!allServicesStatuses.length) return false;

    return allServicesStatuses.every(isServiceStatusCompleted);
  };

  const query = `SELECT DISTINCT
      report.id AS "reportId",
      report."applicantDataId",
      report."personId",
      report.status AS "reportStatus",
      request.id AS "screeningRequestId",
      request."externalReportId",
      request."reportName",
      request."propertyId",
      response.id AS "responseId",
      response."status" AS "responseStatus",
      response."serviceStatus"
    FROM db_namespace."ApplicantReport" report
    INNER JOIN db_namespace."ApplicantReportRequestTracking" request ON request."applicantReportId" = report.id
    LEFT JOIN db_namespace."ApplicantReportResponseTracking" response ON response."screeningRequestId" = request.id
    WHERE report."obsoletedBy" IS NULL
    AND (SELECT res.id FROM db_namespace."ApplicantReportResponseTracking" res
      WHERE res."screeningRequestId" = request.id ORDER BY res.created_at DESC LIMIT 1
    ) = response.id
    AND response."serviceStatus" IS NOT NULL
    AND request.id IN (${screeningRequestIds.map(id => `'${id}'`).join(',')})`;

  const { rows } = await rawStatement(ctx, query);

  return rows.filter(onlyResponsesWithCompletedServiceStatuses) as IStuckApplicantReport[];
};
