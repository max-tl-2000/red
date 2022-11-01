/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const VALIDATE_RESET_TOKEN = 'reva/VALIDATE_RESET_TOKEN';
const VALIDATE_RESET_TOKEN_SUCCESS = 'reva/VALIDATE_RESET_TOKEN_SUCCESS';
const VALIDATE_RESET_TOKEN_FAIL = 'reva/VALIDATE_RESET_TOKEN_FAIL';

const initialState = {};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case VALIDATE_RESET_TOKEN:
      return {
        ...state,
        userData: null,
        validateTokenError: null,
      };
    case VALIDATE_RESET_TOKEN_SUCCESS: {
      const { user } = action.result;
      return {
        ...state,
        userData: user,
      };
    }
    case VALIDATE_RESET_TOKEN_FAIL: {
      const { token, data } = action.error;
      return {
        ...state,
        validateTokenError: token,
        userData: data,
      };
    }
    default:
      return state;
  }
}

export function validateResetToken(token) {
  return {
    types: [VALIDATE_RESET_TOKEN, VALIDATE_RESET_TOKEN_SUCCESS, VALIDATE_RESET_TOKEN_FAIL],
    promise: client => {
      const p = client.post('/validateResetToken', { data: { token } });
      p.catch(e => (e.__handled = true));
      return p;
    },
  };
}
