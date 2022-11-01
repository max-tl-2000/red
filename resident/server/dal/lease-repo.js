/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../../../server/database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subtype: 'leaseRepo' });

export const getLeaseInfoForPerson = async (ctx, personId, propertyId) => {
  if (!personId) return [];

  const propertyQueryCondition = propertyId ? 'AND pr.id = :propertyId' : '';

  const partyQuery = `
    SELECT DISTINCT ON (party."partyGroupId") id, party."workflowState", party.state, party."endDate"
    FROM db_namespace."Party" party
    WHERE party."workflowState" = :activeWorkflowState
       OR (party."workflowState" = :archivedWorkflowState AND party.state = ANY(:pastResidentStates))
    ORDER BY party."partyGroupId", (CASE
      WHEN party."workflowState" = :activeWorkflowState THEN 1
      WHEN party."workflowState" = :archivedWorkflowState THEN 2
      ELSE 3
    END),
    (CASE
      WHEN party."workflowName" = :activeLeaseWorkflowName THEN 1
      WHEN party."workflowName" = :newLeaseWorkflowName THEN 2
      ELSE 3
    END)
    `;

  const query = `
      SELECT
        us.id "inventoryId",
        us."fullQualifiedName" "unitFullyQualifiedName",
        us."inventoryName" "unitDisplayName",
        us."buildingName" "buildingDisplayName",
        pm.id "partyMemberId",
        p.id "partyId",
        p.state "partyState",
        p."workflowState" "partyWorkflowState",
        (case when l.id is null then alwd.id else l.id end) "leaseOrAlwdId",
        epmi.metadata -> 'aptexxData' "aptexxData",
        COALESCE(epmi."externalId", epmi."externalRoommateId") AS "personExternalId",
        pr.id "propertyId"
      FROM db_namespace."PartyMember" pm
        INNER JOIN (${partyQuery}) p ON pm."partyId" = p.id
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = p.id
        LEFT JOIN db_namespace."Lease" l ON (
          CASE WHEN alwd.id IS NULL
            THEN  (l."partyId" = p.id AND p.state = ANY(:futureResidentStates))
            ELSE l.id = alwd."leaseId"
          END)
        INNER JOIN db_namespace."UnitSearch" us ON (us.id = (alwd."leaseData" ->> 'inventoryId')::UUID OR us.id = (l."baselineData"-> 'quote' ->> 'inventoryId')::UUID)
        INNER JOIN db_namespace."Property" pr ON (us.inventory_object ->> 'propertyId')::UUID = pr.id
        LEFT JOIN db_namespace."ExternalPartyMemberInfo" epmi ON epmi."partyMemberId" = pm.id AND epmi."partyId" = p.id
      WHERE pm."personId" = :personId
        AND (l.status IS NULL OR l.status <> :voidedLeaseStatus)
        AND (alwd.id IS NOT NULL OR (p.state = ANY(:allResidentStates) AND pm."endDate" IS NULL AND p."endDate" IS NULL))
        ${propertyQueryCondition}
  `;
  const { rows = [] } = await rawStatement(ctx, query, [
    {
      personId,
      voidedLeaseStatus: DALTypes.LeaseStatus.VOIDED,
      allResidentStates: [
        DALTypes.PartyStateType.FUTURERESIDENT,
        DALTypes.PartyStateType.LEASE,
        DALTypes.PartyStateType.RESIDENT,
        DALTypes.PartyStateType.PASTRESIDENT,
      ],
      pastResidentStates: [DALTypes.PartyStateType.RESIDENT, DALTypes.PartyStateType.PASTRESIDENT],
      futureResidentStates: [DALTypes.PartyStateType.FUTURERESIDENT, DALTypes.PartyStateType.LEASE],
      propertyId,
      activeWorkflowState: DALTypes.WorkflowState.ACTIVE,
      archivedWorkflowState: DALTypes.WorkflowState.ARCHIVED,
      activeLeaseWorkflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      newLeaseWorkflowName: DALTypes.WorkflowName.NEW_LEASE,
    },
  ]);
  return rows;
};

export const getInventoryIdByIntegrationId = async (ctx, integrationId) => {
  logger.trace({ ctx, integrationId }, 'getInventoryIdByIntegrationId');

  const coalesceSubquery = `
    COALESCE(al."leaseData" ->> 'inventoryId', lease."baselineData" -> 'quote' ->> 'inventoryId')
  `;

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT ${coalesceSubquery} As "inventoryId"
    FROM db_namespace."ExternalPartyMemberInfo" epmi
      LEFT JOIN db_namespace."ActiveLeaseWorkflowData" al ON al."partyId" = epmi."partyId"
      LEFT JOIN db_namespace."Lease" lease ON lease."id" = epmi."leaseId"
    WHERE epmi."metadata" -> 'aptexxData' ->> 'integrationId' = :integrationId
      AND ${coalesceSubquery} IS NOT NULL
      AND epmi."endDate" IS NULL
    ORDER BY epmi."created_at" DESC
    LIMIT 1
    `,
    [{ integrationId }],
  );

  return rows[0];
};
