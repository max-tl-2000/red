/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subtype: 'import-repo' });

export const saveImportEntry = async (ctx, entry) => {
  logger.trace({ ctx, importEntryInfo: { ...omit(entry, ['rawData']) } }, 'saveImportEntry');

  const { rawData, primaryExternalId, propertyExternalId, status } = entry;

  const { rows } = await rawStatement(
    ctx,
    `
    INSERT INTO db_namespace."ResidentImportTracking"
      ("id", "rawData", "primaryExternalId", "propertyExternalId", "status", "lastSyncDate")
    VALUES ("public".gen_random_uuid(), (:rawData)::jsonb, :primaryExternalId, :propertyExternalId, :status, now())
    RETURNING *;
    `,
    [
      {
        rawData,
        primaryExternalId,
        propertyExternalId,
        status,
      },
    ],
  );

  return rows[0];
};

export const setStatusById = async (ctx, { id, status, importResult }) => {
  logger.trace({ ctx, id }, 'setStatusByNameId');

  const { rows } = await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ResidentImportTracking"
    SET status = :status, "importResult" = :importResult
    WHERE id = :id
    AND status = '${DALTypes.ResidentImportStatus.PENDING}';
    `,
    [{ id, status, importResult }],
  );

  return rows[0];
};

export const getAllActiveMovingOutPrimaryExternalIds = async (ctx, propertyExternalId) => {
  logger.trace({ ctx, propertyExternalId }, 'getAllActiveMovingOutPrimaryExternalIds');

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM."externalId"
      FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" p on extPM."partyId" = p.id
      INNER JOIN db_namespace."Property" prop on extPM."propertyId" = prop.id
      INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd on p.id = alwd."partyId"
      WHERE extPM."isPrimary" IS TRUE
      AND extPM."endDate" IS NULL
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (alwd.metadata ->> 'vacateDate' IS NOT NULL OR (alwd."leaseData" ->> 'leaseEndDate')::timestamptz < NOW())
      AND prop."externalId" = :propertyExternalId
      `,
    [{ propertyExternalId }],
  );

  return rows && rows.map(row => row.externalId);
};

export const getPersonByExternalIdMatch = async (ctx, externalId) => {
  logger.trace({ ctx, externalId }, 'getPersonByExternalIdMatch');

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT p.* FROM db_namespace."Person" p
      INNER JOIN db_namespace."PartyMember" pm on p.id = pm."personId"
      INNER JOIN db_namespace."ExternalPartyMemberInfo" epmi on pm.id = epmi."partyMemberId"
    WHERE epmi."externalId" = :externalId
    `,
    [{ externalId }],
  );

  return rows && rows[0];
};

export const getPartyWorkflows = async (ctx, { externalIds, excludeInactive = false }) => {
  logger.trace({ ctx, externalIds, excludeInactive }, 'getPartyWorkflows');

  const excludeInactivePartiesFilter = excludeInactive ? `AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'` : '';

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT DISTINCT "partyId" AS id, p."workflowName", p."workflowState", p."state", p."partyGroupId", p."leaseType", p.created_at AS "createdAt", p2.created_at AS "seedPartyCreatedAt"
	  FROM db_namespace."ExternalPartyMemberInfo" epmi
      INNER JOIN db_namespace."Party" p ON epmi."partyId" = p.id
      LEFT JOIN db_namespace."Party" p2 ON p."seedPartyId" = p2.id
    WHERE (ARRAY["externalId"] <@ :externalIds OR ARRAY["externalRoommateId"] <@ :externalIds)
    ${excludeInactivePartiesFilter}
    `,
    [{ externalIds }],
  );

  return rows || [];
};

export const getAllInventoriesForProperty = async (ctx, propertyId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT i.id, i.type, p."externalId" AS "propertyExternalId", b."externalId" AS "buildingExternalId", i."externalId" AS "inventoryExternalId"
      FROM db_namespace."Inventory" i
        INNER JOIN db_namespace."Building" b ON i."buildingId" = b.id
        INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
      WHERE i."propertyId" = :propertyId AND i."externalId" <> ''`,
    [{ propertyId }],
  );

  return rows || [];
};

