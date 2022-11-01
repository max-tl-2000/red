/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const LOAD_NAVIGATION_STARTED = 'reva/LOAD_NAVIGATION_HISTORY_STARTED';
const LOAD_NAVIGATION_HISTORY_SUCCESS = 'reva/LOAD_NAVIGATION_HISTORY_SUCCESS';
const LOAD_NAVIGATION_HISTORY_FAIL = 'reva/LOAD_NAVIGATION_HISTORY_FAIL';
const RESET_NAVIGATION_HISTORY = 'reva/RESET_NAVIGATION_HISTORY';

const initialState = {
  navigationHistory: [],
  error: null,
  isLoading: true,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_NAVIGATION_STARTED: {
      return {
        ...state,
        navigationHistory: [],
        isLoading: true,
      };
    }
    case LOAD_NAVIGATION_HISTORY_SUCCESS: {
      return {
        ...state,
        navigationHistory: action.result,
        isLoading: false,
      };
    }
    case LOAD_NAVIGATION_HISTORY_FAIL: {
      return {
        ...state,
        isLoading: false,
        error: action.error.token,
      };
    }
    case RESET_NAVIGATION_HISTORY: {
      return {
        ...state,
        navigationHistory: [],
        isLoading: true,
      };
    }
    default:
      return state;
  }
}

export const loadNavigationHistory = () => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_NAVIGATION_STARTED });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/navigationHistory',
  });

  if (error) {
    dispatch({ type: LOAD_NAVIGATION_HISTORY_FAIL, error });
    return;
  }

  dispatch({ type: LOAD_NAVIGATION_HISTORY_SUCCESS, result: data });
};

export const saveNavigationHistory = pageInfo => async makeRequest => {
  const { error } = await makeRequest({
    method: 'POST',
    url: '/navigationHistory',
    payload: pageInfo,
  });

  if (error) {
    console.warn('failure to save navigation history');
    error.__handled = true;
  }
};

export const resetNavigationHistory = () => (makeRequest, dispatch) => dispatch({ type: RESET_NAVIGATION_HISTORY });
