/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validateUser, updateRoommateProfile, getRoommateProfile } from '../../services/profile';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';

export const updateProfile = async req => {
  const { userId } = req.params;
  const profile = req.body;

  badRequestErrorIfNotAvailable([
    { property: userId, message: 'MISSING_USER_ID' },
    { property: profile, message: 'MISSING_PROFILE' },
  ]);

  await validateUser(userId);
  return await updateRoommateProfile(userId, profile);
};

export const getProfile = async req => {
  const { userId } = req.params;

  badRequestErrorIfNotAvailable([{ property: userId, message: 'MISSING_USER_ID' }]);

  await validateUser(userId);
  return await getRoommateProfile(userId);
};
