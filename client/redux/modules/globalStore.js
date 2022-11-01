/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';

export const RESET_GLOBAL_DATA = 'reva/RESET_GLOBAL_DATA';
const LOAD_GLOBAL_DATA = 'reva/LOAD_GLOBAL_DATA';
export const LOAD_GLOBAL_DATA_SUCCESS = 'reva/LOAD_GLOBAL_DATA_SUCCESS';
export const USERS_UPDATED = 'reva/USERS_UPDATED';
export const USERS_AVAILABILITY_CHANGED = 'reva/USERS_AVAILABILITY_CHANGED';
export const USERS_SANDBOX_AVAILABILITY_CHANGED = 'reva/USERS_SANDBOX_AVAILABILITY_CHANGED';

const LOAD_GLOBAL_DATA_FAILED = 'reva/LOAD_GLOBAL_DATA_FAILED';

const initialState = new Immutable.Map({
  users: new Immutable.Map({}),
  teams: new Immutable.Map({}),
  properties: [],
  propertiesByTeams: new Immutable.Map({}),
  globalDataIsLoading: false,
  globalDataLoaded: false,
});

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_GLOBAL_DATA: {
      return state.set('globalDataIsLoading', true);
    }
    case LOAD_GLOBAL_DATA_SUCCESS: {
      return state
        .set('globalDataLoaded', true)
        .set('globalDataIsLoading', false)
        .set('users', new Immutable.Map(action.result.users))
        .set('teams', new Immutable.Map(action.result.teams))
        .set('properties', action.result.properties)
        .set('propertiesByTeams', new Immutable.Map(action.result.propertiesByTeams));
    }
    case USERS_UPDATED: {
      return state.set('users', state.get('users').mergeDeep(new Immutable.Map(action.result.users)));
    }
    case USERS_AVAILABILITY_CHANGED: {
      const users = state.get('users');

      if (!users) return state;

      const userIds = new Set(action.result.userIds);
      const updatedUsers = users.map(user => {
        if (!userIds.has(user.id)) return user;
        return {
          ...user,
          metadata: {
            ...user.metadata,
            status: action.result.status,
            statusUpdatedAt: action.result.statusUpdatedAt,
          },
        };
      });

      return state.set('users', updatedUsers);
    }
    case USERS_SANDBOX_AVAILABILITY_CHANGED: {
      const users = state.get('users');

      if (!users) return state;

      const userIds = new Set(action.result.userIds);
      const updatedUsers = users.map(user => {
        if (!userIds.has(user.id)) return user;
        return {
          ...user,
          metadata: {
            ...user.metadata,
            sandboxTenant: action.result.sandboxTenant,
            sandboxAvailable: action.result.sandboxAvailable,
          },
        };
      });

      return state.set('users', updatedUsers);
    }
    case LOAD_GLOBAL_DATA_FAILED:
    case RESET_GLOBAL_DATA:
      return initialState;
    default:
      return state;
  }
}

export const loadGlobalData = () => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_GLOBAL_DATA });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/globalData',
  });

  if (error) {
    dispatch({ type: LOAD_GLOBAL_DATA_FAILED, error });
    return;
  }
  dispatch({ type: LOAD_GLOBAL_DATA_SUCCESS, result: data });
};
