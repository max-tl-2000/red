/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { knex } from '../../../server/database/factory';
import { commonSchema } from '../../../common/helpers/database';
import { prepareRawQuery } from '../../../server/common/schemaConstants';

const TOKENS_TABLE = 'ResetToken';

export const saveCommonToken = async (ctx, token) => {
  token.id = getUUID();
  const query = prepareRawQuery(
    'INSERT INTO db_namespace.:resetTokenTable: ("id", "token", "expiryDate", "userId") values (:id, :token, :expiryDate, :userId) returning "token";',
    commonSchema,
  );

  const { rows } = await knex.raw(query, {
    resetTokenTable: TOKENS_TABLE,
    id: getUUID(),
    token: token.token,
    expiryDate: token.expiryDate,
    userId: token.userId,
  });

  return rows.length === 1 ? rows[0].token : undefined;
};

export const getToken = async (ctx, token) => {
  const query = prepareRawQuery('SELECT * FROM db_namespace.:resetTokenTable: WHERE token = :token', commonSchema);
  const { rows } = await knex.raw(query, { resetTokenTable: TOKENS_TABLE, token });

  return rows.length && rows[0];
};

export const makeTokenInvalid = async (ctx, commonUserId) => {
  const query = prepareRawQuery('UPDATE db_namespace.:resetTokenTable: SET valid = false WHERE "userId" = :userId', commonSchema);
  await knex.raw(query, { resetTokenTable: TOKENS_TABLE, userId: commonUserId });
};
