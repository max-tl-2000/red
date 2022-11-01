/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
import { partyStatesOrder } from '../helpers/party';

const logger = loggerModule.child({ subtype: 'renewalV1Repo' });

export const getTraditionalPartyGroupsWithUnLinkedRenewalsV1 = async (ctx, { propertyIdsFilter, partyGroupIdFilter } = {}) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'getTraditionalPartyGroupsWithUnLinkedRenewalsV1 ');
  const propertyFilter = propertyIdsFilter ? 'AND "assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND "partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
  WITH renewal_v1_group_id AS (
    SELECT DISTINCT "partyGroupId" FROM	db_namespace."Party"
      WHERE "workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND ( METADATA ->> 'V1RenewalState' = '${DALTypes.V1RenewalState.UNUSED}'
              OR METADATA ->> 'V1RenewalState' = '${DALTypes.V1RenewalState.RESIDENT_OR_FUTURE_RESIDENT}' )
        AND "leaseType" = '${DALTypes.PartyTypes.TRADITIONAL}'
        ${propertyFilter} ${partyGroupFilter}
    ),
    party_groups_with_renewal_v1 AS (
      SELECT
        pr.SETTINGS -> 'integration' -> 'import' ->> 'residentData' AS "importResidentData",
        p."workflowName",
        p.metadata,
        p.created_at,
        p.id,
        p.state,
        p."seedPartyId",
        p."partyGroupId",
        p."workflowName",
        p."leaseType"
      FROM db_namespace."Party" p
      INNER JOIN db_namespace."Property" pr ON pr.id = p."assignedPropertyId"
      WHERE p."partyGroupId" = ANY(SELECT * FROM renewal_v1_group_id)
    )
    SELECT ARRAY_AGG(ROW_TO_JSON(p)) "partyGroups" FROM party_groups_with_renewal_v1 p
    GROUP BY "partyGroupId"
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);
  return rows.map(pg => pg.partyGroups);
};

export const getCorporatePartyGroupsWithUnLinkedRenewalsV1 = async (ctx, { propertyIdsFilter, partyGroupIdFilter } = {}) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'getCorporatePartyGroupsWithUnLinkedRenewalsV1 ');
  const propertyFilter = propertyIdsFilter ? 'AND "assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND "partyGroupId" = :partyGroupIdFilter' : '';

  const query = `
    WITH renewal_v1_group_id AS (
      SELECT DISTINCT "partyGroupId" FROM	db_namespace."Party"
      WHERE "workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND ( METADATA ->> 'V1RenewalState' = '${DALTypes.V1RenewalState.UNUSED}'
              OR METADATA ->> 'V1RenewalState' = '${DALTypes.V1RenewalState.RESIDENT_OR_FUTURE_RESIDENT}' )
        AND "leaseType" = '${DALTypes.PartyTypes.CORPORATE}'
        ${propertyFilter} ${partyGroupFilter}
    ),
    party_groups_with_renewal_v1 AS (
      SELECT
        p."workflowName",
        COALESCE(lease."leaseInventoryId", quote."inventoryId"::text, active_lease."inventoryId") AS "inventoryId",
        p.created_at,
        p.id,
        p.state,
        p."seedPartyId",
        p."partyGroupId",
        p."workflowName",
        p.metadata,
        p."leaseType"
      FROM db_namespace."Party" p
      LEFT JOIN LATERAL ( SELECT l."baselineData" -> 'quote' ->> 'inventoryId' AS "leaseInventoryId" FROM db_namespace."Lease" l
                          WHERE l."partyId" = p.id
                            AND l.status IN ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
                        ) lease ON TRUE
      LEFT JOIN LATERAL ( SELECT q."inventoryId" FROM db_namespace."Quote" AS q
                           WHERE  q."partyId" = p.id
                            AND lease."leaseInventoryId" IS NULL
                          ORDER BY q.created_at DESC LIMIT 1
                        ) quote ON TRUE
      LEFT JOIN LATERAL ( SELECT "leaseData" ->> 'inventoryId' AS "inventoryId" FROM db_namespace."ActiveLeaseWorkflowData" alwd
                          WHERE p.ID = ALWD."partyId"
                        ) active_lease ON TRUE
      WHERE p."partyGroupId" = ANY(SELECT * FROM renewal_v1_group_id)
    )
    SELECT ARRAY_AGG(ROW_TO_JSON(p)) "partyGroups" FROM party_groups_with_renewal_v1 p
    GROUP BY "partyGroupId", "inventoryId"
      HAVING ARRAY_LENGTH(ARRAY_AGG(ROW_TO_JSON(p)), 1) > 1
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter, partyGroupIdFilter }]);
  return rows.map(pg => pg.partyGroups);
};

export const markRenewalV1Party = async (ctx, { renewalPartyId, mark }) => {
  logger.trace({ ctx, renewalPartyId, mark }, 'markRenewalV1Party');

  const query = `UPDATE db_namespace."Party" SET
      metadata = metadata || '{"V1RenewalState": "${mark}"}'
      WHERE id = :renewalPartyId
        AND "workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
      RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ renewalPartyId }]);
  return rows[0];
};

