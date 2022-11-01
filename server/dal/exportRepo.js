/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, insertOrUpdate, updateOne, getOne, rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subtype: 'exportRepo' });

export const retrieveDataForOneToManyExport = async (conn, tenantId) => {
  logger.trace({ tenantId }, 'retrieveDataForOneToManyExport');

  return await conn.raw('SELECT * FROM :schema:.generate_one_to_manys_data();', {
    schema: `${tenantId}`,
  });
};

export const getExportLog = async (ctx, id) => {
  logger.trace({ ctx, id }, 'getExportLog');

  return await initQuery(ctx).from('ExportLog').where({ id }).first();
};

export const getExportLogs = async (ctx, partyId, type) => {
  logger.trace({ ctx, partyId, type }, 'getExportLogs');

  return await initQuery(ctx).from('ExportLog').where({ partyId }).andWhere({ type }).orderBy('created_at', 'desc');
};

export const getPendingExportLogs = async ctx => {
  logger.trace({ ctx }, 'getPendingExportLogs');

  const { rows } = await rawStatement(
    ctx,
    `SELECT "externalId", "type", "partyId", json_agg(row_to_json(db_namespace."ExportLog".*)) AS "groupedLogs"
        FROM db_namespace."ExportLog"
            WHERE processed IS NULL
            AND status = :status
            GROUP BY "externalId", "type", "partyId"
            ORDER BY "externalId", "type", "partyId";
    `,
    [{ status: DALTypes.EXPORT_LOG_STATUS.PENDING }],
  );

  return rows;
};

export const saveExportLog = async (ctx, exportLog) => {
  logger.trace({ ctx, exportLog }, 'insertExportLog');

  return await insertInto(ctx.tenantId, 'ExportLog', exportLog);
};

export const updateExportLog = async (ctx, exportLog) => {
  logger.trace({ ctx, exportLog }, 'updateExportLog');

  return await updateOne(ctx.tenantId, 'ExportLog', exportLog.id, exportLog);
};

export const updateExportLogMetadata = async (ctx, exportLogIds, data) => {
  logger.trace({ ctx, exportLogIds, exportLogMetadata: data }, 'updateExportLog');

  const ids = exportLogIds.map(id => `'${id}'`).join(',');

  return await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ExportLog"
      SET metadata = jsonb_set(metadata, '{fileData}', :data)
      WHERE id IN (${ids});
    `,
    [{ exportLogIds, data }],
  );
};

export const updateExternalInfoExportData = async (ctx, id, exportData) => {
  logger.trace({ ctx, id, externalInfoMetadata: exportData }, 'updateExternalInfoExportData');

  return await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ExternalPartyMemberInfo"
      SET metadata = jsonb_set(metadata, '{exportData}', :exportData)
      WHERE id = :id;
    `,
    [{ id, exportData }],
  );
};

export const markExportLogsAsProcessed = async (ctx, exportLogIds) => {
  logger.trace({ ctx, exportLogIds }, 'markExportLogsAsProcessed');

  return await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ExportLog" SET "processed" = now(), status = :status WHERE ARRAY[id] <@ :exportLogIds;
    `,
    [
      {
        exportLogIds,
        status: DALTypes.EXPORT_LOG_STATUS.EXPORTED,
      },
    ],
  );
};

export const getMergePartyExportData = async (ctx, mergePartyMatchesId) => {
  logger.trace({ ctx, mergePartyMatchesId }, 'getMergePartyExportData');

  return await getOne(ctx, 'MergePartyMatches', mergePartyMatchesId, [], ['exportData']);
};

export const removePrimaryTenantFlag = async (ctx, partyMemberId) => {
  logger.trace({ ctx, partyMemberId }, 'removePrimaryTenantFlag');

  const result = await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo" extPM
        INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
      SET extPM."isPrimary" = FALSE
      WHERE extPM."partyMemberId" = :partyMemberId
        AND extPM."endDate" IS NULL
        AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'
        RETURNING *`,
    [{ partyMemberId }],
  );

  return result.rows[0];
};

export const insertExternalInfo = async (ctx, externalInfo) => {
  logger.trace({ ctx, externalInfo }, 'insertExternalInfo');

  return await insertInto(ctx, 'ExternalPartyMemberInfo', externalInfo);
};

