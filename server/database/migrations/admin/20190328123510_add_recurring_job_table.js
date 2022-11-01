/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../../common/schemaConstants';
import { now } from '../../../../common/helpers/moment-utils';

exports.up = async (knex, { tenantId }) => {
  const lastRunAt = now();
  await knex.raw(
    prepareRawQuery(
      `
      INSERT INTO db_namespace."RecurringJobs"
        (id, name, "lastRunAt", schedule, notes)
      VALUES
        ("public".gen_random_uuid(), 'CleanupTestingTenants', :lastRunAt , '0 30 6 * * 6', 'Run each Saturday at 6.30AM'),
        ("public".gen_random_uuid(), 'MonitorDatabase', :lastRunAt, '0 */5 * * * *', 'Run every 5 minutes'),
        ("public".gen_random_uuid(),'CleanupPhysicalAssets', :lastRunAt, '0 0 23 * * 0', 'Run each Sunday at 11:00PM');
        `,
      tenantId,
    ),
    { lastRunAt },
  );
};

exports.down = async () => {};
