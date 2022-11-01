/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// Can be removed after 20.06.08 release together with the script that uses it.
import { mapSeries } from 'bluebird';

import { getTenantByName } from '../../dal/tenantsRepo';
import { prepareRawQuery, admin } from '../../common/schemaConstants';
import loggerModule from '../../../common/helpers/logger';
import { knex } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { archiveParty } from '../../services/party';

const logger = loggerModule.child({ subType: 'archiveWorkflowsWithoutExtId' });

const getPartiesWithoutExtId = async ctx => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
    SELECT party.id FROM db_namespace."Party" AS party
      INNER JOIN db_namespace."Property" prop ON party."assignedPropertyId" = prop.id
      INNER JOIN db_namespace."ExternalPartyMemberInfo" epmi ON epmi."partyId" = party.id
    WHERE party."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (prop.settings->'integration'->'import'->>'residentData')::boolean IS TRUE
      AND epmi."isPrimary" IS TRUE
      AND epmi."endDate" IS NULL
      AND NOT EXISTS (SELECT 1 FROM db_namespace."ResidentImportTracking" rit
        WHERE rit."primaryExternalId" = epmi."externalId");
      `,
      ctx.tenantId,
    ),
  );

  return rows.map(({ id }) => id);
};

const archiveActiveLeasesWithoutCorrespondingExtId = async ctx => {
  logger.trace({ ctx }, 'archiveActiveLeasesWithoutCorrespondingExtId - start');
  const partyIdsWithoutExtId = await getPartiesWithoutExtId(ctx);

  logger.trace({ ctx, numberOfActiveLeasesToArchive: partyIdsWithoutExtId.length }, 'numebr of active leases to archive');
  await mapSeries(partyIdsWithoutExtId, async (partyId, index) => {
    await archiveParty(ctx, {
      partyId,
      workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      archiveReasonId: DALTypes.ArchivePartyReasons.WITHOUT_EXT_ID_AFTER_INITIAL_YARDI_SYNC,
      options: { skipNotify: true, shouldCancelActiveTasks: false },
    });
    logger.trace({ ctx, partyId, numberOfArchivedActiveLeases: index + 1 }, 'number of archived active leases leases without external id');
  });

  logger.trace({ ctx }, 'archiveActiveLeasesWithoutCorrespondingExtId - done');
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
  await archiveActiveLeasesWithoutCorrespondingExtId(tenantCtx);
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while archiving workflows', e);
    process.exit(1); // eslint-disable-line
  });
