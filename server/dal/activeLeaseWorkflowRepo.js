/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subtype: 'activeLeaseWorkflowRepo' });
const MOVE_IN_CONFIRMATION_PERIOD = '7 days';

export const getActiveLeaseWorkflowDataByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getActiveLeaseWorkflowDataByPartyId');

  const query = `SELECT al.*, 
    CASE WHEN (al."leaseId" is NOT NULL AND EXISTS (
        SELECT 1 FROM db_namespace."LeaseSignatureStatus" lss
        WHERE lss."leaseId" = al."leaseId" AND "partyMemberId" IS NOT NULL
          AND lss.status = :signedSignatureStatus)) THEN TRUE
    ELSE FALSE
    END AS "hasDigitallySignedDocument"
    FROM db_namespace."ActiveLeaseWorkflowData" al
    WHERE "partyId" = :partyId
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, signedSignatureStatus: DALTypes.LeaseSignatureStatus.SIGNED }]);

  return rows[0];
};

export const getActiveLeasePartyIdBySeedPartyAndLeaseId = async (ctx, seedPartyId, leaseId) => {
  logger.trace({ ctx, seedPartyId, leaseId }, 'getActiveLeaseWfIdBySeedPartyAndLeaseId');

  const leaseIdFilter = leaseId ? 'AND "leaseId" = :leaseId' : '';

  const query = `SELECT alwd."partyId" as "activeLeasePartyId"
    FROM db_namespace."ActiveLeaseWorkflowData" alwd
    INNER JOIN db_namespace."Party" p ON alwd."partyId" = p.id
    WHERE p."seedPartyId" = :seedPartyId
      AND p."endDate" IS NOT NULL
      AND p."archiveDate" IS NOT NULL
    ${leaseIdFilter}
  `;

  const { rows } = await rawStatement(ctx, query, [{ seedPartyId, leaseId }]);

  return rows[0];
};

export const getActiveLeaseWorkflowDataBySeedPartyIdAndLeaseId = async (ctx, { seedPartyId, leaseId }) => {
  logger.trace({ ctx, seedPartyId, leaseId }, 'getActiveLeaseWorkflowDataBySeedPartyIdAndLeaseId');

  const query = `SELECT alwd.*
    FROM db_namespace."ActiveLeaseWorkflowData" alwd
    INNER JOIN db_namespace."Party" p ON p.id = alwd."partyId"
    WHERE p."seedPartyId" = :seedPartyId
    AND alwd."leaseId" = :leaseId
  `;

  const { rows } = await rawStatement(ctx, query, [{ seedPartyId, leaseId }]);

  return rows[0];
};

export const getActiveLeaseWorkflowDataById = async (ctx, id) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."ActiveLeaseWorkflowData"
      WHERE "id" = :id`,
    [{ id }],
  );

  return rows[0];
};

