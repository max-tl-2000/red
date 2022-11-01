/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { prepareRawQuery, admin } from '../../common/schemaConstants';
import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { knex } from '../../database/factory';
import { handleUserDeactivationInTeam } from '../../services/teamMembers';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'archiveWorkflowsWithoutExtId' });

const getInactiveTeamMembersThatArePartyOwnersOnActiveParties = async ctx => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT
        t."displayName", u."fullName", count(*) as "partiesToBeReassigned",
        t.id as "teamId", u.id as "userId", tm.inactive
      FROM db_namespace."TeamMembers" AS tm
          INNER JOIN db_namespace."Teams" AS t ON tm."teamId" = t.id
          INNER JOIN db_namespace."Users" AS u ON tm."userId" = u.id
          INNER JOIN db_namespace."Party" AS p ON u.id = p."userId"
          INNER JOIN db_namespace."Property" AS prop ON prop.id = p."assignedPropertyId"
      WHERE (tm.inactive = true OR t."endDate" IS NOT NULL)
          AND p."ownerTeam" = t.id
          AND prop."endDate" IS NULL
          AND (p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
            OR (p."endDate" IS NOT NULL AND p."endDate" > now() - interval '30 days')
            OR (p."archiveDate" IS NOT NULL AND p."archiveDate" > now() - interval '30 days')
          )
      GROUP BY t.id,  t."displayName", u.id, u."fullName", tm.inactive;
      `,
      ctx.tenantId,
    ),
  );
  return rows;
};

const reassignParties = async ctx => {
  logger.trace({ ctx }, 'reassignParties - start');

  const teamMembersThatAreInactiveOwners = await getInactiveTeamMembersThatArePartyOwnersOnActiveParties(ctx);

  await mapSeries(teamMembersThatAreInactiveOwners, async teamMemberData => {
    logger.trace({ ctx, teamMemberData }, 'processing user with information');
    await handleUserDeactivationInTeam(ctx, teamMemberData.userId, teamMemberData.teamId);
  });

  logger.trace({ ctx }, 'reassignParties - done');
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
  await reassignParties(tenantCtx);
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while reassigning parties to dispatcher for inactive users', e);
  process.exit(1); // eslint-disable-line
  });
