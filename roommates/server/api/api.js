/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { actions } from './actions/actions-proxy';

export const setupApis = app => {
  app.patch('/profiles/:userId', actions.updateProfile);
  app.get('/profiles/:userId', actions.getProfile);
  app.post('/register/generateToken', actions.generateRegisterToken);
  app.post('/requestResetPassword/generateToken', actions.generateResetPasswordToken);
  app.get('/roommates', actions.getRoommates);
  app.post('/roommates/messages/send', actions.sendMessage);
};
