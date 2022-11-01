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
      DELETE FROM db_namespace."AppSettings" WHERE key = 'SendApplicationDeclinedEmail';
      DELETE FROM db_namespace."AppSettings" WHERE key = 'ApplicationDeniedEmailTemplate';
      `,
      tenantId,
    ),
  );
};

exports.down = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      INSERT INTO db_namespace."AppSettings" (id, category, description, "datatype", "key", value) 
      VALUES("public".gen_random_uuid(), 'Email', 'When an application is declined send an email to the resident', 'Bool', 'SendApplicationDeclinedEmail', 'true');

      INSERT INTO db_namespace."AppSettings" (id, category, description, "datatype", "key", value) 
      VALUES("public".gen_random_uuid(), 'EmailTemplate', 'The name of the template to use when sending emails on application denied', 'Text', 'ApplicationDeniedEmailTemplate', 'application-decision-denied');
      `,
      tenantId,
    ),
  );
};
