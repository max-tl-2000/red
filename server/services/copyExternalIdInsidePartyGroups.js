/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// This can be removed after 19.11.11 release together with the script that uses it.

import { prepareRawQuery, admin } from '../common/schemaConstants';
import { getTenantByName } from '../dal/tenantsRepo';
import loggerModule from '../../common/helpers/logger';
import { knex } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'copyExternalIdInsidePartyGroup' });

const copyExternalIds = async ctx => {
  logger.trace({ ctx }, 'copyExternalIds - start');

  const { rows: copiedExternalIdsOnTraditionalParty } = await knex.raw(
    prepareRawQuery(
      `
      WITH
      party_groups AS (
        SELECT DISTINCT pg.id FROM db_namespace."PartyGroup" pg
        WHERE EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" e
                        INNER JOIN db_namespace."Party" p ON p.id = e."partyId"
                      WHERE p."partyGroupId" = pg.id
                        AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'
                        AND p."leaseType" = '${DALTypes.PartyTypes.TRADITIONAL}')
        AND EXISTS (SELECT 1 FROM db_namespace."Party" p2
                    WHERE p2."partyGroupId" = pg.id
                      AND NOT EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" e WHERE p2.id = e."partyId"))
      ), party_members_with_ext_id AS (
        SELECT
          p."partyGroupId",
          pm."partyId",
          pm."personId",
          epi."externalId",
          epi."isPrimary",
          epi."startDate",
          epi."externalProspectId",
          epi."externalRoommateId",
          epi."propertyId"
        FROM db_namespace."PartyMember" pm
          INNER JOIN db_namespace."ExternalPartyMemberInfo" epi ON epi."partyMemberId" = pm.id AND epi."endDate" IS NULL
          INNER JOIN db_namespace."Party" p ON p.id = pm."partyId" AND p."assignedPropertyId" = epi."propertyId" AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'
        WHERE pm."endDate" IS NULL
          AND p."workflowName" IN ('${DALTypes.WorkflowName.NEW_LEASE}', '${DALTypes.WorkflowName.RENEWAL}')
          AND p."partyGroupId" IN (SELECT * FROM party_groups)
      ), party_members_without_ext_id AS (
        SELECT pm.id "partyMemberId", pm."personId", pm."partyId", p."partyGroupId", p."workflowName" FROM db_namespace."PartyMember" pm
          INNER JOIN db_namespace."Party" p ON p.id = pm."partyId" AND p."endDate" IS NULL
        WHERE pm."endDate" IS NULL
          AND p."partyGroupId" IN (SELECT * FROM party_groups)
          AND NOT EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" epi WHERE epi."partyId" = p.id)
      ), prepare_update AS (
        SELECT DISTINCT
          pm_no_id."workflowName",
          pm_no_id."partyGroupId",
          pm_no_id."partyMemberId",
          pm_no_id."partyId",
          pmid."externalId",
          pmid."isPrimary",
          pmid."propertyId",
          pmid."startDate",
          pmid."externalProspectId",
          pmid."externalRoommateId"
        FROM PARTY_MEMBERS_WITHOUT_EXT_ID pm_no_id
          INNER JOIN party_members_with_ext_id pmid ON pmid."personId" = pm_no_id."personId" AND pmid."partyGroupId" = pm_no_id."partyGroupId"
      )
      INSERT INTO db_namespace."ExternalPartyMemberInfo"
      SELECT
        "public".gen_random_uuid() id,
        now() CREATED_AT,
        now() UPDATED_AT,
        "partyId",
        "partyMemberId",
        NULL "childId",
        NULL "leaseId",
        "startDate",
        NULL "endDate",
        "externalId",
        "externalProspectId",
        "externalRoommateId",
        "isPrimary",
         '{}'::jsonb metadata,
        "propertyId"
      FROM prepare_update ORDER BY "partyId"
      RETURNING id;
      `,
      ctx.tenantId,
    ),
  );
  const copiedIdsOnTraditionalParty = copiedExternalIdsOnTraditionalParty.map(({ id }) => id);

  logger.trace(
    { ctx, copiedIdsOnTraditionalParty, numberOfCopiedIds: copiedExternalIdsOnTraditionalParty.length },
    'external ids copied on traditional parties',
  );

  const { rows: copiedExternalIdsOnCorporateParty } = await knex.raw(
    prepareRawQuery(
      `
      WITH
      party_groups AS (
        SELECT DISTINCT pg.id FROM db_namespace."PartyGroup" pg
        WHERE EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" e
                        INNER JOIN db_namespace."Party" p ON p.id = e."partyId"
                      WHERE p."partyGroupId" = pg.id
                        AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'
                        AND p."leaseType" = '${DALTypes.PartyTypes.CORPORATE}')
        AND EXISTS (SELECT 1 FROM db_namespace."Party" p2
                    WHERE p2."partyGroupId" = pg.ID
                      AND NOT EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" e WHERE p2.id = e."partyId"))
      ), party_members_with_ext_id AS (
        SELECT
          p."partyGroupId",
          pm."partyId",
          pm."personId",
          epi."externalId",
          epi."isPrimary",
          epi."startDate",
          epi."externalProspectId",
          epi."externalRoommateId",
          epi."propertyId",
          l."baselineData" -> 'quote' ->> 'inventoryId' "inventoryId"
        FROM db_namespace."PartyMember" pm
          INNER JOIN db_namespace."ExternalPartyMemberInfo" epi ON epi."partyMemberId" = pm.id AND epi."endDate" IS NULL
          INNER JOIN db_namespace."Party" p ON p.id = pm."partyId" AND p."assignedPropertyId" = epi."propertyId" AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'
          INNER JOIN db_namespace."Lease" l ON l."partyId" = p.id AND l.id = epi."leaseId" and l.STATUS IN ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
        WHERE pm."endDate" IS NULL
          AND p."workflowName" = '${DALTypes.WorkflowName.NEW_LEASE}'
          AND p."partyGroupId" IN (SELECT * FROM party_groups)
      ), party_members_without_ext_id AS (
        SELECT
          pm.id "partyMemberId",
          pm."personId",
          pm."partyId",
          p."partyGroupId",
          COALESCE(lease."inventoryId", quote."inventoryId"::text) "inventoryId"
        FROM db_namespace."PartyMember" pm
          INNER JOIN db_namespace."Party" p ON p.id = pm."partyId" AND p."endDate" IS NULL
          LEFT JOIN LATERAL
            (SELECT l."baselineData" -> 'quote' ->> 'inventoryId' AS "inventoryId" FROM db_namespace."Lease" l
                  WHERE l."partyId" = p.id
                      AND l.status IN ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
                  ) lease ON TRUE
            LEFT JOIN LATERAL
                (SELECT q."inventoryId" FROM db_namespace."Quote" AS q
                  WHERE  q."partyId" = p.id
                    AND lease."inventoryId" IS NULL
                  ORDER BY q.created_at DESC LIMIT 1
                  ) quote ON TRUE
        WHERE pm."endDate" IS NULL
          AND p."partyGroupId" IN (SELECT * FROM party_groups)
          AND NOT EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" epi WHERE epi."partyId" = pm."partyId")
      ), prepare_update AS (
        SELECT DISTINCT
          pm_no_id."partyGroupId",
          pm_no_id."partyMemberId",
          pm_no_id."partyId",
          pmid."externalId",
          pmid."isPrimary",
          pmid."propertyId",
          pmid."startDate",
          pmid."externalProspectId",
          pmid."externalRoommateId"
        FROM PARTY_MEMBERS_WITHOUT_EXT_ID pm_no_id
          INNER JOIN party_members_with_ext_id pmid ON pmid."personId" = pm_no_id."personId"
            AND pmid."partyGroupId" = pm_no_id."partyGroupId" AND pm_no_id."inventoryId" = pmid."inventoryId"
      )
      INSERT INTO db_namespace."ExternalPartyMemberInfo"
      SELECT
        "public".gen_random_uuid() id,
        now() CREATED_AT,
        now() UPDATED_AT,
        "partyId",
        "partyMemberId",
        NULL "childId",
        NULL "leaseId",
        "startDate",
        NULL "endDate",
        "externalId",
        "externalProspectId",
        "externalRoommateId",
        "isPrimary",
        '{}'::jsonb metadata,
        "propertyId"
      FROM prepare_update ORDER BY "partyId"
      RETURNING id;
      `,
      ctx.tenantId,
    ),
  );

  const copiedIdsOnCorporateParty = copiedExternalIdsOnCorporateParty.map(({ id }) => id);
  logger.trace({ ctx, copiedIdsOnCorporateParty, numberOfCopiedIds: copiedExternalIdsOnCorporateParty.length }, 'external ids copied on corporate parties');

  logger.trace({ ctx }, 'copyExternalIds - done');
};

const getTenantContext = async () => {
  const tenantName = process.argv[2];
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    logger.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantCtx = await getTenantContext();
  await copyExternalIds(tenantCtx);
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while copying external ids', e);
    process.exit(1); // eslint-disable-line
  });
