/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../../common/schemaConstants';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS Users_email_lowercase_ck;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_email_lowercase_check";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_email_lowercase_check" CHECK (((email)::text = lower((email)::text)));
      `,
      tenantId,
    ),
  );
};

exports.down = async () => {};
