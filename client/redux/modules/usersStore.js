/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { listToHash } from '../../../common/helpers/list-utils';
import { USERS_UPDATED, USERS_AVAILABILITY_CHANGED, USERS_SANDBOX_AVAILABILITY_CHANGED } from './globalStore';
import { logout } from '../../helpers/auth-helper';

const UPDATE_USER_FAIL = 'users/UPDATE_USER_FAIL';
export const AUTH_USER_STATUS_CHANGED = 'users/AUTH_USER_STATUS_CHANGED';

const initialState = {
  isAuthUserBusy: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case AUTH_USER_STATUS_CHANGED: {
      return {
        ...state,
        isAuthUserBusy: action.isAuthUserBusy,
      };
    }
    default:
      return state;
  }
}

const formatter = user => ({ users: { [user.id]: user } });

export const updateUser = (userId, user) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/users/${userId}`,
    payload: user,
  });

  if (error) {
    dispatch({ type: UPDATE_USER_FAIL, error });
    return;
  }

  dispatch({ type: USERS_UPDATED, result: formatter(data) });
};

export const updateUserStatus = (userId, status) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/users/${userId}/status`,
    payload: status,
  });

  if (error) {
    dispatch({ type: UPDATE_USER_FAIL, error });
    return;
  }

  const isAuthUserBusy = status === DALTypes.UserStatus.BUSY;
  dispatch({ type: AUTH_USER_STATUS_CHANGED, isAuthUserBusy });
  dispatch({ type: USERS_UPDATED, result: formatter(data) });
};

export const createIpPhoneCredentials = userId => makeRequest =>
  makeRequest({
    method: 'POST',
    url: `/users/${userId}/ipPhoneCredentials`,
  });

export const requestSandboxCreation = userId => async (makeRequest, dispatch) => {
  dispatch({ type: USERS_SANDBOX_AVAILABILITY_CHANGED, result: { userIds: [userId], sandboxTenant: '', sandboxAvailable: false, sandboxUrl: '' } });
  await makeRequest({
    method: 'POST',
    url: '/university/requestSandboxCreation',
  });
};

export const getSandboxUrl = userId => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/university/getSandboxUrl',
    payload: {},
  });

  if (error) {
    const result = { userIds: [userId], sandboxTenant: '', sandboxAvailable: false, sandboxUrl: '' };
    dispatch({ type: USERS_SANDBOX_AVAILABILITY_CHANGED, result });
    return result;
  }

  return data;
};

export const removeIpPhoneCredentials = (userId, sipUsername) => makeRequest =>
  makeRequest({
    method: 'DEL',
    url: `/users/${userId}/ipPhoneCredentials`,
    payload: { sipUsername },
  });

export const handleUsersUpdatedWSNotification = (ids, authUser, reqId) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/users',
    payload: { ids },
    reqId,
  });

  if (error) {
    dispatch({ type: UPDATE_USER_FAIL, error });
    return;
  }

  const currentUser = data.find(u => u.id === authUser.id);
  const isAuthUserBusy = currentUser && currentUser.metadata.status === DALTypes.UserStatus.BUSY;
  dispatch({ type: AUTH_USER_STATUS_CHANGED, isAuthUserBusy });

  dispatch({ type: USERS_UPDATED, result: { users: listToHash(data) } });
};

export const markAuthUserAsBusy = () => (_makeRequest, dispatch) => dispatch({ type: AUTH_USER_STATUS_CHANGED, isAuthUserBusy: true });

export const handleAvailabilityChangedWSNotification = (userIds, authUser, status, statusUpdatedAt) => async (_makeRequest, dispatch) => {
  if (userIds.includes(authUser.id)) {
    const isAuthUserBusy = status === DALTypes.UserStatus.BUSY;
    dispatch({ type: AUTH_USER_STATUS_CHANGED, isAuthUserBusy });
  }

  dispatch({ type: USERS_AVAILABILITY_CHANGED, result: { userIds, status, statusUpdatedAt } });
};

export const handleSandboxAvailabilityChangedWSNotification = (userIds, authUser, sandboxTenant, sandboxAvailable) => async (_makeRequest, dispatch) => {
  dispatch({ type: USERS_SANDBOX_AVAILABILITY_CHANGED, result: { userIds, sandboxTenant, sandboxAvailable } });
};

export const logoutUser = userId => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/users/${userId}/logoutUser`,
  });

  if (error || data?.userIsRevaAdmin) {
    logout();
    error && dispatch({ type: UPDATE_USER_FAIL, error });
  }
};