export const setSeedPartyOnRenewalV1 = async (ctx, { renewalV1partyId, seedPartyId, partyGroupId }) => {
  logger.trace({ ctx, renewalV1partyId, seedPartyId }, 'setSeedPartyOnRenewalV1');

  const query = `UPDATE db_namespace."Party" SET
      "seedPartyId" = :seedPartyId,
      metadata = metadata || '{"V1RenewalState": "${DALTypes.V1RenewalState.MIGRATED_TO_V2}"}'
      ${(partyGroupId && ', "partyGroupId" = :partyGroupId') || ''}
      WHERE id = :renewalV1partyId
      RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ renewalV1partyId, seedPartyId, partyGroupId }]);
  return rows[0];
};

export const getInFlightRenewalV1ByExternalIds = async (ctx, externalIds) => {
  logger.trace({ ctx, externalIds }, 'getInFlightRenewalV1ByExternalIds');

  const query = `
  SELECT * from db_namespace."Party" p
  INNER JOIN db_namespace."ExternalPartyMemberInfo" epi ON epi."partyId" = p.id
	  WHERE ARRAY["externalId"] <@ :externalIds
    AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'
    AND p."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'
    AND p."metadata" ->> 'V1RenewalState' = '${DALTypes.V1RenewalState.UNUSED}'
  `;

  const { rows } = await rawStatement(ctx, query, [{ externalIds }]);
  const orderedInFlightRenewals = rows && orderBy(rows, p => [partyStatesOrder.indexOf(p.state), new Date(p.created_at)], ['desc', 'asc']);
  return orderedInFlightRenewals[0];
};

export const getMovedOutActiveLeasesUsingExternalIds = async (ctx, { propertyIdsFilter } = {}) => {
  logger.trace({ ctx, propertyIdsFilter }, 'getMovedOutActiveLeases');
  const propertyFilter = propertyIdsFilter ? 'AND p."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';

  const query = `
    WITH
    import_external_ids AS (
      SELECT DISTINCT JSONB_ARRAY_ELEMENTS("rawData" -> 'members') ->> 'id' members FROM db_namespace."ResidentImportTracking" m
    ),
    active_leases AS (
      SELECT p.id, ARRAY_AGG(epi."externalId") external_ids FROM db_namespace."Party" p
        INNER JOIN db_namespace."ExternalPartyMemberInfo" epi ON epi."partyId" = p.id
        INNER JOIN db_namespace."Property" prop ON p."assignedPropertyId" = prop.ID AND prop."endDate" IS NULL
        INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = p.id
      WHERE p."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
        AND p."seedPartyId" IS NOT NULL
        AND (alwd."leaseData" ->> 'leaseEndDate')::timestamptz < now()
        ${propertyFilter}
      GROUP BY p.id
    )
    SELECT al.id "partyId" FROM active_leases	al
    WHERE (al.external_ids::text[] && (SELECT ARRAY_AGG(members) FROM import_external_ids)) IS FALSE
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIdsFilter }]);
  return rows;
};