export const getMatchingNewLeasePartyByInventory = async (ctx, partyIds, inventoryId) => {
  logger.trace({ ctx, partyIds, inventoryId }, 'getMatchingNewLeasePartyByInventory');

  const { rows } = await rawStatement(
    ctx,
    `SELECT p.id AS "partyId", l.id AS "leaseId"
      FROM db_namespace."Party" p
        INNER JOIN db_namespace."Lease" l on p.id = l."partyId"
      WHERE l.status IN ('${DALTypes.LeaseStatus.SUBMITTED}', '${DALTypes.LeaseStatus.EXECUTED}')
      AND ARRAY[p.id::varchar(36)] <@ :partyIds
      AND p."workflowName" = '${DALTypes.WorkflowName.NEW_LEASE}'
      AND p.state IN ('${DALTypes.PartyStateType.LEASE}', '${DALTypes.PartyStateType.FUTURERESIDENT}', '${DALTypes.PartyStateType.RESIDENT}')
      AND l."baselineData"->'quote'->> 'inventoryId' = :inventoryId
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'`,
    [{ partyIds, inventoryId }],
  );

  return rows && rows[0];
};

export const getNewLeaseExternalInfoByExternalIds = async (ctx, externalIds) => {
  logger.trace({ ctx, externalIds }, 'getNewLeaseExternalInfoByExternalIds');

  const { rows } = await rawStatement(
    ctx,
    `SELECT extPM.*
      FROM db_namespace."ExternalPartyMemberInfo" extPM
      INNER JOIN db_namespace."Party" p on extPM."partyId" = p.id
        AND p."workflowName" = '${DALTypes.WorkflowName.NEW_LEASE}'
        AND p.state IN ('${DALTypes.PartyStateType.LEASE}', '${DALTypes.PartyStateType.FUTURERESIDENT}', '${DALTypes.PartyStateType.RESIDENT}')
        WHERE (ARRAY[extPM."externalId"::varchar(36)] <@ :externalIds OR ARRAY[extPM."externalRoommateId"::varchar(36)] <@ :externalIds)
        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'`,
    [{ externalIds }],
  );

  return rows || [];
};

export const getLastResidentImportTrackingByPrimaryExternalId = async (ctx, primaryExternalId) => {
  logger.trace({ ctx, primaryExternalId }, 'getLastResidentImportTrackingByPrimaryExternalId');

  const { rows } = await rawStatement(
    ctx,
    `SELECT rit.*
      FROM db_namespace."ResidentImportTracking" rit
      WHERE rit."primaryExternalId" = :primaryExternalId
      ORDER BY rit.created_at DESC`,
    [{ primaryExternalId }],
  );

  return rows && rows[0];
};

export const getLastImportedEntriesByPropertyExternalId = async (
  ctx,
  { propertyExternalId, lastSuccessfulSyncDateForProperty, processedEntriesOnly = true },
) => {
  logger.trace({ ctx, propertyExternalId, lastSuccessfulSyncDateForProperty, processedEntriesOnly }, 'getLastImportedEntriesByPropertyExternalId');

  const propertySyncDateCondition = lastSuccessfulSyncDateForProperty ? 'AND rit."lastSyncDate"::date = :lastSuccessfulSyncDateForProperty' : '';
  const statusCondition = processedEntriesOnly ? `AND rit."status" = '${DALTypes.ResidentImportStatus.PROCESSED}'` : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT DISTINCT ON (rit."primaryExternalId") rit."primaryExternalId", rit."rawData", rit."wasAddedToExceptionReport", rit.id, rit.created_at
      FROM db_namespace."ResidentImportTracking" rit
    WHERE rit."propertyExternalId" = :propertyExternalId
    ${statusCondition}
    ${propertySyncDateCondition}
    ORDER BY rit."primaryExternalId", rit."lastSyncDate" desc`,
    [{ propertyExternalId, lastSuccessfulSyncDateForProperty }],
  );

  return rows;
};

export const updateLastSyncDate = async (ctx, id) => {
  logger.trace({ ctx, id }, 'updateLastSyncDate');

  const { rows } = await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ResidentImportTracking"
      SET "lastSyncDate" = now()
    WHERE id = :id;
    `,
    [{ id }],
  );

  return rows && rows[0];
};

