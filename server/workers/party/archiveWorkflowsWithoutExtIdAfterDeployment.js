/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// This can be removed after 19.11.11 release together with the script that uses it.
import { mapSeries } from 'bluebird';

import { prepareRawQuery, admin } from '../../common/schemaConstants';
import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { knex } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { archiveParty } from '../../services/party';

const logger = loggerModule.child({ subType: 'archiveWorkflowsWithoutExtId' });

const getPartiesWithoutExtIdToArchive = async (ctx, workflowName) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
    SELECT party.id FROM db_namespace."Party" AS party
      INNER JOIN db_namespace."Property" pro ON party."assignedPropertyId" = pro.id
    WHERE party."workflowName" = '${workflowName}'
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (party.state = '${DALTypes.PartyStateType.FUTURERESIDENT}' OR party.state = '${DALTypes.PartyStateType.RESIDENT}')
      AND (pro.settings->'integration'->'import'->>'residentData')::boolean IS TRUE
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Tasks" task
                      WHERE task.name <> '${DALTypes.TaskNames.MIGRATE_MOVE_IN_DOCUMENTS}'
                        AND task.state = '${DALTypes.TaskStates.ACTIVE}'
                        AND task."partyId" = party.id)
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Lease" AS lease
                      WHERE lease."partyId" = party.id
                        AND lease.status = '${DALTypes.LeaseStatus.EXECUTED}'
                        AND (lease."baselineData"->'publishedLease'->>'leaseStartDate')::timestamptz > now())
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Party" active_lease
                  WHERE active_lease."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
                    AND active_lease."seedPartyId" = party.id )
      AND NOT EXISTS (SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" epi WHERE epi."partyId" = party.id AND epi."externalId" IS NOT NULL);
      `,
      ctx.tenantId,
    ),
  );
  return rows.map(({ id }) => id);
};

const archiveWorkflowsWithoutExtId = async ctx => {
  logger.trace({ ctx }, 'archiveWorkflowsWithoutExtId - start');

  await knex.raw(
    prepareRawQuery(
      `
      ALTER TABLE db_namespace."Party" DISABLE TRIGGER partytrgonupdate;
      ALTER TABLE db_namespace."PartyMember" DISABLE TRIGGER partymembertrgondeleteforpartysearch;
      ALTER TABLE db_namespace."PartyMember" DISABLE TRIGGER partymembertrgoninsertupdate;
      ALTER TABLE db_namespace."PartyMember" DISABLE TRIGGER partymembertrgoninsertupdateforperssearch;
      `,
      ctx.tenantId,
    ),
  );

  const newLeasePartyIdsWithoutExtIdToArchive = await getPartiesWithoutExtIdToArchive(ctx, DALTypes.WorkflowName.NEW_LEASE);
  const numberOfNewLeasesWithoutExtIdToArchive = newLeasePartyIdsWithoutExtIdToArchive.length;
  logger.trace({ ctx, numberOfNewLeasesWithoutExtIdToArchive }, 'number of new leases without external ids to archive');

  await mapSeries(newLeasePartyIdsWithoutExtIdToArchive, async (partyId, index) => {
    await archiveParty(ctx, {
      partyId,
      workflowName: DALTypes.WorkflowName.NEW_LEASE,
      archiveReasonId: DALTypes.ArchivePartyReasons.WITHOUT_EXT_ID_AFTER_MRI_SYNC,
      options: { skipNotify: true, shouldCancelActiveTasks: false },
    });
    logger.trace({ ctx, numberOfNewLeasesWithoutExtIdToArchive, numberOfArchivedNewLeases: 1 + index }, 'number of archived new leases without external id');
  });

  const renewalPartyIdsWithoutExtIdToArchive = await getPartiesWithoutExtIdToArchive(ctx, DALTypes.WorkflowName.RENEWAL);
  const numberOfRenewalsWithoutExtIdToArchive = renewalPartyIdsWithoutExtIdToArchive.length;
  logger.trace({ ctx, numberOfRenewalsWithoutExtIdToArchive }, 'number of renewal without external ids to archive');

  await mapSeries(renewalPartyIdsWithoutExtIdToArchive, async (partyId, index) => {
    await archiveParty(ctx, {
      partyId,
      workflowName: DALTypes.WorkflowName.RENEWAL,
      archiveReasonId: DALTypes.ArchivePartyReasons.WITHOUT_EXT_ID_AFTER_MRI_SYNC,
      options: { skipNotify: true, shouldCancelActiveTasks: false },
    });
    logger.trace({ ctx, numberOfRenewalsWithoutExtIdToArchive, numberOfArchivedRenewals: 1 + index }, 'number of archived renewals without external id');
  });

  await knex.raw(
    prepareRawQuery(
      `
      ALTER TABLE db_namespace."Party" ENABLE TRIGGER partytrgonupdate;
      ALTER TABLE db_namespace."PartyMember" ENABLE TRIGGER partymembertrgondeleteforpartysearch;
      ALTER TABLE db_namespace."PartyMember" ENABLE TRIGGER partymembertrgoninsertupdate;
      ALTER TABLE db_namespace."PartyMember" ENABLE TRIGGER partymembertrgoninsertupdateforperssearch;
      -- tables will be re-generated post-deployment
      `,
      ctx.tenantId,
    ),
  );

  logger.trace({ ctx }, 'archiveWorkflowsWithoutExtId - done');
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
  await archiveWorkflowsWithoutExtId(tenantCtx);
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while archiving workflows', e);
  process.exit(1); // eslint-disable-line
  });
