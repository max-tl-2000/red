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
      DROP TABLE IF EXISTS db_namespace."AppState";

      -- PK
      DO $$
      BEGIN
          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'User_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."Users" RENAME CONSTRAINT "User_pkey" TO "Users_pkey"; -- prod
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'common_knex_migrations_pkey')
          THEN
            ALTER TABLE ONLY db_namespace.knex_migrations RENAME CONSTRAINT "common_knex_migrations_pkey" TO "knex_migrations_pkey"; -- staging
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'common_ResetToken_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."ResetToken" RENAME CONSTRAINT "common_ResetToken_pkey" TO "ResetToken_pkey"; -- staging
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'common_UserInvite_pkey')
          THEN
          ALTER TABLE ONLY db_namespace."UserInvite" RENAME CONSTRAINT "common_UserInvite_pkey" TO "UserInvite_pkey"; -- staging
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'common_User_pkey')
          THEN
          ALTER TABLE ONLY db_namespace."Users" RENAME CONSTRAINT "common_User_pkey" TO "Users_pkey"; -- staging
          END IF;
      END$$;

      -- CK
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS common_users_email_lowercase_ck;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_email_lowercase_ck";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_email_lowercase_ck" CHECK (((email)::text = lower((email)::text)));

      -- UK
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS common_users_email_unique;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_email_key";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_email_key" UNIQUE ("email");

      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS userperson_userid_personid_tenantid_unique;
      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS common_userperson_userid_personid_tenantid_unique; -- staging
      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS "UserPerson_userId_personId_tenantId_key";
      ALTER TABLE db_namespace."UserPerson" ADD CONSTRAINT "UserPerson_userId_personId_tenantId_key" UNIQUE ("userId", "personId", "tenantId");

      --FK
      ALTER TABLE db_namespace."ResetToken" DROP CONSTRAINT IF EXISTS common_resettoken_userid_foreign;
      ALTER TABLE db_namespace."ResetToken" DROP CONSTRAINT IF EXISTS "ResetToken_userId_fkey";
      ALTER TABLE ONLY db_namespace."ResetToken" ADD CONSTRAINT "ResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS userperson_userid_foreign;
      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS common_userperson_userid_foreign; -- staging
      ALTER TABLE db_namespace."UserPerson" DROP CONSTRAINT IF EXISTS "UserPerson_userId_fkey";
      ALTER TABLE ONLY db_namespace."UserPerson" ADD CONSTRAINT "UserPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);
      `,
      tenantId,
    ),
  );
};

exports.down = async () => {};