export const setResidentImportTrackingAsAddedToExceptionReport = async (ctx, id) => {
  logger.trace({ ctx, id }, 'setResidentImportTrackingAsAddedToExceptionReport');

  const { rows } = await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ResidentImportTracking"
      SET "wasAddedToExceptionReport" = TRUE
    WHERE id = :id;
    `,
    [{ id }],
  );

  return rows && rows[0];
};

// we want to process an import entry everytime when we the renewal is active and once after the renewal party is archived and a new active lease is spawned
export const getRenewalEntryToProcessByExternalId = async (ctx, propertyExternalId) => {
  logger.trace({ ctx, propertyExternalId }, 'getRenewalEntryToProcessByExternalId');

  const { rows } = await rawStatement(
    ctx,
    `SELECT epmi."externalId"
		FROM db_namespace."ExternalPartyMemberInfo" epmi
		  INNER JOIN db_namespace."Party" p ON epmi."partyId" = p.id
		  INNER JOIN db_namespace."Property" prop ON prop.id = p."assignedPropertyId"
		  INNER JOIN db_namespace."RecurringJobs" rj ON rj.name = '${DALTypes.Jobs.ImportAndProcessPartyWorkflows}'
	  WHERE prop."externalId" = :propertyExternalId
	 	  AND epmi."isPrimary" IS TRUE
      AND ((p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}')
          OR (p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND p."workflowState" = '${DALTypes.WorkflowState.ARCHIVED}'
        AND p."archiveDate" > (rj.metadata -> 'progress' -> :propertyExternalId ->> 'lastSuccessfulSyncDate')::timestamp))
         `,
    [{ propertyExternalId }],
  );

  return rows || [];
};

export const getNewlyCreatedActiveLeaseExternalIdsToProcess = async (ctx, { propertyExternalId, lastSuccessfulSyncDateForProperty }) => {
  logger.trace({ ctx, propertyExternalId, lastSuccessfulSyncDateForProperty }, 'getNewlyCreatedActiveLeaseExternalIdsToProcess');
  if (!lastSuccessfulSyncDateForProperty) return [];

  const { rows } = await rawStatement(
    ctx,
    `SELECT epmi."externalId"
		FROM db_namespace."ExternalPartyMemberInfo" epmi
		  INNER JOIN db_namespace."Party" p ON epmi."partyId" = p.id
		  INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = p.id
		  INNER JOIN db_namespace."Property" prop ON prop.id = p."assignedPropertyId"
	  WHERE prop."externalId" = :propertyExternalId
  	  AND epmi."isPrimary" IS TRUE
      AND epmi."endDate" IS NULL
      AND p."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (alwd.created_at::date >= :lastSuccessfulSyncDateForProperty AND alwd.created_at::date <= NOW()::date)
         `,
    [{ propertyExternalId, lastSuccessfulSyncDateForProperty }],
  );

  return rows || [];
};

// only for testing purpose
export const updateActiveLeaseCreatedAtDate = async (ctx, id, created_at) => {
  logger.trace({ ctx, id, created_at }, 'updateActiveLeaseCreatedAtDate');

  const { rows } = await rawStatement(
    ctx,
    `
    UPDATE db_namespace."ActiveLeaseWorkflowData"
      SET "created_at" = :created_at
    WHERE id = :id;
    `,
    [{ id, created_at }],
  );

  return rows && rows[0];
};

export const getAllResidentImportTrackingEntries = async ctx => {
  logger.trace({ ctx }, 'getAllResidentImportTrackingEntries');

  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."ResidentImportTracking" rit', [{}]);

  return rows || [];
};