export const insertOrUpdateExternalInfo = async (ctx, externalInfo, options) => {
  logger.trace({ ctx, externalInfo, options }, 'insertOrUpdateExternalInfo');

  return await insertOrUpdate(ctx, 'ExternalPartyMemberInfo', externalInfo, options);
};

export const updateExternalInfo = async (ctx, externalInfo) => {
  logger.trace({ ctx, externalInfoId: externalInfo?.id }, 'updateExternalInfo');

  return await updateOne(ctx, 'ExternalPartyMemberInfo', externalInfo.id, externalInfo);
};

export const archiveAllExternalInfoByPartyAndProperty = async (ctx, { partyId, propertyId, leaseId = null }) => {
  logger.trace({ ctx, partyId, propertyId, leaseId }, 'archiveAllExternalInfoByPartyAndProperty');

  const leaseIdFilter = leaseId ? 'AND "leaseId" = :leaseId' : '';

  return await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo"
            SET "endDate" = now()
            WHERE "partyId" = :partyId
            AND "propertyId" = :propertyId
            AND "endDate" IS NULL
            ${leaseIdFilter}`,
    [{ partyId, propertyId, leaseId }],
  );
};

export const getExternalInfoByPartyIdAndChildInfo = async (ctx, { partyId, info, leaseId }) => {
  logger.trace({ ctx, partyId, info, leaseId }, 'getExternalInfoByPartyIdAndChildInfo');

  const leaseIdFilter = leaseId ? 'AND (extPM."leaseId" = :leaseId OR extPM."leaseId" IS NULL) ORDER BY extPM."leaseId" NULLS LAST' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM."externalId", extPM."isPrimary", extPM."externalProspectId", extPM."externalRoommateId"
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party_AdditionalInfo" pa ON pa.id = extPM."childId"
    WHERE pa."partyId" = :partyId
      AND pa.type = '${DALTypes.AdditionalPartyMemberType.CHILD}'
      AND pa.info ->> 'fullName' = :fullName
      AND pa.info ->> 'preferredName' = :preferredName
      ${leaseIdFilter}
        `,
    [{ partyId, fullName: info.fullName, preferredName: info.preferredName, leaseId }],
  );

  return rows[0];
};

export const getActiveExternalInfo = async (ctx, partyMemberId, leaseId) => {
  logger.trace({ ctx, partyMemberId }, 'getActiveExternalInfo');

  const leaseIdFilter = leaseId ? 'AND extPM."leaseId" = :leaseId' : '';
  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyMemberId" = :partyMemberId
      AND extPM."endDate" IS NULL
      AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'
      ${leaseIdFilter}`,
    [{ partyMemberId, leaseId }],
  );

  return rows[0];
};

export const getActiveExternalInfoForMRI = async (ctx, partyMemberId, propertyId, leaseId) => {
  logger.trace({ ctx, partyMemberId, propertyId }, 'getActiveExternalInfoForMRI');

  const leaseIdFilter = leaseId ? 'AND extPM."leaseId" = :leaseId' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
     WHERE (extPM."partyMemberId" = :partyMemberId OR extPM."childId" = :partyMemberId)
      AND extPM."propertyId" = :propertyId
      AND extPM."endDate" IS NULL
      AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'
      ${leaseIdFilter}`,
    [{ partyMemberId, leaseId, propertyId }],
  );

  return rows[0];
};