export const saveActiveLeaseWorkflowData = async (ctx, data) => {
  const {
    created_at,
    id = newId(),
    externalLeaseId = null,
    isImported = false,
    leaseId = null,
    partyId,
    state = DALTypes.ActiveLeaseState.NONE,
    updated_at,
    isExtension = false,
  } = data;
  const recurringCharges = JSON.stringify(data.recurringCharges) || [];
  const rentableItems = JSON.stringify(data.rentableItems) || [];
  const leaseData = JSON.stringify(data.leaseData) || {};
  const metadata = JSON.stringify(data.metadata) || {};
  const concessions = JSON.stringify(data.concessions) || [];
  const rolloverPeriod = data.leaseData?.leaseTerm === 1 ? DALTypes.RolloverPeriod.M2M : DALTypes.RolloverPeriod.NONE;

  logger.trace({ ctx, leaseId, partyId, id }, 'saveActiveLeaseWorkflowData');

  const query = `
    INSERT INTO db_namespace."ActiveLeaseWorkflowData"
      ("created_at", "externalLeaseId", "id", "isImported", "isExtension", "leaseData", "leaseId", "metadata",
      "partyId", "recurringCharges", "rentableItems", "concessions", "rolloverPeriod", "state", "updated_at")
    VALUES
      (now(), :externalLeaseId, :id, :isImported, :isExtension, :leaseData, :leaseId,
      :metadata, :partyId, :recurringCharges, :rentableItems, :concessions, :rolloverPeriod, :state, now())
    ON CONFLICT ("partyId") DO
    UPDATE
    SET
      "leaseId" = :leaseId,
      "recurringCharges" = :recurringCharges,
      "isImported" = :isImported,
      "updated_at" = now(),
      "rentableItems" = :rentableItems,
      "concessions" = :concessions,
      "state" = :state,
      "leaseData" = :leaseData,
      "metadata" = :metadata,
      "rolloverPeriod" = :rolloverPeriod,
      "externalLeaseId" = :externalLeaseId,
      "isExtension" = :isExtension
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      created_at,
      externalLeaseId,
      id,
      isImported,
      isExtension,
      leaseData,
      leaseId,
      metadata,
      concessions,
      partyId,
      recurringCharges,
      rentableItems,
      rolloverPeriod,
      state,
      updated_at,
    },
  ]);

  return rows[0];
};

export const getActiveLeaseIdByInventoryId = async (ctx, inventoryId, renewalPartyId) => {
  logger.trace({ ctx, inventoryId }, 'getActiveLeaseIdByInventoryId - params');

  const excludeCurrentPartyGroupQuery = renewalPartyId
    ? 'AND NOT EXISTS (SELECT 1 FROM db_namespace."Party" renewalParty where renewalParty.id = :renewalPartyId AND party."partyGroupId" = renewalParty."partyGroupId")'
    : '';

  const query = `
    SELECT alwd."partyId"
    FROM db_namespace."ActiveLeaseWorkflowData" alwd
      INNER JOIN db_namespace."Party" party ON alwd."partyId" = party.id
    WHERE (alwd."leaseData"->>'inventoryId') = :inventoryId
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      ${excludeCurrentPartyGroupQuery}
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId, renewalPartyId }]);
  return rows.length && rows[0].partyId;
};

export const getEligibleLeasesForRenewal = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getEligibleLeasesForRenewal - params');

  const propertyFilter = propertyIdsFilter ? 'AND party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND party."partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
    SELECT alwd."leaseId", party.id as "partyId"
    FROM db_namespace."ActiveLeaseWorkflowData" alwd
      INNER JOIN db_namespace."Party" party ON alwd."partyId" = party.id
      INNER JOIN db_namespace."Property" property ON party."assignedPropertyId" = property.id AND property."endDate" IS NULL
      LEFT JOIN db_namespace."Lease" lease ON alwd."leaseId" = lease.id
    WHERE NOT EXISTS (SELECT 1 FROM db_namespace."Party" p WHERE p."seedPartyId" = alwd."partyId" AND p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
      AND (p.metadata ->> 'archiveReasonId' <> 'RENEWAL_SPAWNED_OUT_RENEWAL_CYCLE' OR p.metadata ->> 'archiveReasonId' IS NULL))
      ${propertyFilter} ${partyGroupFilter}
      AND party."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND alwd.state <> '${DALTypes.ActiveLeaseState.MOVING_OUT}'
      AND (lease.status = '${DALTypes.LeaseStatus.EXECUTED}' OR lease.id IS NULL)
      AND alwd."rolloverPeriod" = '${DALTypes.RolloverPeriod.NONE}'
      AND alwd."isExtension" = FALSE
      AND (alwd."leaseData"->>'leaseEndDate')::timestamptz < now() + (property."settings"->'renewals'->>'renewalCycleStart' || ' days')::interval`;

  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows;
};

export const isPartyEligibleForRenewal = async (ctx, partyId) => {
  const query = `
    SELECT party.id
    FROM db_namespace."Party" party
      INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON party.id = alwd."partyId"
      LEFT JOIN db_namespace."Lease" lease ON alwd."leaseId" = lease.id
    WHERE party.id = :partyId
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Party" p
                      WHERE p."seedPartyId" = :partyId
                        AND p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
                        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}')
      AND party."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
      AND alwd.state <> '${DALTypes.ActiveLeaseState.MOVING_OUT}'
      AND alwd."metadata"->>'vacateDate' is NULL
      AND (lease.status = '${DALTypes.LeaseStatus.EXECUTED}' OR lease.id IS NULL)
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return !!rows.length;
};

