/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const FETCH_SUBSCRIPTIONS = 'reva/FETCH_SUBSCRIPTIONS';
const FETCH_SUBSCRIPTIONS_SUCCESS = 'reva/FETCH_SUBSCRIPTIONSS_SUCCESS';
const FETCH_SUBSCRIPTIONS_FAIL = 'reva/FETCH_SUBSCRIPTIONSS_FAIL';
const SAVE_SUBSCRIPTIONS = 'reva/SAVE_SUBSCRIPTIONS';
const SAVE_SUBSCRIPTIONS_SUCCESS = 'reva/SAVE_SUBSCRIPTIONS_SUCCESS';
const SAVE_SUBSCRIPTIONS_FAIL = 'reva/SAVE_SUBSCRIPTIONS_FAIL';
const DELETE_SUBSCRIPTIONS = 'reva/DELETE_SUBSCRIPTIONS';
const DELETE_SUBSCRIPTIONS_SUCCESS = 'reva/DELETE_SUBSCRIPTIONS_SUCCESS';
const DELETE_SUBSCRIPTIONS_FAIL = 'reva/DELETE_SUBSCRIPTIONS_FAIL';
const ADD_SUBSCRIPTIONS = 'reva/ADD_SUBSCRIPTIONS';
const ADD_SUBSCRIPTIONS_SUCCESS = 'reva/ADD_SUBSCRIPTIONS_SUCCESS';
const ADD_SUBSCRIPTIONS_FAIL = 'reva/ADD_SUBSCRIPTIONS_FAIL';

const initialState = { isLoading: false };

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case FETCH_SUBSCRIPTIONS:
      return {
        ...state,
        isLoading: true,
        subscriptions: [],
      };
    case FETCH_SUBSCRIPTIONS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        subscriptions: action.result,
      };
    case FETCH_SUBSCRIPTIONS_FAIL:
      return {
        ...state,
        isLoading: false,
        subscriptions: [],
      };
    case SAVE_SUBSCRIPTIONS:
    case DELETE_SUBSCRIPTIONS:
    case ADD_SUBSCRIPTIONS:
      return {
        ...state,
        isLoading: true,
      };
    case ADD_SUBSCRIPTIONS_SUCCESS:
    case SAVE_SUBSCRIPTIONS_SUCCESS:
    case DELETE_SUBSCRIPTIONS_SUCCESS:
      return {
        ...state,
        isLoading: false,
      };
    case SAVE_SUBSCRIPTIONS_FAIL:
    case DELETE_SUBSCRIPTIONS_FAIL:
    case ADD_SUBSCRIPTIONS_FAIL:
      return {
        ...state,
        isLoading: false,
      };
    default:
      return state;
  }
};

export const fetchSubscriptions = () => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_SUBSCRIPTIONS });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/subscriptions',
  });

  if (error) {
    dispatch({ type: FETCH_SUBSCRIPTIONS_FAIL, error });
    return;
  }

  dispatch({ type: FETCH_SUBSCRIPTIONS_SUCCESS, result: data });
};

export const updateSubscriptions = subscriptions => async (makeRequest, dispatch) => {
  dispatch({ type: SAVE_SUBSCRIPTIONS });

  const { error } = await makeRequest({
    method: 'PATCH',
    url: '/subscriptions',
    payload: { subscriptions },
  });

  if (error) {
    dispatch({ type: SAVE_SUBSCRIPTIONS_FAIL, error });
    return;
  }

  dispatch({ type: SAVE_SUBSCRIPTIONS_SUCCESS, result: error });
};

export const deleteSubscriptions = subscriptionsToDelete => async (makeRequest, dispatch) => {
  dispatch({ type: DELETE_SUBSCRIPTIONS });

  const { error } = await makeRequest({
    method: 'DEL',
    url: '/subscriptions',
    payload: { subscriptionsToDelete },
  });

  if (error) {
    dispatch({ type: DELETE_SUBSCRIPTIONS_FAIL, error });
    return;
  }

  dispatch({ type: DELETE_SUBSCRIPTIONS_SUCCESS, result: error });
};

export const addSubscriptions = subscriptionsToInsert => async (makeRequest, dispatch) => {
  dispatch({ type: ADD_SUBSCRIPTIONS });

  const { error } = await makeRequest({
    method: 'POST',
    url: '/subscriptions',
    payload: { subscriptionsToInsert },
  });

  if (error) {
    dispatch({ type: ADD_SUBSCRIPTIONS_FAIL, error });
    return;
  }

  dispatch({ type: ADD_SUBSCRIPTIONS_SUCCESS, result: error });
};
