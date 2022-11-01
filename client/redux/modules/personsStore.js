/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const SEARCH_PERSONS = 'persons/SEARCH_PERSONS';
const SEARCH_PERSONS_SUCCESS = 'persons/SEARCH_PERSONS_SUCCESS';
const SEARCH_PERSONS_FAIL = 'persons/SEARCH_PERSONS_FAIL';

const CLEAR_RESULTS = 'persons/CLEAR_RESULTS';
const CLEAR_ERROR = 'persons/CLEAR_ERROR';
const CLEAR_MERGE_ERROR = 'persons/CLEAR_MERGE_ERROR';

const MERGE_PERSON = 'persons/MERGE_PERSON';
const MERGE_PERSON_SUCCESS = 'persons/MERGE_PERSON_SUCCESS';
const MERGE_PERSON_FAIL = 'persons/MERGE_PERSON_FAIL';
const PERSON_MERGED = 'persons/PERSON_MERGED';

const LOAD_SELECTOR_DATA = 'persons/LOAD_SELECTOR_DATA';
const SEND_RESIDENT_APP_INVITE = 'persons/SEND_RESIDENT_APP_INVITE';
const SEND_RESIDENT_APP_INVITE_SUCCESS = 'persons/SEND_RESIDENT_APP_INVITE_SUCCESS';
const SEND_RESIDENT_APP_INVITE_FAILURE = 'persons/SEND_RESIDENT_APP_INVITE_FAILURE';

import { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } from './dataStore';
import { getEmployeesSelectorDataForUser } from '../../../common/employee-selectors/selector-data-for-user';

const initialState = {
  searchResultsList: [],
  selectorData: {},
  isLoading: false,
  isMergingPersons: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case CLEAR_RESULTS:
      return {
        ...state,
        searchResultsList: [],
      };
    case SEARCH_PERSONS:
      return {
        ...state,
        searchResultsList: [],
      };
    case SEARCH_PERSONS_SUCCESS: {
      const searchResultsList = action.result || [];
      return {
        ...state,
        searchResultsList,
      };
    }
    case SEARCH_PERSONS_FAIL:
      return {
        ...state,
        personsError: action.error.token || action.error.message,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        personsError: '',
      };
    case CLEAR_MERGE_ERROR:
      return {
        ...state,
        mergePersonsError: '',
      };
    case MERGE_PERSON:
      return {
        ...state,
        isMergingPersons: true,
      };
    case MERGE_PERSON_SUCCESS:
      return {
        ...state,
        isMergingPersons: false,
      };
    case MERGE_PERSON_FAIL:
      return {
        ...state,
        isMergingPersons: false,
        mergePersonsError: action.error.token || action.error.message,
      };
    case PERSON_MERGED:
      return {
        ...state,
        mergedPersonId: action.result,
      };
    case LOAD_SELECTOR_DATA:
      return {
        ...state,
        selectorData: action.result,
      };
    default:
      return state;
  }
}

export const fetchResults = query => ({
  types: [SEARCH_PERSONS, SEARCH_PERSONS_SUCCESS, SEARCH_PERSONS_FAIL],
  promise: client =>
    client.post('/search/persons', {
      data: {
        ...query,
      },
    }),
});

const formatter = person => ({ persons: [person] });

export const updatePerson = (person, dismissedMatches) => ({
  types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
  formatter,
  promise: client =>
    client.patch(`/persons/${person.id}`, {
      data: { ...person, dismissedMatches },
    }),
});

export const sendResidentAppInvite = ({ partyId, personIds, context }) => async (makeRequest, dispatch) => {
  dispatch({ type: SEND_RESIDENT_APP_INVITE });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/resident/invite',
    payload: {
      partyId,
      personIds,
      context,
    },
  });

  if (error) {
    dispatch({ type: SEND_RESIDENT_APP_INVITE_FAILURE, error });
  } else {
    dispatch({ type: SEND_RESIDENT_APP_INVITE_SUCCESS, result: data });
  }

  return { data, error };
};

export const mergePersons = mergeData => async (makeRequest, dispatch) => {
  dispatch({ type: MERGE_PERSON });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/persons/merge',
    payload: mergeData,
  });

  if (error) {
    dispatch({ type: MERGE_PERSON_FAIL, error });
  } else {
    dispatch({ type: MERGE_PERSON_SUCCESS, result: { personId: data.id, name: data.fullName } });
  }

  return { data, error };
};

export const clearError = () => ({ type: CLEAR_ERROR });

export const clearResults = () => ({ type: CLEAR_RESULTS });

export const clearMergeError = () => ({ type: CLEAR_MERGE_ERROR });

export const personAdded = person => ({
  type: UPDATE_DATA_SUCCESS,
  result: formatter(person),
});

export const loadSelectorData = (users, loggedInUser) => {
  const data = getEmployeesSelectorDataForUser(users, loggedInUser);
  return {
    type: LOAD_SELECTOR_DATA,
    result: data,
  };
};

export const handlePersonMerged = personId => ({ type: PERSON_MERGED, result: personId });
