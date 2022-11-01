/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from 'helpers/try-parse';
import { observe, reaction } from 'mobx';
import mediator from 'helpers/mediator';
import { sessionStorage as ss } from '../../../common/helpers/globals';
import { apiClient } from './api-client';
import { initSocketClient, disconnect, socketClient } from './socket-client';
import { logout, showSessionLostDialog, isTokenExpiredError } from './helpers/client-auth-helper';
import { location as loc } from '../../../client/helpers/navigator';
import { parseQueryString } from '../../../client/helpers/url';
const AUTH_TOKEN_NAME = 'token';
/**
 * helper method to extract the token from the welcome url
 * */
const getTokenFromUrl = pathname => {
  console.log('getTokenFromUrl', pathname);
  const matches =
    pathname.match(/^\/welcome\/([^/\\?]*)/) ||
    pathname.match(/^\/applicationList\/([^/\\?]*)/) ||
    pathname.match(/review\/([^/\\?]*)/) ||
    pathname.match(/^\/applicationAdditionalInfo\/([^/\\?]*)/) ||
    pathname.match(/^\/resetPassword\/([^/\\?]*)/) ||
    pathname.match(/^\/confirmResetPassword\/([^/\\?]*)/);
  if (!matches) return null;
  console.log('found token', matches[1]);
  return matches[1];
};

const getUserIdFromUrl = pathname => {
  console.log('getUserIdFromUrl', pathname);
  const queryParams = parseQueryString(pathname);
  return queryParams.userId;
};

const hydrateApiClient = ({ auth, wsUrl, ssKey, onLogout }) => {
  if (auth.isAuthenticated) {
    apiClient.setExtraHeaders({
      Authorization: `Bearer ${auth.token}`,
    });

    initSocketClient({ wsUrl, token: auth.token });
    ss[ssKey] = JSON.stringify(auth.authInfo);
    mediator.fire('user:login', {});
  } else {
    ss.removeItem(ssKey);
    apiClient.clearHeaders();
    disconnect();
    if (!auth.skipOnLogoutEvent) {
      onLogout && onLogout();
    }
  }
};

/**
 * takes the token either from location.pathname or from sessionStorage if found
 * and hydrate it into the auth instance. It also adds a listener to track changes
 * of the `isAuthenticated` flag to either add or remove the token from the
 * sessionStorage and apiClient
 * */
export const initAuth = ({ auth, location, onLogout, wsUrl, agent, application }) => {
  const token = getTokenFromUrl(location.pathname);
  const paramUserId = getUserIdFromUrl(location.search);
  const key = '__authData__';

  const data = tryParse(ss[key], null);
  let authData = paramUserId ? { ...data, userId: paramUserId } : data;
  authData = token ? { ...authData, token } : authData;

  if (authData?.token) {
    auth.hydrate(authData);
    const { userId } = authData;
    if (userId && token) {
      auth._updateUser(authData);
    }
  }

  hydrateApiClient({ auth, wsUrl, ssKey: key, onLogout });

  apiClient.on('request:error', (evt, err) => {
    const error = err.data || err;
    if (isTokenExpiredError(error)) {
      showSessionLostDialog(agent, application);
      return;
    }

    const shouldPerformLogout = (err.status === 400 && err.token === 'INVALID_TENANT') || (err.status === 401 && auth.isAuthenticated);

    if (!shouldPerformLogout) return;

    logout(auth);
  });

  socketClient.on('unauthorized', (evt, err) => {
    const error = err.data || err;
    if (isTokenExpiredError(error)) {
      if (location.pathname.includes('confirmResetPassword')) {
        loc.replace('/notFound');
        return;
      }

      if (!location.pathname.includes('notFound')) {
        showSessionLostDialog(agent, application);
      }

      return;
    }
    logout(auth);
  });

  reaction(
    () => application?.personApplicationId,
    () => {
      const parsedData = tryParse(ss[key], null);
      if (!parsedData?.impersonatorUserId) {
        auth.addImpersonationInfo(application?.applicant);
        hydrateApiClient({ auth, wsUrl, ssKey: key, onLogout });
      }
    },
  );

  return observe(auth, change => {
    if (change.name === AUTH_TOKEN_NAME) {
      hydrateApiClient({ auth, wsUrl, ssKey: key, onLogout });
    }
  });
};
