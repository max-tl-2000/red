/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, update, updateJsonColumn } from '../../../server/database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subtype: 'externalPartyMemberRepo' });

export const updateAptexxDataForPartyMember = async (ctx, { personExternalId, aptexxData }) =>
  await update(
    ctx,
    'ExternalPartyMemberInfo',
    function whereConditions() {
      this.where({ externalId: personExternalId }).orWhere({ externalRoommateId: personExternalId });
    },
    { metadata: updateJsonColumn(ctx, 'metadata', { aptexxData }) },
  );

export const addEPMIForResident = async (ctx, { partyId, partyMemberId, leaseId, externalId, metadata, propertyId }) => {
  const query = `
      INSERT INTO  db_namespace."ExternalPartyMemberInfo"
      (id, "partyId", "partyMemberId", "leaseId", "externalId", "isPrimary", metadata, "propertyId")
      VALUES ("public".gen_random_uuid(), :partyId, :partyMemberId, :leaseId, :externalId, :isPrimary, :metadata, :propertyId)
  `;

  await rawStatement(ctx, query, [
    {
      partyId,
      partyMemberId,
      leaseId,
      externalId,
      isPrimary: true,
      metadata,
      propertyId,
    },
  ]);
};

export const getAptexxDataForPersonAndInventory = async (ctx, { personId, propertyId, inventoryId }) => {
  if (!personId || !inventoryId) return {};

  const propertyQueryCondition = propertyId ? 'AND i."propertyId" = :propertyId' : '';

  const query = `
      SELECT 
        p."workflowState",
        epmi.metadata -> 'aptexxData' "aptexxData",
        COALESCE(epmi."externalId", epmi."externalRoommateId") AS "personExternalId",
        p.created_at "partyCreatedAt",
        pm."endDate" "partyMemberEndDate",
        pr.timezone
      FROM db_namespace."PartyMember" pm
        INNER JOIN db_namespace."Party" p ON p.id = pm."partyId"
        INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = p.id
        INNER JOIN db_namespace."Inventory" i ON i.id = (alwd."leaseData" ->> 'inventoryId')::UUID
        INNER JOIN db_namespace."Property" pr ON pr.id = i."propertyId"
        INNER JOIN db_namespace."ExternalPartyMemberInfo" epmi ON epmi."partyMemberId" = pm.id AND epmi."partyId" = p.id
      WHERE pm."personId" = :personId
        AND p."endDate" IS NULL
        AND p."mergedWith" IS NULL
        AND epmi."endDate" IS NULL
        AND i.id = :inventoryId
        AND p."workflowState" = ANY(:workflowStates)
        ${propertyQueryCondition}
      ORDER BY p.created_at DESC
  `;

  const { rows = [] } = await rawStatement(ctx, query, [
    {
      personId,
      propertyId,
      inventoryId,
      workflowStates: [DALTypes.WorkflowState.ACTIVE, DALTypes.WorkflowState.ARCHIVED],
    },
  ]);

  if (!rows.length) return {};

  const filterByWorkflowState = state => rows.filter(r => r.workflowState === state);

  const isAMoreRecentMember = (memberOne, memberTwo) =>
    toMoment(memberOne.partyMemberEndDate, { timezone: memberOne.timezone }) > toMoment(memberTwo.partyMemberEndDate, { timezone: memberTwo.timezone });

  const findClosestEndedMember = results =>
    results.reduce((acc, r) => {
      if (acc && !acc.partyMemberEndDate) {
        return acc;
      }

      if (!r.partyMemberEndDate || !acc || isAMoreRecentMember(r, acc)) {
        acc = r;
      }

      return acc;
    }, null);

  return (
    findClosestEndedMember(filterByWorkflowState(DALTypes.WorkflowState.ACTIVE)) ||
    findClosestEndedMember(filterByWorkflowState(DALTypes.WorkflowState.ARCHIVED)) ||
    {}
  );
};

export const addExceptionReportDetailsInEPMI = async (ctx, { externalId, replacementData, date }) => {
  logger.trace({ ctx, externalId, replacementData }, 'addExceptionReportDetailsInEPMI');
  const { description, ruleId } = replacementData;
  const query = `
    UPDATE db_namespace."ExternalPartyMemberInfo"
    SET metadata = metadata || '{"${ruleId}": "${description}", "E${ruleId}_date": "${date}"}'
    WHERE "externalId" = :externalId
      AND "endDate" IS NULL
      AND metadata -> '${ruleId}' IS NULL
  `;

  await rawStatement(ctx, query, [{ externalId, replacementData, date }]);
};

export const getEPMIWithASpecificER = async (ctx, externalId, ruleId) => {
  logger.trace({ ctx, externalId, ruleId }, 'getEPMIWithASpecificER');

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT * FROM db_namespace."ExternalPartyMemberInfo"
      WHERE "externalId" = :externalId
      AND metadata -> '${ruleId}' is not null
      `,
    [{ externalId, ruleId }],
  );

  return rows[0];
};

export const getAptexxIntegrationIdForPersonAndInventory = async (ctx, { personId, propertyId, inventoryId }) =>
  (await getAptexxDataForPersonAndInventory(ctx, { personId, propertyId, inventoryId }))?.aptexxData?.integrationId;

export const getAptexxAccountPersonIdForPersonAndInventory = async (ctx, { personId, propertyId, inventoryId }) =>
  (await getAptexxDataForPersonAndInventory(ctx, { personId, propertyId, inventoryId }))?.aptexxData?.accountPersonId;
