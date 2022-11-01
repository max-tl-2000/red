/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../common/enums/DALTypes';
import { initQuery, runInTransaction, insertInto } from '../database/factory';

export async function registerResetTokenForUser(ctx, user, token) {
  return runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    token = {
      ...token,
      id: getUUID(),
      type: DALTypes.TokenType.RESET_PASSWORD,
    };

    await initQuery(innerCtx).insert(token).into('Tokens');

    const resetToken = {
      user_id: user.id,
      token_id: token.id,
    };
    const [savedToken] = await initQuery(innerCtx).insert(resetToken).into('ResetTokens').returning('*');
    return savedToken;
  }, ctx);
}

export async function getUserFromResetToken(ctx, tokenCode) {
  const [resetToken] = await initQuery(ctx)
    .from('ResetTokens')
    .innerJoin('Tokens', 'ResetTokens.token_id', 'Tokens.id')
    .withSchema(ctx.tenantId)
    .whereRaw('"Tokens"."token" = ?', [tokenCode]);

  if (!resetToken) return undefined;

  const [user] = await initQuery(ctx).from('Users').where({ id: resetToken.user_id });
  return user;
}

export async function getToken(ctx, tokenCode) {
  const [dbToken] = await initQuery(ctx).from('Tokens').where({ token: tokenCode });

  return dbToken;
}

export const saveToken = async (ctx, entity) => await insertInto(ctx.tenantId, 'Tokens', entity);
