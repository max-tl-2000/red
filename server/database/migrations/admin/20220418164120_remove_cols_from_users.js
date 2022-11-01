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
      ALTER TABLE db_namespace."Users" DROP COLUMN IF EXISTS "inactive";
      ALTER TABLE db_namespace."Users" DROP COLUMN IF EXISTS "directEmailIdentifier";
      ALTER TABLE db_namespace."Users" DROP COLUMN IF EXISTS "directPhoneIdentifier";
      ALTER TABLE db_namespace."Users" DROP COLUMN IF EXISTS "outsideDedicatedEmails";

      ALTER TABLE db_namespace."Tokens" ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE db_namespace."Tokens" ADD COLUMN IF NOT EXISTS "type" varchar(50) NULL;

      -- PK
      DO $$
      BEGIN
          IF NOT EXISTS ( SELECT 1 FROM information_schema.table_constraints
                      WHERE constraint_schema = 'db_namespace' AND constraint_name = 'RecurringJobs_pkey')
          THEN
          ALTER TABLE db_namespace."RecurringJobs" ADD CONSTRAINT "RecurringJobs_pkey" PRIMARY KEY (id);
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_knex_migrations_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."knex_migrations" RENAME CONSTRAINT "admin_knex_migrations_pkey" TO "knex_migrations_pkey";
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_ResetTokens_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."ResetTokens" RENAME CONSTRAINT "admin_ResetTokens_pkey" TO "ResetTokens_pkey";
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_tenant_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."Tenant" RENAME CONSTRAINT "admin_tenant_pkey" TO "Tenant_pkey";
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_Tokens_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."Tokens" RENAME CONSTRAINT "admin_Tokens_pkey" TO "Tokens_pkey";
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_Users_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."Users" RENAME CONSTRAINT "admin_Users_pkey" TO "Users_pkey";
          END IF;

          IF EXISTS ( SELECT  1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'db_namespace' AND constraint_name = 'admin_UsersInvites_pkey')
          THEN
            ALTER TABLE ONLY db_namespace."UsersInvites" RENAME CONSTRAINT "admin_UsersInvites_pkey" TO "UsersInvites_pkey";
          END IF;
      END$$;

      -- FK
      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS resettokens_user_id_foreign;
      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS admin_resettokens_user_id_foreign;
      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS "ResetTokens_user_id_fkey";
      ALTER TABLE ONLY db_namespace."ResetTokens" ADD CONSTRAINT "ResetTokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES db_namespace."Users"(id);

      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS resettokens_token_id_foreign;
      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS admin_resettokens_token_id_foreign;
      ALTER TABLE db_namespace."ResetTokens" DROP CONSTRAINT IF EXISTS "ResetTokens_token_id_fkey";
      ALTER TABLE ONLY db_namespace."ResetTokens" ADD CONSTRAINT "ResetTokens_token_id_fkey" FOREIGN KEY (token_id) REFERENCES db_namespace."Tokens"(id);

      -- CK
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS admin_users_email_lowercase_ck;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_email_lowercase_check";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_email_lowercase_check" CHECK (((email)::text = lower((email)::text)));

      -- UK
      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS tenant_authorization_token_unique;
      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS admin_tenant_authorization_token_unique;
      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS "Tenant_authorization_token_key";
      ALTER TABLE db_namespace."Tenant" ADD CONSTRAINT "Tenant_authorization_token_key" UNIQUE ("authorization_token");

      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS tenant_name_unique;
      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS admin_tenant_name_unique;
      ALTER TABLE db_namespace."Tenant" DROP CONSTRAINT IF EXISTS "Tenant_name_key";
      ALTER TABLE db_namespace."Tenant" ADD CONSTRAINT "Tenant_name_key" UNIQUE ("name");

      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS users_email_unique;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS admin_users_email_unique;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_email_key";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_email_key" UNIQUE ("email");

      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS users_externaluniqueid_unique;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS admin_users_externaluniqueid_unique;
      ALTER TABLE db_namespace."Users" DROP CONSTRAINT IF EXISTS "Users_externalUniqueId_key";
      ALTER TABLE db_namespace."Users" ADD CONSTRAINT "Users_externalUniqueId_key" UNIQUE ("externalUniqueId");

      -- FN
      DROP FUNCTION IF EXISTS db_namespace.add_table_to_publication(text, text);
      `,
      tenantId,
    ),
  );
};

exports.down = async () => {};