export const getActiveExternalInfoByParty = async (ctx, { partyId, includeArchivedParties = false }) => {
  logger.trace({ ctx, partyId }, 'getActiveExternalInfoByParty');

  const archivedPartiesFilter = !includeArchivedParties
    ? `AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}' AND extPM."endDate" IS NULL`
    : 'ORDER BY extPM."endDate" DESC';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyId" = :partyId
      ${archivedPartiesFilter}`,
    [{ partyId }],
  );

  return rows;
};

export const getArchivedExternalInfoByPartyForProperty = async (ctx, partyId, propertyId) => {
  logger.trace({ ctx, partyId, propertyId }, 'getArchivedExternalInfoByPartyForProperty');

  const { rows } = await rawStatement(
    ctx,
    `SELECT DISTINCT ON (extPM."externalId", extPM."externalRoommateId") extPM."externalId", extPM."externalRoommateId", 
            extPM."partyId", extPM."partyMemberId", extPM."childId", extPM."leaseId", extPM."startDate", 
            extPM."externalProspectId", extPM."isPrimary", extPM.metadata, extPM."propertyId"
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
      LEFT JOIN db_namespace."PartyMember" pm ON pm."id" = extPM."partyMemberId"
    WHERE extPM."partyId" = :partyId 
    AND extPM."propertyId" = :propertyId
    AND extPM."endDate" IS NOT NULL
    AND pm."endDate" IS NULL;`,
    [{ partyId, propertyId }],
  );

  return rows;
};

export const getActiveExternalInfoByPartyForMRI = async (ctx, partyId, propertyId, leaseId) => {
  logger.trace({ ctx, partyId, propertyId, leaseId }, 'getActiveExternalInfoByPartyForMRI');

  const leaseIdFilter = leaseId ? 'AND extPM."leaseId" = :leaseId' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyId" = :partyId
      AND extPM."endDate" IS NULL
      AND extPM."propertyId" = :propertyId
      AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'
      ${leaseIdFilter}`,
    [{ partyId, propertyId, leaseId }],
  );

  return rows;
};

export const getPrimaryExternalInfoByParty = async (ctx, partyId, includeArchivedParties = false) => {
  logger.trace({ ctx, partyId, includeArchivedParties }, 'getPrimaryExternalInfoByParty');

  const archivedPartiesFilter = !includeArchivedParties
    ? `AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}' AND extPM."endDate" IS NULL`
    : 'ORDER BY extPM."endDate" DESC';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyId" = :partyId
      AND extPM."externalId" IS NOT NULL
      AND extPM."isPrimary" = TRUE
      ${archivedPartiesFilter}`,
    [{ partyId }],
  );

  return rows[0];
};

export const getPartyGroupIdByExternalId = async (ctx, externalId) => {
  logger.trace({ ctx, externalId }, 'getPartyGroupIdByExternalId');

  const query = `
    SELECT p."partyGroupId" FROM db_namespace."Party" p
    INNER JOIN db_namespace."ExternalPartyMemberInfo" epi ON epi."partyId" = p.id
    WHERE epi."externalId" = :externalId
    LIMIT 1
  `;
  const { rows } = await rawStatement(ctx, query, [{ externalId }]);
  return rows[0];
};

export const getPrimaryExternalIdByPartyGroupId = async (ctx, partyGroupId) => {
  logger.trace({ ctx, partyGroupId }, 'getPrimaryExternalIdByPartyGroupId ');

  const query = `
    SELECT e."externalId" FROM db_namespace."ExternalPartyMemberInfo" e
    INNER JOIN db_namespace."Party" p on p.id = e."partyId"
    WHERE p."partyGroupId" = :partyGroupId
    AND e."isPrimary" IS TRUE
    AND e."endDate" IS NULL
    AND p."assignedPropertyId" = e."propertyId"
    LIMIT 1
  `;
  const { rows } = await rawStatement(ctx, query, [{ partyGroupId }]);

  return rows[0];
};

export const getExternalInfoByLeaseId = async (ctx, leaseId, includeArchivedParties = false) => {
  logger.trace({ ctx, leaseId, includeArchivedParties }, 'getExternalInfoByLeaseId ');

  const archivedPartiesFilter = !includeArchivedParties
    ? `AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}' AND extPM."endDate" IS NULL`
    : 'ORDER BY extPM."endDate" DESC';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."leaseId" = :leaseId
      AND extPM."externalId" IS NOT NULL
      ${archivedPartiesFilter}`,
    [{ leaseId }],
  );

  return rows[0];
};

export const getExternalInfoByExternalIdAndPartyId = async (ctx, externalId, partyId) => {
  logger.trace({ ctx, externalId }, 'getExternalInfoByExternalIdAndPartyId');

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
      FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
     WHERE extPM."externalId" = :externalId AND extPM."partyId" = :partyId`,
    [{ externalId, partyId }],
  );

  return rows[0];
};

