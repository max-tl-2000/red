/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from 'helpers/try-parse';
import { autorun } from 'mobx';
import { sessionStorage } from '../../../common/helpers/globals';
import { apiClient } from './api-client';
// import { initSocketClient, disconnect } from './socket-client'; // TODO: Uncomment this line when roommates SocketIO handshake is configured

/**
 * helper method to extract the token from the welcome url
 * */
const getTokenInUrl = pathname => {
  const matches = pathname.match(/^\/welcome\/(.*)/) || pathname.match(/review\/(.*)/) || pathname.match(/^\/applicationAdditionalInfo\/(.*)/);
  if (!matches) return null;
  return matches[1];
};

/**
 * takes the token either from location.pathname or from sessionStorage if found
 * and hydrate it into the auth instance. It also adds a listener to track changes
 * of the `isAuthenticated` flag to either add or remove the token from the
 * sessionStorage and apiClient
 * */
export const initAuth = ({ auth, location, onLogout, propertyConfig }) => {
  const token = getTokenInUrl(location.pathname);

  const key = '__authData__';

  const authData = token ? { token } : tryParse(sessionStorage[key], null);

  if (authData) {
    auth.hydrate(authData);
  }

  // TODO: If propertyConfig undefined redirect to NotFound page
  if (propertyConfig) {
    auth.hydratePropertyConfig(propertyConfig);
  }

  let firstTime = true;

  return autorun(() => {
    if (propertyConfig) {
      apiClient.setExtraHeaders(propertyConfig);
    }
    if (auth.isAuthenticated) {
      apiClient.setExtraHeaders({
        Authorization: `Bearer ${auth.token}`,
      });
      // initSocketClient({ webSocketUrl, token: auth.token }); // TODO: Uncomment this line when roommates SocketIO handshake is configured
      sessionStorage[key] = JSON.stringify(auth.authInfo);
    } else if (!firstTime) {
      sessionStorage.removeItem(key);
      // disconnect(); // TODO: Uncomment this line when roommates SocketIO handshake is configured
      if (!auth.skipOnLogoutEvent) {
        onLogout && onLogout();
      }
    }

    firstTime = false;
  });
};
