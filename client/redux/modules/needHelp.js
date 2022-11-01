/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const RESET_PASSWORD_EMAIL = 'reva/RESET_PASSWORD_EMAIL';
const RESET_PASSWORD_EMAIL_SUCCESS = 'reva/RESET_PASSWORD_EMAIL_SUCCESS';
const RESET_PASSWORD_EMAIL_FAIL = 'reva/RESET_PASSWORD_EMAIL_FAIL';
const RESET_STATE = 'reva/RESET_STATE';

const initialState = {
  resetPasswordSuccess: null,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case RESET_PASSWORD_EMAIL:
      return {
        ...state,
        reseting: true,
        resetPasswordSuccess: false,
      };
    case RESET_PASSWORD_EMAIL_SUCCESS:
      return {
        ...state,
        reseting: false,
        resetPasswordSuccess: true,
        resetPasswordError: null,
      };
    case RESET_PASSWORD_EMAIL_FAIL:
      return {
        ...state,
        reseting: false,
        resetPasswordSuccess: null,
        resetPasswordError: action.error.token,
      };
    case RESET_STATE:
      return initialState;
    default:
      return state;
  }
}

export function sendResetPasswordMail(email) {
  return {
    types: [RESET_PASSWORD_EMAIL, RESET_PASSWORD_EMAIL_SUCCESS, RESET_PASSWORD_EMAIL_FAIL],
    promise: client =>
      client.post('/sendResetPasswordMail', {
        data: {
          email,
        },
      }),
  };
}

export const resetState = () => ({ type: RESET_STATE });