export const getEligibleLeasesForOneMonthLeaseTerm = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getEligibleLeasesForOneMonthLeaseTerm - params');

  const propertyFilter = propertyIdsFilter ? 'AND active_lease_party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND active_lease_party."partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
    SELECT DISTINCT alwd."partyId" FROM db_namespace."ActiveLeaseWorkflowData" AS alwd
      INNER JOIN db_namespace."Party" active_lease_party ON ACTIVE_LEASE_PARTY.id = alwd."partyId"
        AND active_lease_party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      INNER JOIN db_namespace."Party" renewal_party ON renewal_party."seedPartyId" = alwd."partyId"
        AND renewal_party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND renewal_party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      INNER JOIN db_namespace."Quote" q ON q."partyId" = renewal_party.id AND q."publishDate" IS NOT NULL
      INNER JOIn db_namespace."Property" prop ON active_lease_party."assignedPropertyId" = prop.id AND prop."endDate" IS NULL
    WHERE alwd.state <> '${DALTypes.ActiveLeaseState.MOVING_OUT}'
      AND (
        (alwd."isExtension" = FALSE AND date_trunc('day', (alwd."leaseData" ->> 'leaseEndDate')::timestamptz) < date_trunc('day', NOW()))
        OR
        (alwd."isExtension" = TRUE AND date_trunc('day', (alwd."leaseData" ->> 'computedExtensionEndDate')::timestamptz) < date_trunc('day', NOW()))
        )
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Lease" AS l
                WHERE l."partyId" = renewal_party.id
                AND l.status IN ('${DALTypes.LeaseStatus.SUBMITTED}', '${DALTypes.LeaseStatus.EXECUTED}'))
      ${propertyFilter} ${partyGroupFilter}
    `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows.map(({ partyId }) => partyId);
};

export const updateActiveLeaseData = async (ctx, id, updatedLeaseData) => {
  logger.trace({ ctx, id, updatedLeaseData }, 'updateActiveLeaseData');

  const { rows } = await rawStatement(
    ctx,
    `UPDATE db_namespace."ActiveLeaseWorkflowData" SET "leaseData" = :updatedLeaseData
      WHERE id = :id RETURNING *`,
    [{ updatedLeaseData, id }],
  );

  return rows[0];
};

export const getActiveLeaseWfsWithoutConfirmedMoveIn = async (ctx, propertyIds, partyGroupIdFilter) => {
  logger.trace({ ctx, propertyIds, partyGroupIdFilter }, 'getActiveLeaseWfsWithoutConfirmedMoveIn');

  const partyGroupFilter = partyGroupIdFilter ? 'AND p."partyGroupId" = :partyGroupIdFilter' : '';
  const propertyIdFilter = propertyIds?.length ? 'AND p."assignedPropertyId" = ANY(:propertyIds)' : '';

  const toPropertyTimezoneQuery = "AT TIME ZONE 'UTC' AT TIME ZONE";
  const formattedMoveInDate = `DATE_TRUNC('day', (ald."leaseData" ->> 'moveInDate')::TIMESTAMP ${toPropertyTimezoneQuery} prop.timezone)`;
  const formattedmoveInConfirmationPeriod = `DATE_TRUNC('day',(now() - '${MOVE_IN_CONFIRMATION_PERIOD}'::INTERVAL)::TIMESTAMP ${toPropertyTimezoneQuery} prop.timezone)`;

  const { rows } = await rawStatement(
    ctx,
    `SELECT ald.*, p."partyGroupId"
      FROM db_namespace."ActiveLeaseWorkflowData" ald
      INNER JOIN db_namespace."Party" p ON p.id = ald."partyId"
      INNER JOIN db_namespace."Property" prop ON p."assignedPropertyId" = prop.id
      AND prop."endDate" IS NULL
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (ald."metadata" ->> 'moveInConfirmed' IS NULL OR (ald."metadata" ->> 'moveInConfirmed')::BOOLEAN = FALSE)
      AND ${formattedMoveInDate} < ${formattedmoveInConfirmationPeriod}
      ${propertyIdFilter}
      ${partyGroupFilter}
    `,
    [{ partyGroupIdFilter, propertyIds }],
  );
  return rows;
};

export const setActiveLeaseExtension = async (ctx, activeLeaseWorkflowDataId) => {
  const query = `
    UPDATE db_namespace."ActiveLeaseWorkflowData" SET
      "isExtension" = TRUE
    WHERE id = :activeLeaseWorkflowDataId
    RETURNING *
  `;
  const { rows } = await rawStatement(ctx, query, [{ activeLeaseWorkflowDataId }]);

  return rows[0];
};

export const getEligibleActiveLeaseForExtension = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getEligibleActiveLeaseForExtension - params');

  const propertyFilter = propertyIdsFilter ? 'AND active_lease_party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND active_lease_party."partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
    SELECT active_lease.id FROM
      (SELECT	alwd.* FROM	db_namespace."ActiveLeaseWorkflowData" AS alwd
      INNER JOIN db_namespace."Party" active_lease_party ON active_lease_party.id = alwd."partyId"
        AND active_lease_party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      INNER JOIn db_namespace."Property" prop on active_lease_party."assignedPropertyId" = prop.id
        AND prop."endDate" IS NULL
      WHERE
        alwd."isExtension" = FALSE
        AND alwd.state <> '${DALTypes.ActiveLeaseState.MOVING_OUT}'
        AND (alwd."metadata" ->> 'moveOutConfirmed' IS NULL OR (alwd."metadata" ->> 'moveOutConfirmed')::boolean = FALSE)
        AND date_trunc('day', (alwd."leaseData" ->> 'leaseEndDate')::timestamptz) < date_trunc('day', NOW())
        ${propertyFilter} ${partyGroupFilter}
      ) active_lease
      LEFT JOIN LATERAL
        (SELECT 1 FROM db_namespace."Party" AS p
        INNER JOIN db_namespace."Quote" q ON	q."partyId" = p.id
        WHERE
          p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
          AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
          AND p."seedPartyId" = active_lease."partyId"
          AND q."publishDate" IS NOT NULL
        LIMIT 1) renewal_published_quote ON	TRUE
    WHERE renewal_published_quote IS NULL
  `;
  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows.map(({ id }) => id);
};

