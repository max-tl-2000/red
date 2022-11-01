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
      UPDATE db_namespace."Communication"
      SET "partyOwner" = p."userId"
      FROM (
        SELECT p."userId" AS "userId", c.id AS "commId"
        FROM db_namespace."Communication" c 
        LEFT JOIN db_namespace."Party" p ON c.parties[1]::uuid = p.id
        WHERE c."partyOwner" IS NULL
          AND c.category NOT IN ('Reset password','Agent account registration')
          AND c.created_at > '2021-12-23 16:00:00.00 +0200'
      ) p
      WHERE p."commId" = id AND "partyOwner" IS NULL; 
      `,
      tenantId,
    ),
  );
};

exports.down = () => {};