export const getExternalInfoByPartyMemberId = async (ctx, partyMemberId, leaseId = null) => {
  logger.trace({ ctx, partyMemberId }, 'getExternalInfoByPartyMemberId ');

  const leaseIdFilter = leaseId ? 'AND extPM."leaseId" = :leaseId' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
    WHERE extPM."partyMemberId" = :partyMemberId
    ORDER BY extPM.created_at DESC
    ${leaseIdFilter}`,
    [{ partyMemberId, leaseId }],
  );

  return rows[0];
};

export const getPrimaryExternalInfoByPartyAndProperty = async (ctx, partyId, propertyId, leaseId, includeArchivedPartiesAndMembers = false) => {
  logger.trace({ ctx, partyId, propertyId, leaseId }, 'getPrimaryExternalInfoByPartyAndProperty');

  const leaseIdFilter = leaseId ? 'AND ( "leaseId" = :leaseId OR "leaseId" is null)' : '';

  const archivedPartiesFilter = !includeArchivedPartiesAndMembers
    ? `AND party."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}' AND extPM."endDate" IS NULL`
    : 'ORDER BY extPM."endDate" DESC';

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyId" = :partyId
      AND extPM."propertyId" = :propertyId
      AND extPM."externalId" IS NOT NULL
      AND extPM."isPrimary" = TRUE
      ${leaseIdFilter}
      ${archivedPartiesFilter}`,
    [{ partyId, propertyId, leaseId }],
  );

  return rows[0];
};

export const getMainExternalInfoByPartyAndProperty = async (ctx, partyId, propertyId) => {
  logger.trace({ ctx, partyId, propertyId }, 'getMainExternalInfoByPartyAndProperty');

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
    FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" party ON extPM."partyId" = party.id
    WHERE extPM."partyId" = :partyId
      AND extPM."propertyId" = :propertyId
      AND extPM."externalId" IS NOT NULL
      AND extPM."isPrimary" = TRUE
      AND "leaseId" IS NULL
      ORDER BY extPM."endDate" DESC`,
    [{ partyId, propertyId }],
  );

  return rows[0];
};

export const getAllExternalInfoByParty = async (ctx, partyId, leaseId) => {
  logger.trace({ ctx, partyId }, 'getAllExternalInfoByParty');

  const leaseIdFilter = leaseId ? 'AND "leaseId" = :leaseId' : '';
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."ExternalPartyMemberInfo"
                                  WHERE "partyId" = :partyId
                                  ${leaseIdFilter}
                                  ORDER BY "endDate" DESC`,
    [{ partyId, leaseId }],
  );

  return rows;
};

export const getAllExternalInfoByPartyForMRI = async (ctx, partyId, propertyId, leaseId) => {
  logger.trace({ ctx, partyId, propertyId }, 'getAllExternalInfoByPartyForMRI');

  const leaseIdFilter = leaseId ? 'AND "leaseId" = :leaseId' : '';
  const propertyIdFilter = propertyId ? 'AND "propertyId" = :propertyId' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."ExternalPartyMemberInfo"
                                  WHERE "partyId" = :partyId
                                  ${propertyIdFilter}
                                  ${leaseIdFilter}`,
    [{ partyId, propertyId, leaseId }],
  );

  return rows;
};

