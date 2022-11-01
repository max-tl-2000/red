/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v1';
import { registerResetTokenForUser, getUserFromResetToken as fetchUserFromResetToken, getToken } from '../dal/tokensRepo.js';
import config from '../config';
import { ServiceError } from '../common/errors';
import { now } from '../../common/helpers/moment-utils';
import { DALTypes } from '../../common/enums/DALTypes';

const generateToken = () => {
  const token = {
    token: getUUID(),
    expiry_date: now().add(config.tokens.validPeriodInDays, 'days'),
  };
  return token;
};

export const getResetTokenForUser = async (ctx, user) => {
  const generatedToken = generateToken();

  const savedToken = await registerResetTokenForUser(ctx, user, generatedToken);

  if (!savedToken) {
    throw new ServiceError({
      token: 'ERROR_SAVING_RESET_TOKEN',
    });
  }

  return generatedToken.token;
};

export const validateToken = async (ctx, token) => {
  const dbToken = await getToken(ctx, token);
  const user = dbToken && dbToken.type === DALTypes.TokenType.RESET_PASSWORD ? await fetchUserFromResetToken(ctx, token) : {};

  if (!dbToken || !dbToken.valid) {
    throw new ServiceError({
      token: 'INVALID_TOKEN',
      status: 498,
      data: {
        email: user.email,
      },
    });
  }

  if (dbToken.expiry_date < new Date()) {
    throw new ServiceError({
      token: 'EXPIRED_TOKEN',
      status: 498,
      data: {
        email: user.email,
      },
    });
  }
  return user;
};

export const getUserFromResetToken = async (ctx, token) => {
  const user = await validateToken(ctx, token);

  if (!user) {
    // Should only happen if someone tries to reset a password with other type of token
    throw new ServiceError({
      status: 498,
      token: 'INVALID_TOKEN',
    });
  }

  return {
    user,
  };
};
