/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { widelyAvailableFlyouts } from 'helpers/comm-flyout-types';

const UPDATE_FLYOUT = 'reva/UPDATE_FLYOUT';
const OPEN_FLYOUT = 'reva/OPEN_FLYOUT';
const CLOSE_FLYOUT = 'reva/CLOSE_FLYOUT';
const CLOSE_ALL_OPENED_FLYOUTS = 'reva/CLOSE_ALL_OPENED_FLYOUTS';
const CLOSE_NON_WIDELY_AVAILABLE_FLYOUTS = 'reva/CLOSE_NON_WIDELY_AVAILABLE_FLYOUTS';

const initialState = {
  openedFlyouts: {},
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case OPEN_FLYOUT:
      return {
        ...state,
        openedFlyouts: {
          ...state.openedFlyouts,
          [action.data.flyoutId]: action.data,
        },
      };
    case UPDATE_FLYOUT: {
      // Fix for an error preventing opening a prospect page
      // when this error happens the user has to reload the app
      // in order to be able to enter the prospect page as shown here:
      // https://fsty.io/v/fXBM4tk
      const openedFlyOuts = state.openedFlyouts || {};
      const data = action.data || {};

      if (!openedFlyOuts[data.flyoutId]) return state;

      return {
        ...state,
        openedFlyouts: {
          ...openedFlyOuts,
          [data.flyoutId]: {
            ...openedFlyOuts[data.flyoutId],
            flyoutProps: {
              ...(openedFlyOuts[data.flyoutId] || {}).flyoutProps,
              ...action.data,
            },
          },
        },
      };
    }
    case CLOSE_FLYOUT:
      return {
        ...state,
        openedFlyouts: Object.keys(state.openedFlyouts).reduce((acc, key) => {
          if (key !== action.flyoutId) {
            acc[key] = state.openedFlyouts[key];
          }
          return acc;
        }, {}),
      };

    case CLOSE_NON_WIDELY_AVAILABLE_FLYOUTS:
      return {
        ...state,
        openedFlyouts: Object.keys(state.openedFlyouts).reduce((acc, key) => {
          if (widelyAvailableFlyouts.has(state.openedFlyouts[key].flyoutType)) {
            acc[key] = state.openedFlyouts[key];
          }
          return acc;
        }, {}),
      };
    case CLOSE_ALL_OPENED_FLYOUTS:
      return initialState;

    default:
      return state;
  }
}

export const openFlyout = (flyoutType, props) => ({
  type: OPEN_FLYOUT,
  data: {
    flyoutId: (props && props.flyoutId) || newUUID(),
    flyoutProps: props,
    flyoutType,
  },
});

export const updateFlyout = (flyoutId, props) => ({
  type: UPDATE_FLYOUT,
  data: {
    flyoutId,
    ...props,
  },
});

export const closeFlyout = flyoutId => ({ type: CLOSE_FLYOUT, flyoutId });

export const clear = () => ({ type: CLOSE_ALL_OPENED_FLYOUTS });

export const closeNonWidelyAvailableFlyouts = () => ({
  type: CLOSE_NON_WIDELY_AVAILABLE_FLYOUTS,
});
