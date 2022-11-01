/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import notifier from 'helpers/notifier/notifier';
import { toMoment } from '../../../common/helpers/moment-utils';

const LOADING_SICK_LEAVES = 'sickLeaves/LOADING_SICK_LEAVES';
const LOADED_SICK_LEAVES = 'sickLeaves/LOADED_SICK_LEAVES';
const SAVE_SICK_LEAVE = 'sickLeaves/SAVE_SICK_LEAVE';
const SAVE_SICK_LEAVE_FAIL = 'sickLeaves/SAVE_SICK_LEAVE_FAIL';
const SAVE_SICK_LEAVE_SUCCESS = 'sickLeaves/SAVE_SICK_LEAVE_SUCCESS';
const REMOVE_SICK_LEAVE = 'sickLeaves/REMOVE_SICK_LEAVE';
const REMOVE_SICK_LEAVE_FAIL = 'sickLeaves/REMOVE_SICK_LEAVE_FAIL';
const REMOVE_SICK_LEAVE_SUCCESS = 'sickLeaves/REMOVE_SICK_LEAVE_SUCCESS';
const CLEAR_ERROR = 'sickLeaves/CLEAR_ERROR';
const CLEAR_NEW_CONFLICTS = 'sickLeaves/CLEAR_NEW_CONFLICTS';
const CLEAR_SICK_LEAVES = 'sickLeaves/CLEAR_SICK_LEAVES';

const initialState = {
  sickLeaves: [],
  newSickLeaves: [],
  newConflicts: [],
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOADING_SICK_LEAVES: {
      return {
        ...state,
        loading: true,
      };
    }
    case LOADED_SICK_LEAVES: {
      return {
        sickLeaves: action.result.sickLeaves,
        loading: false,
      };
    }
    case SAVE_SICK_LEAVE:
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    case REMOVE_SICK_LEAVE:
      return {
        ...state,
        isDeleting: true,
        error: null,
      };
    case SAVE_SICK_LEAVE_SUCCESS: {
      const newConflicts = action.result.newSickLeaves.reduce((acc, sickLeave) => [...acc, ...sickLeave.conflictEvents], []);
      const sickLeaves = [...state.sickLeaves, ...action.result.newSickLeaves].sort((x, y) => toMoment(x.startDate).diff(toMoment(y.startDate)));
      return {
        ...state,
        isSaving: false,
        error: null,
        sickLeaves,
        newSickLeaves: action.result.newSickLeaves,
        newConflicts,
      };
    }
    case SAVE_SICK_LEAVE_FAIL:
      return {
        ...state,
        isSaving: false,
        saveSickLeaveError: action.error.token,
      };
    case REMOVE_SICK_LEAVE_FAIL:
      return {
        ...state,
        isDeleting: false,
        removeSickLeaveError: action.error.token,
      };
    case REMOVE_SICK_LEAVE_SUCCESS: {
      const removedSickLeave = action.result.removedSickLeave;
      const sickLeaves = state.sickLeaves.filter(sickLeave => sickLeave.id !== removedSickLeave.id);
      return {
        ...state,
        sickLeaves,
        isDeleting: false,
        error: null,
        removedSickLeave,
      };
    }
    case CLEAR_ERROR:
      return {
        ...state,
        removeSickLeaveError: null,
        saveSickLeaveError: null,
      };
    case CLEAR_NEW_CONFLICTS:
      return {
        ...state,
        newConflicts: [],
      };
    case CLEAR_SICK_LEAVES:
      return {
        ...state,
        sickLeaves: [],
      };
    default:
      return state;
  }
}

const load = async (userId, timezone, makeRequest) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/sickLeaves/user/${userId}?timezone=${timezone}`,
  });

  if (error) {
    console.error('Failed to sick leaves agent', error);
    notifier.error(t('LOAD_SICK_LEAVES_ERROR'));
    return { sickLeaves: [] };
  }

  return { sickLeaves: data };
};

export const loadSickLeaves = (userId, timezone) => async (makeRequest, dispatch) => {
  dispatch({ type: LOADING_SICK_LEAVES });

  const data = await load(userId, timezone, makeRequest);

  dispatch({ type: LOADED_SICK_LEAVES, result: data });
};

export const addSickLeave = sickLeave => async (makeRequest, dispatch) => {
  dispatch({ type: SAVE_SICK_LEAVE });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/sickLeaves',
    payload: sickLeave,
  });

  if (error) {
    dispatch({ type: SAVE_SICK_LEAVE_FAIL, error });
    return;
  }

  dispatch({ type: SAVE_SICK_LEAVE_SUCCESS, result: { newSickLeaves: data } });
};

export const removeSickLeave = sickLeaveId => async (makeRequest, dispatch) => {
  dispatch({ type: REMOVE_SICK_LEAVE });

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/sickLeaves/${sickLeaveId}`,
  });

  if (error) {
    dispatch({ type: REMOVE_SICK_LEAVE_FAIL, error });
    return;
  }

  dispatch({ type: REMOVE_SICK_LEAVE_SUCCESS, result: { removedSickLeave: data } });
};

export const clearError = () => async (makeRequest, dispatch) => {
  dispatch({ type: CLEAR_ERROR });
};

export const clearNewConflicts = () => async (makeRequest, dispatch) => {
  dispatch({ type: CLEAR_NEW_CONFLICTS });
};

export const clearSickLeaves = () => async (makeRequest, dispatch) => {
  dispatch({ type: CLEAR_SICK_LEAVES });
};
