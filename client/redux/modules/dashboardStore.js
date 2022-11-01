/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';
import { LOGOUT } from './auth';
import { getProfile } from '../../modules/localProfile';
import { buildPartyUrl } from '../../helpers/leasing-navigator';
import { DALTypes } from '../../../common/enums/DALTypes';

const CHANGE_COLUMN_POSITION = 'dashboardStore/CHANGE_COLUMN_POSITION';
const CHANGE_DASHBOARD_SELECTION = 'dashboardStore/CHANGE_DASHBOARD_SELECTION';

const TOGGLE_DISPLAY_OF_LATER_AND_TOMORROW = 'dashboardStore/TOGGLE_DISPLAY_OF_LATER_AND_TOMORROW';
const LOAD_USER_SETTINGS = 'dashboardStore/LOAD_USER_SETTINGS';
export const LOAD_DASHBOARD = 'dashboardStore/LOAD_DASHBOARD';
export const LOAD_DASHBOARD_FAILED = 'dashboardStore/LOAD_DASHBOARD_FAILED';
export const LOAD_DASHBOARD_SUCCESS = 'dashboardStore/LOAD_DASHBOARD_SUCCESS';

const NAVIGATE_TO_NEXT_MATCH = 'dashboard/store/NAVIGATE_TO_NEXT_MATCH';
const RESET_NEXT_MATCH = 'dashboard/store/RESET_NEXT_MATCH';
export const REFRESH_NEEDED = 'dashboard/store/REFRESH_NEEDED';

const initialState = {
  loading: false,
  columnPosition: 0,
  dashboardSelection: undefined,
  refreshNeeded: false,
  showOnlyToday: null,
  lanes: Immutable.fromJS({
    [DALTypes.PartyStateType.CONTACT]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
    [DALTypes.PartyStateType.LEAD]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
    [DALTypes.PartyStateType.PROSPECT]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
    [DALTypes.PartyStateType.APPLICANT]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
    [DALTypes.PartyStateType.LEASE]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
    [DALTypes.PartyStateType.FUTURERESIDENT]: {
      total: 0,
      today: 0,
      tomorrow: 0,
      laneData: [],
    },
  }),
};

const enhanceLanesData = resultsFromDB => {
  const emptyLane = { total: '0', today: '0', tomorrow: '0', laneData: [] };
  let enhancedLeads = resultsFromDB?.Lead || emptyLane;
  let enhancedFutureResidents = resultsFromDB?.FutureResident || emptyLane;
  const residents = resultsFromDB?.Resident?.laneData;
  const residentsWithUnreadComms = residents?.filter(r => r.communication?.unread);
  const movingOutRenewals = resultsFromDB?.MovingOut;

  const shouldEnhanceLanes = residentsWithUnreadComms?.length || movingOutRenewals?.laneData?.length;
  if (!shouldEnhanceLanes) return initialState.lanes.mergeDeep(Immutable.fromJS(resultsFromDB));

  if (residentsWithUnreadComms?.length) {
    const leadsAndResidentsWithUnreadComms = [...enhancedLeads.laneData, ...residentsWithUnreadComms];

    // We need to display Resident parties which have any unread comms in the second dashboard column called Contacts, which shows parties in state Lead
    enhancedLeads = {
      ...enhancedLeads,
      total: (parseInt(enhancedLeads.total, 10) + residentsWithUnreadComms.length).toString(),
      today: (parseInt(enhancedLeads.today, 10) + residentsWithUnreadComms.length).toString(),
      laneData: leadsAndResidentsWithUnreadComms,
    };
  }

  if (movingOutRenewals?.laneData?.length) {
    const futureResidentsAndMovingOutRenewals = [...enhancedFutureResidents.laneData, ...movingOutRenewals.laneData];

    // Renewal parties that are moving out will be displayed in the last column
    enhancedFutureResidents = {
      ...enhancedFutureResidents,
      total: (parseInt(enhancedFutureResidents.total, 10) + parseInt(movingOutRenewals.total, 10)).toString(),
      today: (parseInt(enhancedFutureResidents.today, 10) + parseInt(movingOutRenewals.today, 10)).toString(),
      laneData: futureResidentsAndMovingOutRenewals,
    };
  }

  const enhancedResults = {
    ...resultsFromDB,
    Lead: enhancedLeads,
    FutureResident: enhancedFutureResidents,
  };

  return initialState.lanes.mergeDeep(Immutable.fromJS(enhancedResults));
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_USER_SETTINGS: {
      const profile = getProfile(action.userId);
      const showOnlyToday = profile.get('dashboardSections.showOnlyToday', true);

      return {
        ...state,
        showOnlyToday,
      };
    }
    case CHANGE_COLUMN_POSITION:
      return {
        ...state,
        columnPosition: action.position,
      };
    case CHANGE_DASHBOARD_SELECTION:
      return {
        ...state,
        dashboardSelection: action.selection,
      };
    case TOGGLE_DISPLAY_OF_LATER_AND_TOMORROW: {
      const profile = getProfile(action.userId);
      const showOnlyToday = !state.showOnlyToday;

      profile.set('dashboardSections.showOnlyToday', showOnlyToday);

      return {
        ...state,
        showOnlyToday,
      };
    }
    case LOAD_DASHBOARD_SUCCESS: {
      const nextMatch = action.result.strongMatchData[0] || {};
      return {
        ...state,
        lanes: enhanceLanesData(action.result),
        nextMatchParty: { id: nextMatch.partyId, state: nextMatch.state },
        nextMatchPersonId: nextMatch.personId,
        loading: false,
        refreshNeeded: false,
      };
    }
    case LOAD_DASHBOARD:
      return { ...state, loading: true };
    case LOAD_DASHBOARD_FAILED:
      return {
        ...state,
        loading: false,
        error: (action.error || {}).token || 'UNKNOWN_ERROR',
      };
    case NAVIGATE_TO_NEXT_MATCH:
      return {
        ...state,
        nextMatchTargetURL: action.targetURL,
      };
    case RESET_NEXT_MATCH:
      return {
        ...state,
        nextMatchTargetURL: '',
      };
    case REFRESH_NEEDED:
      return {
        ...state,
        refreshNeeded: true,
      };

    case LOGOUT:
      return initialState;
    default:
      return state;
  }
}

export const setColumnPosition = position => ({
  type: CHANGE_COLUMN_POSITION,
  position,
});

export const setDashboardSelection = selection => ({
  type: CHANGE_DASHBOARD_SELECTION,
  selection,
});

export const toggleDisplayOfLaterAndTomorrow = userId => ({
  type: TOGGLE_DISPLAY_OF_LATER_AND_TOMORROW,
  userId,
});

export const loadUserSettings = userId => ({ type: LOAD_USER_SETTINGS, userId });

export const navigateToNextMatch = (nextMatchParty, personId) => {
  const targetURL = buildPartyUrl(nextMatchParty.id, { openMatch: true, personId });
  return {
    type: NAVIGATE_TO_NEXT_MATCH,
    targetURL,
  };
};

export const resetNextMatch = () => ({
  type: RESET_NEXT_MATCH,
});
