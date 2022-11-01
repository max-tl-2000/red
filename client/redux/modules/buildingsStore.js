/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const LOAD_BUILDINGS = 'reva/LOAD_BUILDINGS';
const LOAD_BUILDINGS_SUCCESS = 'reva/LOAD_BUILDINGS_SUCCESS';
const LOAD_BUILDINGS_FAIL = 'reva/LOAD_BUILDINGS_FAIL';

const initialState = {
  buildings: [],
  loadingBuildings: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_BUILDINGS:
      return {
        ...state,
        buildings: [],
        loadingBuildings: true,
      };
    case LOAD_BUILDINGS_SUCCESS:
      return {
        ...state,
        buildings: action.result,
        loadingBuildings: false,
      };
    case LOAD_BUILDINGS_FAIL:
      return {
        ...state,
        loadingBuildings: false,
      };
    default:
      return state;
  }
}

export function loadBuildings() {
  return {
    types: [LOAD_BUILDINGS, LOAD_BUILDINGS_SUCCESS, LOAD_BUILDINGS_FAIL],
    promise: client => client.get('/buildings'),
  };
}
