/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { DALTypes } from '../../../common/enums/dal-types';

export const generateResetPasswordToken = async req => {
  const { userId, emailAddress } = req.body;

  badRequestErrorIfNotAvailable([
    { property: userId, message: 'MISSING_USER_ID' },
    { property: emailAddress, message: 'MISSING_EMAIL_ADDRESS' },
  ]);

  return createJWTToken({
    appId: DALTypes.AppId,
    userId,
    emailAddress,
    isResetPassword: true,
  });
};
