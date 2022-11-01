/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const FETCH_ACTIVITYLOGS = 'activityLog/fetch-activityLogs';
const FETCH_ACTIVITYLOGS_SUCCESS = 'activityLog/fetch-activityLogs-success';
const FETCH_ACTIVITYLOGS_FAILURE = 'activityLog/fetch-activityLogs-failure';
const CLEAR_ACTIVITYLOGS = 'activityLog/clear-activityLogs';
const OPEN_MANUAL_ACTIVITY_LOG_DIALOG = 'activityLog/OPEN_ADMIN_TASK_DIALOG';
const CLOSE_MANUAL_ACTIVITY_LOG_DIALOG = 'activityLog/CLOSE_ADMIN_TASK_DIALOG';
const ADD_MANUAL_ACTIVITY_LOG_SUCCESS = 'activityLog/ADD_MANUAL_ACTIVITY_LOG_SUCCESS';
const ADD_MANUAL_ACTIVITY_LOG_FAIL = 'activityLog/ADD_MANUAL_ACTIVITY_LOG_FAIL';

import concat from 'lodash/concat';
import { formatActivityLogs } from '../../helpers/activityLogs/activityLogFormatter';
import { findLocalTimezone } from '../../../common/helpers/moment-utils';

const INITIAL_STATE = {
  activityLogs: [],
  showManualActivityLogDialog: false,
};

export default function reducer(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case FETCH_ACTIVITYLOGS:
      return {
        ...state,
        loading: true,
      };
    case FETCH_ACTIVITYLOGS_SUCCESS: {
      const result = formatActivityLogs(action.result, action.timezone);
      return {
        ...state,
        loading: false,
        partyId: action.partyId,
        activityLogs: result,
      };
    }
    case FETCH_ACTIVITYLOGS_FAILURE:
      return {
        ...state,
        partyId: '',
        activityLogs: [],
        loading: false,
        error: action.error,
      };
    case CLEAR_ACTIVITYLOGS:
      return {
        ...state,
        partyId: '',
        activityLogs: [],
      };
    case OPEN_MANUAL_ACTIVITY_LOG_DIALOG:
      return {
        ...state,
        showManualActivityLogDialog: true,
      };
    case CLOSE_MANUAL_ACTIVITY_LOG_DIALOG:
      return {
        ...state,
        showManualActivityLogDialog: false,
      };
    case ADD_MANUAL_ACTIVITY_LOG_SUCCESS: {
      const result = formatActivityLogs([action.result], action.timezone);
      return {
        ...state,
        activityLogs: concat(result, state.activityLogs),
        showManualActivityLogDialog: false,
      };
    }
    case ADD_MANUAL_ACTIVITY_LOG_FAIL:
      return {
        ...state,
        showManualActivityLogDialog: false,
        error: action.error,
      };
    default:
      return state;
  }
}

export const fetchLogsByPartyId = (partyId, timezone = findLocalTimezone()) => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_ACTIVITYLOGS });
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/activityLogs?partyId=${partyId}`,
  });

  if (error) {
    dispatch({ type: FETCH_ACTIVITYLOGS_FAILURE, error });
    return;
  }

  dispatch({ type: FETCH_ACTIVITYLOGS_SUCCESS, partyId, timezone, result: data });
};

export const fetchAllLogs = () => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_ACTIVITYLOGS });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/activityLogs',
  });

  if (error) {
    dispatch({ type: FETCH_ACTIVITYLOGS_FAILURE, error });
    return;
  }

  dispatch({ type: FETCH_ACTIVITYLOGS_SUCCESS, result: data });
};

export function clearActivityLogs() {
  return {
    type: CLEAR_ACTIVITYLOGS,
  };
}

export const openManualActivityLogDialog = () => ({ type: OPEN_MANUAL_ACTIVITY_LOG_DIALOG });

export const closeManualActivityLogDialog = () => ({ type: CLOSE_MANUAL_ACTIVITY_LOG_DIALOG });

export const addActivityLog = (entity, activityType) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/activityLog',
    payload: { entity, activityType },
  });

  if (error) {
    dispatch({ type: ADD_MANUAL_ACTIVITY_LOG_FAIL, error });
    return;
  }
  dispatch({ type: ADD_MANUAL_ACTIVITY_LOG_SUCCESS, result: data });
};
