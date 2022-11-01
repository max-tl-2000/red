/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from 'helpers/try-parse';
import { autorun } from 'mobx';
import { apiClient } from './api-client';
import { sessionStorage as ss } from '../../../common/helpers/globals';

/**
 * helper method to extract the token from the welcome url
 * */
const getTokenInUrl = pathname => {
  const matches = pathname.match(/^\?token=(.*)/);
  if (!matches) return null;
  return matches[1];
};

/**
 * takes the token either from location.search or from sessionStorage if found
 * and hydrate it into the auth instance. It also adds a listener to track changes
 * of the `isAuthenticated` flag to either add or remove the token from the
 * sessionStorage and apiClient
 * */
export const initAuth = ({ auth, location, onLogout, confirmToken }) => {
  const token = getTokenInUrl(location.search);
  const key = '__authData__';

  const authData = token ? { token } : tryParse(ss[key], null);

  if (authData) {
    auth.hydrate(authData);
  }

  if (confirmToken) {
    auth.hydrateConfirmToken(confirmToken);
  }

  let firstTime = true;

  return autorun(() => {
    if (auth.isAuthenticated) {
      apiClient.setExtraHeaders({
        Authorization: `Bearer ${auth.token}`,
      });
      ss[key] = JSON.stringify(auth.authInfo);
    } else if (!firstTime) {
      ss.removeItem(key);
      apiClient.clearHeaders();
      onLogout && onLogout();
    }

    firstTime = false;
  });
};
