/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../common/helpers/logger';
import { rawStatement } from '../database/factory';

export const saveCreateSandboxJob = async (ctx, sandboxData) => {
  logger.trace({ ctx, sandboxData }, 'saveCreateSandboxJob');
  const command = `
      INSERT INTO db_namespace."CreateSandboxJob"
      (id, "userId", "email", "tenantId", "host")
      VALUES("public".gen_random_uuid(), :user_id, :email, :tenant_id, :host)
      RETURNING *
      `;

  const { userId, email, tenantId, host } = sandboxData;
  const { rows } = await rawStatement(ctx, command, [{ user_id: userId, email, tenant_id: tenantId, host }]);

  return rows ? rows[0] : {};
};

export const getCreateSandboxJobById = async (ctx, id) => {
  logger.debug({ ctx, id }, 'getCreateSandboxJobById');
  const query = `
      SELECT cs.*, t.name as "tenantName" FROM db_namespace."CreateSandboxJob" cs
      INNER JOIN db_namespace."Tenant" t on cs."tenantId" = t.id
      WHERE cs.id = :id
  `;

  const { rows } = await rawStatement(ctx, query, [{ id }]);
  return rows && rows[0];
};

export const updateCreateSandboxStatusById = async (ctx, id, newStatus) => {
  logger.debug({ ctx, id, newStatus }, 'updateCreateSandboxStatusById');
  const query = `
        UPDATE db_namespace."CreateSandboxJob"
        SET status = :new_status
        WHERE id = :id
    `;

  const { rows } = await rawStatement(ctx, query, [{ new_status: newStatus, id }]);
  return rows && rows[0] && rows[0].status;
};
