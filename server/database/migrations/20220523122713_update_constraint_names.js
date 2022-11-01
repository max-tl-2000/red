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
      ALTER TABLE db_namespace."Communication" DROP CONSTRAINT IF EXISTS "Communication_readBy_fkey";
      ALTER TABLE db_namespace."Communication"
        ADD CONSTRAINT "Communication_readBy_fkey" FOREIGN KEY ("readBy") REFERENCES db_namespace."Users"(id);

      ALTER TABLE db_namespace."Post" DROP CONSTRAINT IF EXISTS "fk_post_publicdocument";
      ALTER TABLE db_namespace."Post" DROP CONSTRAINT IF EXISTS "Post_publicDocumentId_fkey";
      ALTER TABLE ONLY db_namespace."Post"
        ADD CONSTRAINT "Post_publicDocumentId_fkey" FOREIGN KEY ("publicDocumentId") REFERENCES db_namespace."PublicDocument"(uuid);

      DO $$
      BEGIN
      IF EXISTS ( SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'db_namespace' AND constraint_name = 'Inventory_Amenity_inventoryId_amenityId_key_endDate_key')
      THEN
        ALTER TABLE ONLY db_namespace."Inventory_Amenity" RENAME CONSTRAINT "Inventory_Amenity_inventoryId_amenityId_key_endDate_key" TO "Inventory_Amenity_inventoryId_amenityId_endDate_key";
      END IF;
      END$$;

      ALTER INDEX IF EXISTS db_namespace."Inventory_Amenity_inventoryId_amenityId_key_endDate_idx" RENAME TO "Inventory_Amenity_inventoryId_amenityId_idx";

      ALTER INDEX IF EXISTS db_namespace."rentapp_PersonApplication_personId_partyId_key" RENAME TO "rentapp_PersonApplication_personId_partyId_idx";

      ALTER INDEX IF EXISTS db_namespace."ActivityLog_expr_idx" RENAME TO "ActivityLog_context_parties_idx";

      ALTER INDEX IF EXISTS db_namespace."PartyEvents_expr_partyId_event_idx" RENAME TO "PartyEvents_communicationId_partyId_event_idx";

      ALTER INDEX IF EXISTS db_namespace."Communication_messageId_key" RENAME TO "Communication_messageId_idx1";
      `,
      tenantId,
    ),
  );
};

exports.down = () => {};
