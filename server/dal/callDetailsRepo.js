/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { rawStatement } from '../database/factory';

export const getCallDetailsByCommId = async (ctx, commId) => {
  const query = `SELECT *
                 FROM db_namespace."CallDetails"
                 WHERE "commId" = :commId`;

  const { rows } = await rawStatement(ctx, query, [{ commId }]);
  const [details] = rows;
  return details;
};

export const saveCallDetails = async (ctx, { commId, details }) => {
  const command = `INSERT INTO db_namespace."CallDetails" (id, "commId", details)
                   VALUES (:id, :commId, :details)
                   ON CONFLICT ("commId") DO UPDATE
                   SET details = db_namespace."CallDetails".details::jsonb || :details
                   WHERE db_namespace."CallDetails"."commId" = :commId
                   RETURNING *`;

  const { rows } = await rawStatement(ctx, command, [{ id: newId(), commId, details }]);
  const [savedDetails] = rows;
  return savedDetails;
};