export const updateExternalInfoEndDateByPartyId = async (ctx, partyId, endDate) => {
  logger.trace({ ctx, partyId, externalInfoEndDate: JSON.stringify(endDate) }, 'updateExternalInfoEndDateByPartyId');
  return await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo"
            SET "endDate" = :endDate
            WHERE "partyId" = :partyId AND "endDate" IS NULL`,
    [{ partyId, endDate }],
  );
};

// Each exported resident will have a unique code to be identified in Yardi.
// Limited to 8 characters and should end with an "t" and count sequentially up with the other 7 digits (IE, 0000001t, 0000002t, 0000003t, etc)
const externalCodesFormat = 'FM0000000';

export const getNextPrimaryTenantCode = async ctx => {
  logger.trace({ ctx }, 'getNextPrimaryTenantCode');

  const query = 'SELECT to_char(nextval(\'db_namespace."partyMemberExternalIdSeq"\'), :format) AS code';
  const queryResult = await rawStatement(ctx, query, [{ format: externalCodesFormat }]);

  const { code } = queryResult.rows[0];

  return `${code}t`;
};

export const getNextProspectCode = async ctx => {
  logger.trace({ ctx }, 'getNextProspectCode');

  const query = 'SELECT to_char(nextval(\'db_namespace."partyMemberExternalProspectIdSeq"\'), :format) AS code';
  const queryResult = await rawStatement(ctx, query, [{ format: externalCodesFormat }]);

  const { code } = queryResult.rows[0];

  return `${code}p`;
};

export const getNextRoommateCode = async ctx => {
  logger.trace({ ctx }, 'getNextRoommateCode');

  const query = 'SELECT to_char(nextval(\'db_namespace."partyMemberExternalRoommateIdSeq"\'), :format) AS code';
  const queryResult = await rawStatement(ctx, query, [{ format: externalCodesFormat }]);

  return queryResult.rows[0].code;
};

export const isRoommateRemoved = async (ctx, roommateCode, isMinor) => {
  logger.trace({ ctx, roommateCode, isMinor }, 'isRoommateRemoved');

  if (isMinor) {
    const query = 'SELECT * FROM db_namespace."Party_AdditionalInfo" WHERE "externalRoommateId" = :roommateCode';
    const { rows } = await rawStatement(ctx, query, [{ roommateCode }]);

    return rows[0];
  }

  const query = `SELECT pm."endDate" 
                 FROM db_namespace."PartyMember" pm
                     INNER JOIN db_namespace."ExternalPartyMemberInfo" epmi ON epmi."partyMemberId" = pm.id 
                 WHERE epmi."externalRoommateId" = :roommateCode;`;

  const { rows } = await rawStatement(ctx, query, [{ roommateCode }]);

  const result = rows[0];
  return result && result.endDate;
};

export const reviveExternalPartyMemberInfoById = async (ctx, id) => {
  logger.trace({ ctx, id }, 'reviveExternalPartyMemberInfoById');
  await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo"
              SET "endDate" = null
            WHERE "id" = :id
            `,
    [{ id }],
  );
};

export const getActiveExternalInfoByPartyMember = async (ctx, partyMemberId) => {
  logger.trace({ ctx, partyMemberId }, 'getActiveExternalInfoByPartyMember');

  const { rows } = await rawStatement(
    ctx,
    `SELECT *
    FROM db_namespace."ExternalPartyMemberInfo" extPM
    WHERE extPM."partyMemberId" = :partyMemberId
      AND extPM."endDate" IS NULL
    `,
    [{ partyMemberId }],
  );

  return rows[0];
};

export const archiveExternalInfoByPartyMemberId = async (ctx, memberId) => {
  logger.trace({ ctx, memberId }, 'archiveExternalInfoByPartyMemberId');
  await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo"
        SET "endDate" = NOW()
        WHERE ("partyMemberId" = :memberId OR "childId" = :memberId)
        AND "endDate" IS NULL
      `,
    [{ memberId }],
  );
};

export const reviveExternalInfoByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'reviveExternalInfoByPartyId');
  return await rawStatement(
    ctx,
    `UPDATE db_namespace."ExternalPartyMemberInfo"
            SET metadata = metadata - 'lastArchiveDate' || jsonb_build_object('lastArchiveDate', "endDate"),
              "endDate" = NULL
          WHERE "partyId" = :partyId
          AND "endDate" IS NOT NULL
          AND ("externalId" IS NOT NULL OR "externalRoommateId" IS NOT NULL)`,
    [{ partyId }],
  );
};

export const markExportLogEntriesAsSkipped = async ctx => {
  logger.trace({ ctx }, 'markExportLogEntriesAsSkipped');

  const query = `UPDATE db_namespace."ExportLog" 
      SET status = :status, processed = now()
      WHERE processed IS NULL 
      AND ("leaseId" IS NOT NULL OR type NOT IN ('FinReceipts', 'FinCharges'))
      AND "partyId" IN (
          SELECT DISTINCT "partyId"
            FROM db_namespace."ExportLog" el
            INNER JOIN db_namespace."Property" p ON p."externalId" = (entries::jsonb)->0->>'Property_Code'
          WHERE status = :status OR (processed IS NULL
            AND "leaseId" IS NOT NULL
            AND type = 'ResTenants'
            AND (data->'entries'->0->>'Move_In_Date')::date <= to_char((el.created_at AT TIME ZONE p.timezone)::date, 'FMMM/FMDD/YYYY')::date)
          );`;

  const result = await rawStatement(ctx, query, [{ status: DALTypes.EXPORT_LOG_STATUS.SKIPPED }]);

  logger.trace({ ctx, updatedRows: result.rowCount }, 'markExportLogEntriesAsSkipped - updated rows');
};
