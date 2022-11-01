/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../database/factory';

export const saveLeaseDocumentTemplate = async (ctx, leaseDocumentTemplate) => {
  const command = `
      INSERT INTO db_namespace."LeaseDocumentTemplate"
      (id, name, category, "displayName", "manuallySelectedFlag", "sandboxTemplateId", "prodTemplateId")
      VALUES("public".gen_random_uuid(), :name, :category, :displayName, :manuallySelectedFlag, :sandboxTemplateId, :prodTemplateId)
      ON CONFLICT ("name") DO
      UPDATE
      SET
        "category" = :category,
        "displayName" = :displayName,
        "manuallySelectedFlag" = :manuallySelectedFlag,
        "sandboxTemplateId" = :sandboxTemplateId,
        "prodTemplateId" = :prodTemplateId,
        "updated_at" = now()
      RETURNING *
    `;

  const { rows = [] } = await rawStatement(ctx, command, [leaseDocumentTemplate]);

  return rows[0] || {};
};

export const getLeaseDocumentTemplateToExport = async ctx => {
  const { rows = [] } = await rawStatement(
    ctx,
    `
      SELECT name, category, "displayName", "manuallySelectedFlag", "sandboxTemplateId", "prodTemplateId"
      FROM db_namespace."LeaseDocumentTemplate"
    `,
  );
  return rows;
};
