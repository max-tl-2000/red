/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ADMIN, COMMON } from '../../../server/common/schemaConstants';
import { rawStatement } from '../../../server/database/factory';

export const getRelatedTenantsByCommonUserId = async (ctx, commonUserId) => {
  const query = `
    SELECT
      t.id "tenantId",
      t.name "tenantName",
      up."personId",
      t.settings->'legal' as "tenantLegal"
    FROM db_namespace."UserPerson" up
    INNER JOIN :adminSchema:."Tenant" t ON (t.id = up."tenantId")
    WHERE up."userId" = :commonUserId
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      adminSchema: ADMIN,
      commonUserId,
    },
  ]);

  return rows;
};

export const getCommonUserById = async (ctx, commonUserId) => {
  const context = { ...ctx, tenantId: COMMON };

  const query = `
    SELECT u.*
    FROM db_namespace."Users" u
    WHERE u.id = :commonUserId
  `;

  const { rows } = await rawStatement(context, query, [
    {
      commonUserId,
    },
  ]);

  return rows[0];
};

export const wasCommonUserPasswordPreviouslySet = async (ctx, commonUserId) => {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM db_namespace."Users"
      WHERE
        id = :commonUserId AND
        ("password" IS NOT NULL AND "password" !='')
    )
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      commonUserId,
    },
  ]);

  return rows[0]?.exists;
};