export const getEligibleMovingOutActiveLeaseForExtension = async (ctx, { propertyIdsFilter, partyGroupIdFilter } = {}) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getEligibleMovingOutActiveLeaseForExtension - params');

  const propertyFilter = propertyIdsFilter ? 'AND active_lease_party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND active_lease_party."partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
      SELECT	alwd.id FROM	db_namespace."ActiveLeaseWorkflowData" AS alwd
      INNER JOIN db_namespace."Party" active_lease_party ON active_lease_party.id = alwd."partyId"
        AND active_lease_party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      INNER JOIn db_namespace."Property" prop ON active_lease_party."assignedPropertyId" = prop.id
        AND prop."endDate" IS NULL
      WHERE alwd."isExtension" = FALSE
        AND alwd.state = '${DALTypes.ActiveLeaseState.MOVING_OUT}'
        AND (alwd."leaseData" ->> 'leaseEndDate')::timestamptz < NOW()
        AND (alwd."leaseData" ->> 'leaseEndDate')::timestamptz < (alwd."metadata" ->> 'vacateDate')::timestamptz
        AND (alwd."metadata" ->> 'moveOutConfirmed' IS NULL OR (alwd."metadata" ->> 'moveOutConfirmed')::boolean = FALSE)
        ${propertyFilter} ${partyGroupFilter}
  `;
  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows.map(({ id }) => id);
};

export const getMovingOutActiveLeases = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getMovingOutActiveLeases - params');

  const propertyFilter = propertyIdsFilter ? 'AND p."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND p."partyGroupId" = :partyGroupIdFilter' : '';
  const query = `
    SELECT alwd.id, alwd."partyId"
    FROM db_namespace."ActiveLeaseWorkflowData" AS alwd
      INNER JOIN db_namespace."Party" p ON p.id = alwd."partyId" AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      INNER JOIN db_namespace."Property" prop ON p."assignedPropertyId" = prop.id AND prop."endDate" IS NULL
    WHERE alwd."metadata" ->> 'moveOutConfirmed' = 'true'
    ${propertyFilter} ${partyGroupFilter}
    `;
  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows;
};

export const getExtendedLeasesWithEndDateInPast = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getExtendedLeasesWithEndDateInPast - params');

  const propertyFilter = propertyIdsFilter ? 'AND p."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND p."partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
  SELECT a.id, a."leaseData", pr.timezone FROM db_namespace."ActiveLeaseWorkflowData" AS a
    INNER JOIN db_namespace."Party" p ON p.id = a."partyId"
    INNER JOIN db_namespace."Property" pr ON p."assignedPropertyId" = pr.id  AND pr."endDate" IS NULL
    WHERE a."isExtension" = TRUE
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND ("leaseData" ->> 'computedExtensionEndDate' IS NULL OR ("leaseData" ->> 'computedExtensionEndDate')::timestamptz < now())
      ${propertyFilter} ${partyGroupFilter}
  `;
  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);

  return rows;
};
