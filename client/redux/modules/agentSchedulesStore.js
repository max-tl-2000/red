/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import notifier from 'helpers/notifier/notifier';
import { now, toMoment, DATE_ISO_FORMAT } from '../../../common/helpers/moment-utils';

const NUMBER_OF_DAYS = 14;

const LOADING_AVAILABILITY = 'agentSchedules/LOADING_AVAILABILITY';
const LOADED_AVAILABILITY = 'agentSchedules/LOADED_AVAILABILITY';
const LOADED_MORE_AVAILABILITY = 'agentSchedules/LOADED_MORE_AVAILABILITY';
const SAVED_AVAILABILITY = 'agentSchedules/SAVED_AVAILABILITY';
const RESTORE = 'agentSchedules/RESTORE';

const initialState = {
  availability: {},
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOADING_AVAILABILITY: {
      return {
        ...state,
        loading: true,
      };
    }
    case LOADED_AVAILABILITY: {
      return {
        availability: action.result.availability,
        startDate: action.result.startDate,
        endDate: action.result.endDate,
        loading: false,
      };
    }
    case LOADED_MORE_AVAILABILITY: {
      return {
        ...state,
        availability: { ...state.availability, ...action.result.availability },
        endDate: action.result.endDate,
        loading: false,
      };
    }
    case SAVED_AVAILABILITY: {
      return {
        ...state,
        availability: { ...state.availability, ...action.result.availability },
      };
    }
    case RESTORE: {
      return action.prevState;
    }
    default:
      return state;
  }
}

const load = async (userId, startDate, makeRequest) => {
  const endDate = toMoment(startDate)
    .add(NUMBER_OF_DAYS - 1, 'days')
    .format(DATE_ISO_FORMAT);

  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/floatingAgents/availability/${userId}/${startDate}/${endDate}/`,
  });

  if (error) {
    console.error('Failed to load user availability for agent schedule', error);
    notifier.error(t('LOAD_AGENT_AVAILABILITY_ERROR'));
    return { endDate, availability: {} };
  }

  return { endDate, availability: data };
};

export const loadAvailability = userId => async (makeRequest, dispatch) => {
  const startDate = now().format(DATE_ISO_FORMAT);

  dispatch({ type: LOADING_AVAILABILITY });

  const { endDate, availability } = await load(userId, startDate, makeRequest);

  dispatch({ type: LOADED_AVAILABILITY, result: { startDate, endDate, availability } });
};

export const loadMoreAvailability = userId => async (makeRequest, dispatch, getState) => {
  const currentEndDate = getState().agentSchedules.endDate;

  const startDate = toMoment(currentEndDate).add(1, 'day').format(DATE_ISO_FORMAT);

  dispatch({ type: LOADING_AVAILABILITY });

  const { endDate, availability } = await load(userId, startDate, makeRequest);

  dispatch({ type: LOADED_MORE_AVAILABILITY, result: { endDate, availability } });
};

export const saveAvailability = (day, userId, teamId) => async (makeRequest, dispatch, getState) => {
  const prevState = getState().agentSchedules;

  // optimistic update to avoid slow UI on slow networks
  dispatch({ type: SAVED_AVAILABILITY, result: { availability: { [day]: teamId } } });

  const { error } = await makeRequest({
    method: 'POST',
    url: '/floatingAgents/availability',
    payload: { userId, teamId, day, isUnavailable: !teamId },
  });

  if (error) {
    console.error('Failed to save user availability for agent schedule', error);
    notifier.error(t('SAVE_AGENT_AVAILABILITY_ERROR'));
    dispatch({ type: RESTORE, prevState });
  }
};
