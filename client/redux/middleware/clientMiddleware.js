/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const clientMiddleware = client => ({ getState }) => next => action => {
  const { promise, types, uiActions, formatter, ...rest } = action;
  if (!promise) {
    return next(action);
  }
  const [REQUEST, SUCCESS, FAILURE] = types;
  const [UI_REQUEST, UI_SUCCESS, UI_FAILURE] = uiActions || [];
  next({
    ...rest,
    type: REQUEST,
  });
  if (UI_REQUEST) {
    next({
      ...rest,
      type: UI_REQUEST,
    });
  }

  const p = promise(client, getState);
  p.then(
    result => {
      const prevState = getState();
      const resultForDataStore = formatter ? formatter(result, prevState) : result;
      let nextResult = next({
        ...rest,
        result: resultForDataStore,
        type: SUCCESS,
      });
      if (UI_SUCCESS) {
        nextResult = next({
          ...rest,
          result,
          type: UI_SUCCESS,
        });
      }
      return nextResult;
    },
    error => {
      next({ ...rest, error, type: FAILURE });
      if (UI_FAILURE) {
        next({ ...rest, error, type: UI_FAILURE });
      }
    },
  ).catch(error => {
    console.error('MIDDLEWARE ERROR:', error.message, error.stack);
    next({
      ...rest,
      error,
      type: FAILURE,
    });
  });
  return p;
};
