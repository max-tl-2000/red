/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const OPEN_FORBIDDEN_DIALOG = 'reva/OPEN_FORBIDDEN_DIALOG';
const CLOSE_FORBIDDEN_DIALOG = 'reva/CLOSE_FORBIDDEN_DIALOG';

const initialState = {
  isOpened: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case OPEN_FORBIDDEN_DIALOG:
      return {
        ...state,
        isOpened: true,
      };
    case CLOSE_FORBIDDEN_DIALOG:
      return {
        ...state,
        isOpened: false,
      };
    default:
      return state;
  }
}

export const openForbiddenDialog = () => (makeRequest, dispatch) => {
  dispatch({ type: OPEN_FORBIDDEN_DIALOG });
};

export const closeForbiddenDialog = () => (makeRequest, dispatch) => {
  dispatch({ type: CLOSE_FORBIDDEN_DIALOG });
};
