/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Auth } from './auth';
import mediator from '../../helpers/mediator';

export const createAuthStore = () => {
  const auth = new Auth();
  mediator.on('user:login', (_e: any, args: any) => {
    const { user, token } = args;
    const userInfo = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      tenantId: user.tenantId,
    };
    auth.setTokenAndUser(userInfo, token);
  });
  mediator.on('user:logout', () => {
    auth.clearTokenAndUser();
  });

  return auth;
};
