/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const EMAIL_ADDRESS_ERROR_TOKENS = {
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  INVALID_EMAIL: 'INVALID_EMAIL',
};

export const USER_AUTHORIZATION_ERROR_TOKENS = {
  EMAIL_AND_PASSWORD_MISMATCH: 'EMAIL_AND_PASSWORD_MISMATCH',
  INACTIVE_ACCOUNT: 'INACTIVE_ACCOUNT',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  ...EMAIL_ADDRESS_ERROR_TOKENS,
};
