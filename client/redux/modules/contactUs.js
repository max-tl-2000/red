/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const SEND_CONTACT_US_DATA = 'reva/SEND_CONTACT_US_DATA';
const SEND_CONTACT_US_DATA_SUCCESS = 'reva/SEND_CONTACT_US_DATA_SUCCESS';
const SEND_CONTACT_US_DATA_FAIL = 'reva/SEND_CONTACT_US_DATA_FAIL';

export default (state = {}, action = {}) => {
  switch (action.type) {
    case SEND_CONTACT_US_DATA:
      return {};
    case SEND_CONTACT_US_DATA_SUCCESS:
      return { success: true };
    case SEND_CONTACT_US_DATA_FAIL:
      return { error: action.error.token };
    default:
      return state;
  }
};

export const sendContactUsData = (values, query = {}) => {
  const { token, teamEmail, ...restOfQuery } = query;

  if (!token) throw new Error('Missing token parameter');
  if (!teamEmail) throw new Error('Missing teamEmail parameter');

  return {
    types: [SEND_CONTACT_US_DATA, SEND_CONTACT_US_DATA_SUCCESS, SEND_CONTACT_US_DATA_FAIL],
    promise: client => client.post('/contactUs', { headers: { Authorization: `Bearer ${token}` }, data: { ...values, teamEmail, ...restOfQuery } }),
  };
};
