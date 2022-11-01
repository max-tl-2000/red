/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initProvider, providerLogout } from 'helpers/telephonyProvider';
import { loadGlobalData, LOAD_GLOBAL_DATA_SUCCESS, RESET_GLOBAL_DATA } from './globalStore';

const LOGIN = 'reva/auth/LOGIN';
export const LOGIN_SUCCESS = 'reva/auth/LOGIN_SUCCESS';
const LOGIN_FAIL = 'reva/auth/LOGIN_FAIL';
const REGISTER_WITH_INVITE = 'reva/auth/REGISTER_WITH_INVITE';
const REGISTER_WITH_INVITE_SUCCESS = 'reva/auth/REGISTER_WITH_INVITE_SUCCESS';
const REGISTER_WITH_INVITE_FAIL = 'reva/auth/REGISTER_WITH_INVITE_FAIL';
const VALIDATE_TOKEN = 'reva/auth/VALIDATE_TOKEN';
const VALIDATE_TOKEN_SUCCESS = 'reva/auth/VALIDATE_TOKEN_SUCCESS';
const VALIDATE_TOKEN_FAIL = 'reva/auth/VALIDATE_TOKEN_FAIL';
const RESET_PASSWORD = 'reva/auth/RESET_PASSWORD';
const RESET_PASSWORD_SUCCESS = 'reva/auth/RESET_PASSWORD_SUCCESS';
const RESET_PASSWORD_FAIL = 'reva/auth/RESET_PASSWORD_FAIL';
const RESTORE_STATE = 'reva/auth/RESTORE_STATE';
const RESET_LOGIN_ERROR = 'reva/auth/RESET_LOGIN_ERROR';
const USER_UPDATED = 'reva/auth/USER_UPDATED';

export const LOGOUT = 'reva/auth/LOGOUT';
export const PREPARE_LOGOUT = 'reva/auth/PREPARE_LOGOUT';

const initialState = {
  loaded: false,
  blockedAccount: false,
  resetPasswordInProgress: false, // needed to track the progress of the resetPassword xhr call
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case RESET_LOGIN_ERROR:
      return {
        ...state,
        loginError: null,
        loggingIn: false,
        loggingOut: false,
      };
    case RESTORE_STATE:
      return {
        ...state,
        ...action.state,
        loginError: null,
        loggingIn: false,
        loggingOut: false,
        blockedAccount: false,
      };
    case LOGIN:
      return {
        ...state,
        loggingIn: true,
        loggedIn: false,
        loggingOut: false,
        loginError: null,
      };
    case LOGIN_SUCCESS:
      initProvider(action.result.user, action.store);
      return {
        ...state,
        loggingIn: false,
        loggedIn: true,
        loggingOut: false,
        ...action.result,
      };
    case LOGIN_FAIL:
      return {
        ...state,
        loggingIn: false,
        loggedIn: false,
        loggingOut: false,
        user: null,
        loginError: action.error.token || action.error.message,
        blockedAccount: action.error?.data?.blockedAccount,
      };
    case REGISTER_WITH_INVITE:
      return {
        ...state,
        registering: true,
        registrationError: null,
      };
    case REGISTER_WITH_INVITE_SUCCESS:
      return {
        ...state,
        token: action.result.token,
        user: action.result.user,
        registering: false,
      };
    case REGISTER_WITH_INVITE_FAIL:
      return {
        ...state,
        registering: false,
        registrationError: action.error.token,
      };
    case LOGOUT:
      setTimeout(providerLogout, 50);
      return {
        loggingOut: true,
        ...action.state,
      };
    case PREPARE_LOGOUT:
      return {
        ...state,
        ...action.state,
      };
    case VALIDATE_TOKEN:
      return {
        ...state,
      };
    case VALIDATE_TOKEN_SUCCESS:
      return {
        ...state,
        validToken: action.result,
      };
    case VALIDATE_TOKEN_FAIL:
      return {
        ...state,
        validateTokenError: action.error.token,
      };
    case RESET_PASSWORD:
      return {
        ...state,
        resetPasswordInProgress: true,
      };
    case RESET_PASSWORD_SUCCESS:
      return {
        ...state,
        resetPasswordInProgress: false,
      };
    case RESET_PASSWORD_FAIL:
      return {
        ...state,
        user: null,
        resetPasswordInProgress: false,
        resetPasswordError: action.error.token || action.error.message,
      };
    case USER_UPDATED: {
      const userUpdates = state.user.id === action.user.id && action.user;
      return {
        ...state,
        user: { ...state.user, ...userUpdates },
      };
    }
    default:
      return state;
  }
}

