/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { decodeJWTToken } from '../../../common/server/jwt-helpers';

const getErrorToken = error => {
  const { name } = error;
  if (name === 'TokenExpiredError') {
    return 'EMAIL_TOKEN_EXPIRED';
  }
  return 'EMAIL_TOKEN_DECODE_FAILURE';
};

export const decodeEmailToken = emailToken => {
  try {
    return {
      successful: true,
      result: decodeJWTToken(emailToken, null, {
        jwtConfigKeyName: 'resident.emailJwtSecret',
        encryptionConfigKeyName: 'resident.emailEncryptionKey',
      }),
    };
  } catch (error) {
    return { successful: false, result: null, errorToken: getErrorToken(error) };
  }
};
