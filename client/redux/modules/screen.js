/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const SCREEN_CHANGE = 'device/SCREEN_CHANGE';

const initialState = {
  size: '',
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case SCREEN_CHANGE:
      return {
        ...state,
        size: action.size,
      };
    default:
      return state;
  }
}

export function updateScreenSize(size) {
  return {
    type: SCREEN_CHANGE,
    size,
  };
}
