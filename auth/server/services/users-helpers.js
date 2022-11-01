/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { AuthorizationDataError, ServiceError } from '../../../server/common/errors';
import nullish from '../../../common/helpers/nullish';

export const canResetLoginAttempts = (user, { maxLoginAttempts, resetAttemptsTimeout } = {}) => {
  if (nullish(maxLoginAttempts)) {
    throw new ServiceError({
      token: 'MISSING_AUTH_CONFIG_MAX_LOGIN_ATTEMPTS',
    });
  }

  if (nullish(resetAttemptsTimeout)) {
    throw new ServiceError({
      token: 'MISSING_AUTH_CONFIG_RESET_ATTEMPTS_TIMEOUT',
    });
  }

  if (user.loginAttempts < maxLoginAttempts) return false;

  if (user.lastLoginAttempt) {
    const dateToCompare = toMoment(user.lastLoginAttempt).add(resetAttemptsTimeout, 'minutes');
    if (dateToCompare.isBefore(now())) return true;
  }

  throw new AuthorizationDataError({
    token: USER_AUTHORIZATION_ERROR_TOKENS.ACCOUNT_BLOCKED,
    data: {
      blockedAccount: true,
    },
  });
};
