/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from '../helpers/mediator';
import { restoreState } from '../redux/modules/auth';
import { lsGet, lsSave, lsClear, REVATECH_AUTH } from '../helpers/ls';
import { initProvider } from '../helpers/telephonyProvider';

const cleanAuthState = (authState = {}) => {
  const { user, token } = authState;
  if (!user && !token) return null;
  return { user, token };
};

export const checkAuthChanges = store => {
  let prevAuth = {};

  store.subscribe(() => {
    const auth = store.getState().auth;
    if (prevAuth !== auth) {
      if (!prevAuth.user && auth.user) {
        mediator.fire('user:login', { user: auth.user, token: auth.token });
        prevAuth = auth;
        lsSave(REVATECH_AUTH, cleanAuthState(auth));
      }
      if (prevAuth.user && !auth.user) {
        mediator.fire('user:logout', { user: prevAuth.user });
        prevAuth = {};
        lsClear(REVATECH_AUTH);
      }
    }
  });

  const revaAuth = lsGet(REVATECH_AUTH);

  if (revaAuth) {
    store.dispatch(restoreState(cleanAuthState(revaAuth)));
    if (revaAuth.user) {
      initProvider(revaAuth.user, store);
    }
  }
};
