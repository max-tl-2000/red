/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEqual from 'lodash/isEqual';
import { refreshInactiveCallFlyouts, reloadCallAssociatedParty } from './telephony';
import { now } from '../../../common/helpers/moment-utils';
import * as dataStoreActions from './dataStore';
import { LOAD_DASHBOARD, LOAD_DASHBOARD_SUCCESS, LOAD_DASHBOARD_FAILED, REFRESH_NEEDED } from './dashboardStore';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { isAgent } from '../../../common/acd/roles';

const {
  LOAD_DATA,
  LOAD_DATA_SUCCESS,
  LOAD_DATA_FAIL,
  LOAD_PARTY_DATA_FAILED,
  LOAD_PARTY_DATA_SUCCESS,
  LOAD_PERSON_DATA_FAILED,
  LOAD_COMMS,
  LOAD_COMMS_SUCCESS,
  LOAD_COMMS_FAIL,
} = dataStoreActions;
const isCucumberEnv = location.hostname.toLowerCase().includes('cucumber');
const defaultDuration = isCucumberEnv ? 50 : 2000;

export const loadDashboardData = (filterData, extraFilter) => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_DASHBOARD });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/dashboard',
    payload: { acdFilter: filterData, extraFilter, originator: 'navigation', isTeamFilter: (filterData.users || []).length > 1 },
  });

  if (error) {
    dispatch({ type: LOAD_DASHBOARD_FAILED, error });
    return;
  }

  const { users, ...rest } = data;
  dispatch({ type: LOAD_DASHBOARD_SUCCESS, result: rest });
};

let lastDashboardCallParams = {};
let lastCallTime = now();
export const refreshData = (wsUsers, reqId) => async (makeRequest, dispatch, getState) => {
  const theState = getState();

  const loggedInUser = theState.auth.user;
  const { enableAgentsOnlyAutomaticDashboardRefresh } = loggedInUser.features;

  if (enableAgentsOnlyAutomaticDashboardRefresh && !isAgent(loggedInUser)) {
    dispatch({ type: REFRESH_NEEDED });
    return;
  }

  const filterData = theState.dataStore.get('partyFilter');
  const showOnlyToday = theState.dashboardStore.showOnlyToday;
  const { users: filterUsers, teams } = filterData;
  if (!filterData || Object.keys(filterData).length === 0 || (filterUsers.length === 0 && teams.length === 0)) {
    console.log('no party filter available, skipping data refresh');
    return;
  }

  if (wsUsers && wsUsers.length) {
    const eventIsForCurrentUser = filterData.users && filterData.users.length && filterData.users.some(userId => wsUsers.find(wsUser => wsUser === userId));

    if (!eventIsForCurrentUser) {
      console.log('no user matched on party filter, skipping data refresh');
      return;
    }
  }

  const currentCallParams = { acdFilter: filterData, extraFilter: { showOnlyToday } };
  const timeSinceLastCall = now().diff(lastCallTime);

  if (isEqual(currentCallParams, lastDashboardCallParams) && timeSinceLastCall < defaultDuration) {
    console.log('Skipping dashboard api call - same params or too many calls in time interval');
    return;
  }

  lastDashboardCallParams = { acdFilter: filterData, extraFilter: { showOnlyToday } };
  lastCallTime = now();

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/dashboard',
    payload: {
      ...currentCallParams,
      originator: 'ws notification',
      isTeamFilter: (filterData.users || []).length > 1,
    },
    reqId,
  });

  if (error) {
    dispatch({ type: LOAD_DASHBOARD_FAILED, error });
    return;
  }

  const { users, ...rest } = data;

  dispatch({ type: LOAD_DASHBOARD_SUCCESS, result: rest });
};

export const loadPartyComms = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_COMMS });
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/parties/${partyId}/communication`,
  });

  if (error) {
    dispatch({ type: LOAD_COMMS_FAIL, error, partyId });
    return;
  }

  dispatch({ type: LOAD_COMMS_SUCCESS, result: { communications: data } });
};

export const loadPartyDetailsDataSilent = (partyId, reqId) => async (makeRequest, dispatch) => {
  if (!partyId) {
    console.warn('attempt to load the data from the party without providing a partyId');
    return Promise.resolve();
  }
  const res = await makeRequest({
    method: 'GET',
    url: `/partyDetails/${partyId}`,
    reqId,
  });

  const { data, error } = res;

  if (error) {
    error.__handled = true;
    dispatch({ type: LOAD_DATA_FAIL, error, partyId });
    dispatch({ type: LOAD_PARTY_DATA_FAILED, error, partyId });
    return res;
  }

  if (!data || !data.parties || data.parties.length === 0 || data.parties[0] === null) {
    const notFoundError = { message: 'Party not found', token: 'PARTY_NOT_FOUND' };
    dispatch({ type: LOAD_DATA_FAIL, error: notFoundError, partyId });
    dispatch({ type: LOAD_PARTY_DATA_FAILED, error: notFoundError, partyId });
    return res;
  }

  dispatch({ type: LOAD_DATA_SUCCESS, result: data });
  dispatch({ type: LOAD_PARTY_DATA_SUCCESS, result: data.parties[0].storedUnitsFilters });
  dispatch(loadPartyComms(partyId));

  return res;
};

export const refreshPartyData = ({ partyId, wsUsers, reqId }) => (_makeRequest, dispatch, getState) => {
  dispatch(reloadCallAssociatedParty(partyId, reqId));

  const route = leasingNavigator.location.pathname;
  if (route === '/') {
    dispatch(refreshData(wsUsers, reqId));
    return;
  }

  const currentPartyId = getState().partyStore.partyId;
  console.log('Handling WS event', { currentPartyId, partyId, route });

  if (currentPartyId === partyId) {
    dispatch(loadPartyDetailsDataSilent(partyId, reqId));
  }
};

export const loadCommunicationsForParties = ({ partyIds, ids, reqId }) => async (makeRequest, dispatch, getState) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/parties/communications',
    payload: { partyIds, ids },
    reqId,
  });

  if (error) {
    dispatch({ type: LOAD_DATA_FAIL, error });
    return;
  }

  await dispatch({ type: LOAD_DATA_SUCCESS, result: { communications: data } });

  await refreshInactiveCallFlyouts(data, dispatch, getState, reqId);
};

export const loadPersonDetailsData = personId => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_DATA });
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/personDetails/${personId}`,
  });

  if (error) {
    dispatch({ type: LOAD_DATA_FAIL, error, personId });
    dispatch({ type: LOAD_PERSON_DATA_FAILED, error, personId });
    return;
  }

  if (!data || !data.persons || data.persons.length === 0 || data.persons[0] === null) {
    const notFoundError = { message: 'Person not found', token: 'PERSON_NOT_FOUND' };
    dispatch({ type: LOAD_PERSON_DATA_FAILED, error: notFoundError, personId });
    return;
  }

  dispatch({ type: LOAD_DATA_SUCCESS, result: data });
};

export const loadPartyDetailsData = (partyId, { silentOnly, reqId }) => async (makeRequest, dispatch) => {
  !silentOnly && dispatch({ type: LOAD_DATA });
  return await loadPartyDetailsDataSilent(partyId, reqId)(makeRequest, dispatch);
};
