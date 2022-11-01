/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { updateOne, getOneWhere, getAllWhere } from '../../../server/database/factory';
import { compare } from '../../../server/helpers/crypto';
import { AuthorizationDataError, ServiceError } from '../../../server/common/errors';
import { tenantAdminEmail } from '../../../common/helpers/database';
import { validateEmail } from '../../../common/helpers/validations/email';
import { isReservedTenantName } from '../../../server/helpers/tenantUtils';
import { isRevaAdmin } from '../../../common/helpers/auth';
import config from '../../config';
import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { getTenantData } from '../../../server/dal/tenantsRepo';
import { isUuid } from '../../../server/common/utils';
import { canResetLoginAttempts } from './users-helpers';

const USERS_TABLE = 'Users';

const throwUnauthorizedError = data => {
  throw new AuthorizationDataError({ ...data });
};

export const updateUser = async (ctx, user, errorToken) => {
  try {
    return await updateOne(ctx, USERS_TABLE, user.id, user);
  } catch (err) {
    return Promise.reject(
      new ServiceError({
        token: errorToken || err,
      }),
    );
  }
};

export const updateLastLoginAttempt = (ctx, { id }) => updateUser(ctx, { id, lastLoginAttempt: new Date() }, 'UPDATE_LAST_LOGIN_ATTEMPT_FAIL');

const updateLoginAttempts = (ctx, { id }, updatedAttempts) => updateUser(ctx, { id, loginAttempts: updatedAttempts }, 'UPDATE_LOGIN_ATTEMPTS_FAIL');

const incrementLoginAttempts = (ctx, { id, loginAttempts }) => updateLoginAttempts(ctx, { id }, loginAttempts + 1);

const resetLoginAttempts = (ctx, { id }) => updateLoginAttempts(ctx, { id }, 0);

export const getUserByEmail = async ({ tenantId }, email, errorIfNotFound = true) => {
  if (email !== tenantAdminEmail) {
    const mailError = validateEmail(email);

    if (mailError) {
      throwUnauthorizedError({
        token: mailError,
      });
    }
  }

  const matchingUser = await getOneWhere(tenantId, USERS_TABLE, {
    email: email.toLowerCase(),
  });

  if (!matchingUser && errorIfNotFound) {
    throwUnauthorizedError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_AND_PASSWORD_MISMATCH,
    });
  }

  if (matchingUser && !isReservedTenantName(tenantId)) {
    const teams = await getAllWhere({ tenantId }, 'TeamMembers', { userId: matchingUser.id }, ['teamId', 'inactive']);
    const isUserInactive = teams.every(item => item.inactive);

    return {
      ...matchingUser,
      inactive: isRevaAdmin(matchingUser) || email === tenantAdminEmail ? false : isUserInactive,
      teamIds: teams.filter(t => !t.inactive).map(t => t.teamId),
    };
  }

  return matchingUser;
};

export const signInUser = async (ctx, email, password) => {
  const matchingUser = await getUserByEmail(ctx, email);

  if (matchingUser.inactive) {
    throwUnauthorizedError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.INACTIVE_ACCOUNT,
    });
  }

  const mustResetAttempts = canResetLoginAttempts(matchingUser, config.auth);

  await updateLastLoginAttempt(ctx, matchingUser);

  let isCorrect;

  if (matchingUser.email === tenantAdminEmail || isRevaAdmin(matchingUser)) {
    isCorrect = await compare(password, matchingUser.password);
  } else if (!matchingUser.password) {
    // if ctx.tenantId is not an UUID it might be one of the reserved tenant names, like admin or common
    // in that case there is nothing we can do as we won't be able to get a default password as these are
    // not real tenants
    if (isUuid(ctx.tenantId)) {
      const tenant = await getTenantData(ctx);
      const tenantPassword = get(tenant, 'metadata.userDefaultPassword');
      isCorrect = tenantPassword && (await compare(password, tenantPassword));
    }
  } else {
    isCorrect = matchingUser.password && (await compare(password, matchingUser.password));
  }

  if (!isCorrect) {
    await (mustResetAttempts ? updateLoginAttempts(ctx, matchingUser, 1) : incrementLoginAttempts(ctx, matchingUser));

    throwUnauthorizedError({
      token: USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_AND_PASSWORD_MISMATCH,
    });
  }

  await resetLoginAttempts(ctx, matchingUser);

  return matchingUser;
};
