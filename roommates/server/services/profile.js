/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveProfile, validateIfExists, getProfile } from '../dal/profile-repo';
import * as validators from '../../../server/api/helpers/validators';
import { ServiceError } from '../../../server/common/errors';

export const validateUser = async userId => {
  validators.uuid(userId, 'INVALID_USER_ID');
  const user = await validateIfExists(userId);
  if (!user) {
    throw new ServiceError({
      token: 'USER_NOT_FOUND',
      status: 404,
    });
  }
};

export const updateRoommateProfile = (userId, profile) => saveProfile(userId, profile);

export const getRoommateProfile = userId => getProfile(userId);
