/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const FETCH_APP_SETTINGS = 'reva/FETCH_APP_SETTINGS';
const FETCH_APP_SETTINGS_SUCCESS = 'reva/FETCH_APP_SETTINGS_SUCCESS';
const FETCH_APP_SETTINGS_FAIL = 'reva/FETCH_APP_SETTINGS_FAIL';
const SAVE_APP_SETTINGS = 'reva/SAVE_APP_SETTINGS';
const SAVE_APP_SETTINGS_SUCCESS = 'reva/SAVE_APP_SETTINGS_SUCCESS';
const SAVE_APP_SETTINGS_FAIL = 'reva/SAVE_APP_SETTINGS_FAIL';

const initialState = { isLoading: false };

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case FETCH_APP_SETTINGS:
      return {
        ...state,
        isLoading: true,
        appSettings: [],
      };
    case FETCH_APP_SETTINGS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        appSettings: action.result,
      };
    case FETCH_APP_SETTINGS_FAIL:
      return {
        ...state,
        isLoading: false,
        appSettings: [],
      };
    case SAVE_APP_SETTINGS:
      return {
        ...state,
        isLoading: true,
      };
    case SAVE_APP_SETTINGS_SUCCESS:
    case SAVE_APP_SETTINGS_FAIL:
      return {
        ...state,
        isLoading: false,
      };
    default:
      return state;
  }
};

export const fetchAppSettings = () => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_APP_SETTINGS });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/appSettings',
  });

  if (error) {
    dispatch({ type: FETCH_APP_SETTINGS_FAIL, error });
    return;
  }

  dispatch({ type: FETCH_APP_SETTINGS_SUCCESS, result: data });
};

export const updateAppSettings = settings => async (makeRequest, dispatch) => {
  dispatch({ type: SAVE_APP_SETTINGS });

  const { error } = await makeRequest({
    method: 'PATCH',
    url: '/appSettings',
    payload: { settings },
  });

  if (error) {
    dispatch({ type: SAVE_APP_SETTINGS_FAIL, error });
    return;
  }

  dispatch({ type: SAVE_APP_SETTINGS_SUCCESS, result: error });
};
