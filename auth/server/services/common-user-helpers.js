/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getOneWhere, updateOne } from '../../../server/database/factory';
import { ServiceError, AuthorizationDataError } from '../../../server/common/errors';
import { COMMON } from '../../../server/common/schemaConstants';
import { now } from '../../../common/helpers/moment-utils';
import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { validateEmail } from '../../../common/helpers/validations/email';
import { canResetLoginAttempts } from './users-helpers';
import { compare } from '../../../server/helpers/crypto';
import trim from '../../../common/helpers/trim';

const COMMON_USERS_TABLE = 'Users';

const ensureCommonCtx = ctx => (ctx.tenantId !== COMMON ? { ...ctx, tenantId: COMMON } : ctx);

const updateCommonUser = async (ctx, user, errorToken) => {
  try {
    ctx = ensureCommonCtx(ctx);
    return await updateOne(ctx, COMMON_USERS_TABLE, user.id, user);
  } catch (err) {
    return Promise.reject(
      new ServiceError({
        token: errorToken || err,
      }),
    );
  }
};

const updateCommonUserLoginAttempts = (ctx, { id }, updatedAttempts) =>
  updateCommonUser(ctx, { id, loginAttempts: updatedAttempts }, 'UPDATE_LOGIN_ATTEMPTS_FAIL');

const updateCommonUserLastLoginAttempt = (ctx, { id }) => updateCommonUser(ctx, { id, lastLoginAttempt: now().toJSON() }, 'UPDATE_LAST_LOGIN_ATTEMPT_FAIL');

const incrementCommonUserLoginAttempts = (ctx, { id, loginAttempts }) => updateCommonUserLoginAttempts(ctx, { id }, loginAttempts + 1);

const resetCommonUserLoginAttempts = (ctx, { id }) => updateCommonUserLoginAttempts(ctx, { id }, 0);

const getMatchingCommonUser = (ctx, email) =>
  getOneWhere(ensureCommonCtx(ctx), COMMON_USERS_TABLE, {
    email: email.toLowerCase(),
  });

export const commonUserSignIn = async (ctx, { email, password }, authConfig = {}) => {
  ctx = ensureCommonCtx(ctx);
  email = trim(email);
  password = trim(password);
  const mailError = validateEmail(email);

  if (mailError) {
    throw new AuthorizationDataError({
      token: mailError,
    });
  }

  if (!password) {
    throw new AuthorizationDataError({
      token: 'MISSING_PASSWORD',
    });
  }

  const matchingUser = await getMatchingCommonUser(ctx, email);

  if (!matchingUser) {
    throw new AuthorizationDataError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_AND_PASSWORD_MISMATCH,
    });
  }

  if (matchingUser.inactive) {
    throw new AuthorizationDataError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.INACTIVE_ACCOUNT,
    });
  }

  const mustResetAttempts = canResetLoginAttempts(matchingUser, authConfig);

  await updateCommonUserLastLoginAttempt(ctx, matchingUser);

  const isCorrect = matchingUser.password && (await compare(password, matchingUser.password));

  if (!isCorrect) {
    await (mustResetAttempts ? updateCommonUserLoginAttempts(ctx, matchingUser, 1) : incrementCommonUserLoginAttempts(ctx, matchingUser));

    throw new AuthorizationDataError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_AND_PASSWORD_MISMATCH,
    });
  }

  await resetCommonUserLoginAttempts(ctx, matchingUser);

  return matchingUser;
};
