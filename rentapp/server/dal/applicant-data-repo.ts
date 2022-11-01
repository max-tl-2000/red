/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto, rawStatement, update } from '../../../server/database/factory';
import { IDbContext } from '../../../common/types/base-types';
import { IApplicantData } from '../helpers/applicant-types';
import { ApplicantReportNames, ApplicantReportStatus } from '../../../common/enums/screeningReportTypes';
import { IPartyApplicantData } from '../helpers/party-application-screening-decision-types';

const APPLICANT_DATA_TABLE_NAME = 'ApplicantData';

export const createApplicantData = async (ctx: IDbContext, applicantData: IApplicantData): Promise<IApplicantData> =>
  (await insertInto(ctx, APPLICANT_DATA_TABLE_NAME, applicantData)) as IApplicantData;

export const updateApplicantData = async (ctx: IDbContext, id: string, applicantData: IApplicantData): Promise<IApplicantData[]> =>
  (await update(ctx, APPLICANT_DATA_TABLE_NAME, { id }, applicantData)) as IApplicantData[];

export const getApplicantDataHistoryByPersonId = async (ctx: IDbContext, personId: string): Promise<IApplicantData[]> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_TABLE_NAME}"
    WHERE "personId" = :personId
    ORDER BY created_at DESC;`;

  const { rows } = await rawStatement(ctx, query, [{ personId }] as never[]);

  return rows as IApplicantData[];
};

export const getActiveApplicantDataByPersonId = async (ctx: IDbContext, personId: string): Promise<IApplicantData> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_TABLE_NAME}"
    WHERE "personId" = :personId
    AND "endDate" is null
    ORDER BY created_at DESC
    LIMIT 1;`;

  const { rows } = await rawStatement(ctx, query, [{ personId }] as never[]);

  return rows[0] as IApplicantData;
};

export const getPartyApplicantData = async (ctx: IDbContext, partyId: string): Promise<IPartyApplicantData[]> => {
  const applicantReportSubQueries = Object.values(ApplicantReportNames)
    .map(
      reportName => `(SELECT ROW_TO_JSON(results) AS "${reportName}ApplicantReport"
        from (
              SELECT 
                applicantdata."applicationData",
                report."reportName",
                report.status,
                report."reportData",
                EXTRACT(EPOCH FROM report."validUntil" - NOW()) < 0 AS "isReportExpired",
                report."serviceStatus",
                (SELECT 
                  response."serviceBlockedStatus"
                FROM db_namespace."ApplicantReportResponseTracking" response
                WHERE response."screeningRequestId" = request.id
                ORDER BY created_at DESC LIMIT 1) AS "serviceBlockedStatus"
              FROM db_namespace."ApplicantReport" report
              INNER JOIN db_namespace."ApplicantData" applicantdata ON applicantdata.id = report."applicantDataId"
              LEFT OUTER JOIN db_namespace."ApplicantReportRequestTracking" request ON request."applicantReportId" = report.id
              WHERE report.status <> :pendingReportStatus AND report.status <> :canceledReportStatus AND report."reportName" = '${reportName}'
              AND applicantdata.id = app.id
              ORDER by report.created_at DESC LIMIT 1
        ) AS results
      )`,
    )
    .join(',');

  const query = `SELECT
      person.id AS "personId",
      partymember."memberType",
      party."leaseType",
      ${applicantReportSubQueries}
    FROM db_namespace."Person" person
    INNER JOIN db_namespace."PartyMember" partymember ON partymember."personId" = person.id
    INNER JOIN db_namespace."Party" party ON party.id = partymember."partyId"
    LEFT OUTER JOIN db_namespace."ApplicantData" app ON app."personId" = person.id
    WHERE party.id = :partyId
    AND partymember."endDate" IS NULL
    AND person."mergedWith" IS NULL
    AND app."endDate" IS NULL`;

  const { rows } = await rawStatement(ctx, query, [
    {
      partyId,
      pendingReportStatus: ApplicantReportStatus.PENDING,
      canceledReportStatus: ApplicantReportStatus.CANCELED,
    },
  ] as never[]);

  return rows;
};