export function handleUserUpdated(user) {
  return { type: USER_UPDATED, user };
}

export const login = (email, password) => async (makeRequest, dispatch, getState) => {
  dispatch({ type: LOGIN });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/login',
    payload: {
      email,
      password,
      utcOffset: new Date().getTimezoneOffset(),
    },
  });

  if (error) {
    dispatch({ type: LOGIN_FAIL, error });
    return;
  }

  const { globalData, ...rest } = data;

  dispatch({ type: LOGIN_SUCCESS, result: rest, store: { dispatch, state: getState() } });
  dispatch({ type: LOAD_GLOBAL_DATA_SUCCESS, result: globalData });
};

export const autoLogin = autoLoginToken => async (makeRequest, dispatch, getState) => {
  dispatch({ type: LOGIN });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/university/autoLogin',
    payload: {
      autoLoginToken,
      utcOffset: new Date().getTimezoneOffset(),
    },
    extraHeaders: {
      Authorization: `Bearer ${autoLoginToken}`,
    },
  });

  if (error) {
    dispatch({ type: LOGIN_FAIL, error });
    return;
  }

  const { globalData, ...rest } = data;
  dispatch({ type: LOGIN_SUCCESS, result: rest, store: { dispatch, state: getState() } });
  dispatch({ type: LOAD_GLOBAL_DATA_SUCCESS, result: globalData });
};

export function registerWithInvite(token, fullName, preferredName, password) {
  return {
    types: [REGISTER_WITH_INVITE, REGISTER_WITH_INVITE_SUCCESS, REGISTER_WITH_INVITE_FAIL],
    promise: client =>
      client.post('/registerWithInvite', {
        data: {
          token,
          fullName,
          preferredName,
          password,
          utcOffset: new Date().getTimezoneOffset(),
        },
      }),
  };
}

export const logout = () => (_makeRequest, dispatch) => {
  dispatch({ type: LOGOUT, state: initialState });
  dispatch({ type: RESET_GLOBAL_DATA });
};

export function prepareLogout() {
  return {
    type: PREPARE_LOGOUT,
    state: {
      loggingOut: true,
    },
  };
}

export function validateToken(token) {
  return {
    types: [VALIDATE_TOKEN, VALIDATE_TOKEN_SUCCESS, VALIDATE_TOKEN_FAIL],
    promise: client =>
      client.post('/validateToken', {
        data: {
          token,
        },
      }),
  };
}

export const restoreState = (state = {}) => async (makeRequest, dispatch) => {
  dispatch({ type: RESTORE_STATE, state });
  if (Object.keys(state).length > 0 && state.isLoggingOut !== false) {
    await dispatch(loadGlobalData());
  }
};

export const resetUserPassword = (email, password, token, isRegisterMode) => async (makeRequest, dispatch) => {
  dispatch({ type: RESET_PASSWORD });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/resetPassword',
    payload: {
      email,
      password,
      token,
      isRegisterMode,
      utcOffset: new Date().getTimezoneOffset(),
    },
  });

  if (error) {
    dispatch({ type: RESET_PASSWORD_FAIL, error });
    return null;
  }

  // this will set the user and token
  // before it was done in the RESET_PASSWORD_SUCCESS
  await dispatch(restoreState(data));

  // RESET_PASSWORD_SUCCESS now only sets the flag to cancel the reset password login
  dispatch({ type: RESET_PASSWORD_SUCCESS });

  return data;
};

export function resetLoginError() {
  return {
    type: RESET_LOGIN_ERROR,
  };
}
