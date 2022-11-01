/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getNumBathroomRange, getAreaRange } from '../../helpers/rangeFiltersFormat';

const LOAD_LAYOUTS = 'reva/LOAD_LAYOUTS';
const LOAD_LAYOUTS_SUCCESS = 'reva/LOAD_LAYOUTS_SUCCESS';
const LOAD_LAYOUTS_FAIL = 'reva/LOAD_LAYOUTS_FAIL';

const initialState = {
  loadingLayouts: false,
  numBathroomsRange: [],
  squareFeetRange: [],
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_LAYOUTS:
      return {
        ...state,
        loadingLayouts: true,
      };
    case LOAD_LAYOUTS_SUCCESS: {
      const f = xs => xs.map(x => ({ selected: false, value: x }));
      const numBathroomsRange = f(getNumBathroomRange(action.result));
      const squareFeetRange = getAreaRange(action.result);

      return {
        loadingLayouts: false,
        numBathroomsRange,
        squareFeetRange,
      };
    }
    case LOAD_LAYOUTS_FAIL:
      return {
        ...state,
        loadingLayouts: false,
      };
    default:
      return state;
  }
}

export function loadLayouts() {
  return {
    types: [LOAD_LAYOUTS, LOAD_LAYOUTS_SUCCESS, LOAD_LAYOUTS_FAIL],
    promise: client => client.get('/layouts'),
  };
}
