/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../common/schemaConstants';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      ALTER TABLE db_namespace."Programs" RENAME COLUMN "selectedProperties" TO "selectedPropertyIds";
      `,
      tenantId,
    ),
  );
};

exports.down = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      ALTER TABLE db_namespace."Programs" RENAME COLUMN "selectedPropertyIds" TO "selectedProperties";
      `,
      tenantId,
    ),
  );
};
