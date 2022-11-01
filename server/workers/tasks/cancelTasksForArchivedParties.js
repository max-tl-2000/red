/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { admin, prepareRawQuery } from '../../common/schemaConstants';
import { knex } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'cancelTasksForArchivedParties' });

const cancelTasksForArchivedParties = async ctx => {
  logger.trace({ ctx }, 'cancel active tasks for archived parties - start');

  await knex.raw(
    prepareRawQuery(
      `
        UPDATE db_namespace."Tasks" t
          SET state = '${DALTypes.TaskStates.CANCELED}'
          FROM db_namespace."Party" p
        WHERE p.id = t."partyId"
          AND t.state = '${DALTypes.TaskStates.ACTIVE}'
          AND p."workflowState" = '${DALTypes.WorkflowState.ARCHIVED}'
      `,
      ctx.tenantId,
    ),
  );

  logger.trace({ ctx }, 'cancel active tasks for archived parties - done');
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
  await cancelTasksForArchivedParties(tenantCtx);
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while canceling tasks for archived parties', e);
  process.exit(1); // eslint-disable-line
  });
