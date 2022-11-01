/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../common/schemaConstants';
import { DALTypes } from '../../../common/enums/DALTypes';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      CREATE TABLE IF NOT EXISTS db_namespace."UserStatus" (
        id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "status" varchar(100) NOT NULL,
        "statusUpdatedAt" timestamptz NULL DEFAULT now(),
        "notAvailableSetAt" timestamptz NULL,
        "wrapUpCallTimeoutId" uuid NULL,
        "loginTimeoutId" uuid NULL,
        "lockedForCallQueueRouting" bool NULL DEFAULT FALSE,
        CONSTRAINT "UserStatus_pkey" PRIMARY KEY (id),
        CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id),
        CONSTRAINT "UserStatus_userId_key" UNIQUE("userId")
      );

    ALTER TABLE db_namespace."UserStatusHistory" ADD COLUMN IF NOT EXISTS "loginAt" timestamptz NULL;
    ALTER TABLE db_namespace."UserStatusHistory" ADD COLUMN IF NOT EXISTS "logoutAt" timestamptz NULL;

    DROP TRIGGER IF EXISTS users_update_status_trg on db_namespace."Users";

    UPDATE db_namespace."Users"
      SET metadata = metadata - 'status' - 'statusUpdatedAt' - 'notAvailableSetAt' - 'wrapUpCallTimeoutId' - 'loginTimeoutId';

    ALTER TABLE db_namespace."Users" DROP COLUMN IF EXISTS "lockedForCallQueueRouting";

    CREATE OR REPLACE FUNCTION db_namespace.insert_user_status_history()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
        BEGIN
            IF NEW.status <> OLD.status THEN
                INSERT INTO db_namespace."UserStatusHistory"(id, "userId", status, pid)
            VALUES("public".gen_random_uuid(), NEW."userId", NEW.status, pg_backend_pid());
        ELSE
            RETURN NULL;
        END IF;
            RETURN NULL;
        END;
    $function$;

    CREATE TRIGGER userstatus_update_status_trg
      AFTER UPDATE OF status
      ON db_namespace."UserStatus"
    FOR EACH ROW EXECUTE PROCEDURE db_namespace.insert_user_status_history();

    INSERT INTO db_namespace."UserStatus" (id, "userId", "status")
      SELECT "public".gen_random_uuid(), u."id", COALESCE(u."metadata" ->> 'status', '${DALTypes.UserStatus.NOT_AVAILABLE}')
    FROM db_namespace."Users" u
    `,
      tenantId,
    ),
  );
};

exports.down = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      DROP TRIGGER IF EXISTS userstatus_update_status_trg on db_namespace."UserStatus";
      DROP TABLE db_namespace."UserStatus";
      DROP FUNCTION IF EXISTS db_namespace.insert_user_status_history();
      `,
      tenantId,
    ),
  );
};
