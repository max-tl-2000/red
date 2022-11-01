/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, rawStatement } from '../database/factory';

export const savePartyCohort = async (ctx, partyCohort) => await insertOrUpdate(ctx, 'PartyCohort', partyCohort);

export const getPartyCohorts = async ctx => {
  const query = `
    SELECT *
    FROM db_namespace."PartyCohort"`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
