/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { prepareRawQuery } from '../../common/schemaConstants';
import { now } from '../../../common/helpers/moment-utils';

exports.up = async (knex, { tenantId }) => {
  let taskFollowUpPartySchedule = '0 */30 * * * *';
  let taskFollowUpPartyNotes = 'Run every 30 minutes';
  if (config.isIntegration) {
    taskFollowUpPartySchedule = '* * * * * *';
    taskFollowUpPartyNotes = 'Run every second';
  } else if (config.isDevelopment) {
    taskFollowUpPartySchedule = '0 */10 * * * *';
    taskFollowUpPartyNotes = 'Run every 10 minutes';
  }

  let callQueueEndOfDaySchedule = '0 */3 * * * *';
  let callQueueEndOfDayNotes = 'Run every 3 minutes';
  if (config.isIntegration) {
    callQueueEndOfDaySchedule = '* * * * * *';
    callQueueEndOfDayNotes = 'Run every second';
  }

  const lastRunAt = now();

  await knex.raw(
    prepareRawQuery(
      `
      INSERT INTO db_namespace."RecurringJobs" AS rec
        (id, name, "lastRunAt", schedule, notes)
      VALUES
        ("public".gen_random_uuid(),'CallQueueEndOfDay', :lastRunAt, '${callQueueEndOfDaySchedule}', '${callQueueEndOfDayNotes}'),
        ("public".gen_random_uuid(),'TasksFollowupParty', :lastRunAt, '${taskFollowUpPartySchedule}', '${taskFollowUpPartyNotes}')

      ON CONFLICT(name) DO UPDATE SET "lastRunAt" = :lastRunAt WHERE rec."lastRunAt" IS NULL
        `,
      tenantId,
    ),
    { lastRunAt },
  );
};

exports.down = () => {};
