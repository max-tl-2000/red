/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { MERGE_DIALOG_OPENED_FROM_TYPE } from '../../helpers/party';

const FETCH_MERGE_PARTIES_DATA = 'reva/FETCH_MERGE_PARTIES_DATA';
const FETCH_MERGE_PARTIES_DATA_SUCCESS = 'reva/FETCH_MERGE_PARTIES_DATA_SUCCESS';
const FETCH_MERGE_PARTIES_DATA_FAIL = 'reva/FETCH_MERGE_PARTIES_DATA_FAIL';
const CLEAR_MERGE_PARTIES_DATA = 'reva/CLEAR_MERGE_PARTIES_DATA';
const CLEAR_APPOINTMENTS_ERROR = 'reva/CLEAR_APPOINTMENTS_ERROR';
const FETCH_MERGE_SESSION_SUCCESS = 'reva/FETCH_MERGE_SESSION_SUCCESS';
const FETCH_MERGE_SESSION_FAIL = 'reva/FETCH_MERGE_SESSION_FAIL';
const RESET_SESSION = 'reva/RESET_SESSION';
const OPEN_MERGE_FLYOUT = 'reva/OPEN_MERGE_FLYOUT';
const CLOSE_MERGE_FLYOUT = 'reva/CLOSE_MERGE_FLYOUT';
const MERGE_PARTIES = 'reva/MERGE_PARTIES';
const MERGE_PARTIES_SUCCESS = 'reva/MERGE_PARTIES_SUCCESS';
const MERGE_PARTIES_FAIL = 'reva/MERGE_PARTIES_FAIL';
const MERGE_PARTIES_APPOINTMENTS_CONFLICT = 'reva/MERGE_PARTIES_APPOINTMENTS_CONFLICT';
const DO_NOT_MERGE_PARTY = 'reva/DO_NOT_MERGE_PARTY';

const initialState = {
  isLoading: false,
  isFlyoutOpen: false,
  mergeContext: null,
  mergePartiesData: {},
  mergeResult: {},
  sessionId: null,
  error: null,
  openedFrom: null,
};

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case FETCH_MERGE_PARTIES_DATA:
    case MERGE_PARTIES: {
      const { mergeResult, error, appointmentsConflictData, ...rest } = state;
      return {
        ...rest,
        isLoading: true,
      };
    }
    case FETCH_MERGE_PARTIES_DATA_SUCCESS:
      return {
        ...state,
        isLoading: false,
        mergePartiesData: action.result.data,
      };
    case MERGE_PARTIES_SUCCESS:
      return {
        ...state,
        isLoading: false,
        mergeResult: action.result.data,
        openedFrom: action.result.openedFrom,
      };
    case FETCH_MERGE_PARTIES_DATA_FAIL:
    case MERGE_PARTIES_FAIL:
    case FETCH_MERGE_SESSION_FAIL:
      return {
        ...state,
        error: action.error.token,
      };
    case MERGE_PARTIES_APPOINTMENTS_CONFLICT:
      return {
        ...state,
        appointmentsConflictData: action.appointmentsConflictData,
      };
    case CLEAR_MERGE_PARTIES_DATA:
      return {
        ...state,
        mergePartiesData: {},
      };
    case CLEAR_APPOINTMENTS_ERROR: {
      const { appointmentsConflictData, isLoading, ...newState } = state;
      return newState;
    }
    case FETCH_MERGE_SESSION_SUCCESS:
      return {
        ...state,
        sessionId: action.result.data.id,
        openedFrom: action.result.openedFrom,
      };
    case RESET_SESSION:
      return {
        ...initialState,
      };
    case OPEN_MERGE_FLYOUT:
      return {
        ...initialState,
        isFlyoutOpen: true,
        isLoading: true,
      };
    case CLOSE_MERGE_FLYOUT:
      return {
        ...state,
        isFlyoutOpen: false,
      };
    case DO_NOT_MERGE_PARTY:
      return {
        ...state,
        openedFrom: action.openedFrom,
      };
    default:
      return state;
  }
};

export const fetchPartyMatch = sessionId => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_MERGE_PARTIES_DATA });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/mergePartySessions/${sessionId}/matches`,
  });

  if (error) {
    dispatch({ type: FETCH_MERGE_PARTIES_DATA_FAIL, error });
    return;
  }

  dispatch({ type: FETCH_MERGE_PARTIES_DATA_SUCCESS, result: { data } });
};

export const doNotMerge = (sessionId, matchId, openedFrom) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/mergePartySessions/${sessionId}/matches/${matchId}/resolve`,
    payload: { response: DALTypes.MergePartyResponse.DONT_MERGE },
  });
  dispatch({ type: DO_NOT_MERGE_PARTY, openedFrom });
  return { data, error };
};

export const merge = ({ sessionId, matchId, partyOwnerId, ownerTeamId, shouldCheckConflictingAppointments, chosenProperty, openedFrom }) => async (
  makeRequest,
  dispatch,
) => {
  dispatch({ type: MERGE_PARTIES });

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/mergePartySessions/${sessionId}/matches/${matchId}/resolve`,
    payload: { response: DALTypes.MergePartyResponse.MERGE, partyOwnerId, ownerTeamId, shouldCheckConflictingAppointments, chosenProperty },
  });

  if (error) {
    if (error.token === 'APPOINTMENTS_CONFLICT') {
      error.__handled = true; // avoid the generic error snackbar message
      dispatch({
        type: MERGE_PARTIES_APPOINTMENTS_CONFLICT,
        appointmentsConflictData: { appointments: error?.data?.appointments },
      });
    } else dispatch({ type: MERGE_PARTIES_FAIL, error });

    return false;
  }

  dispatch({ type: MERGE_PARTIES_SUCCESS, result: { data, openedFrom } });
  return true;
};

export const clearAppointmentsError = () => ({ type: CLEAR_APPOINTMENTS_ERROR });

export const clearMergePartiesData = () => ({ type: CLEAR_MERGE_PARTIES_DATA });
export const clearSession = () => ({ type: RESET_SESSION });

export const openMergePartyFlyout = mergeContext => async (makeRequest, dispatch) => {
  let { openedFrom } = mergeContext;
  dispatch({ type: OPEN_MERGE_FLYOUT });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/mergePartySessions',
    payload: { ...mergeContext },
  });
  if (error) {
    dispatch({ type: FETCH_MERGE_SESSION_FAIL, error });
    return;
  }
  if (mergeContext.mergeContext === DALTypes.MergePartyContext.PERSON) {
    openedFrom = MERGE_DIALOG_OPENED_FROM_TYPE.FROM_MERGE_PERSON;
  }

  dispatch({ type: FETCH_MERGE_SESSION_SUCCESS, result: { data, openedFrom } });

  const { id: sessionId } = data;
  await fetchPartyMatch(sessionId)(makeRequest, dispatch);
};

export const closeMergePartyFlyout = () => ({ type: CLOSE_MERGE_FLYOUT });
