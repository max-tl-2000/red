/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const requestFactory = (dispatch, getState, client) => async ({ method, url, payload, params, extraHeaders, authToken } = {}) => {
  let headers = extraHeaders || {};

  if (authToken) {
    headers = {
      ...headers,
      Authorization: `Bearer ${authToken}`,
    };
  }

  let res;
  try {
    const send = client[method.toLowerCase()];
    const data = await send(url, { headers, data: payload, params });
    res = { data };
  } catch (error) {
    res = { error };
  }
  return res;
};
