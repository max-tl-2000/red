/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const FETCH_REQUEST = 'person-matches-fetch-request';
const FETCH_SUCCESS = 'person-matches-fetch-success';
const FETCH_FAILURE = 'person-matches-fetch-failure';

const FETCH_SUGGESTIONS_START = 'global-search-fetch-suggestions';
const FETCH_SUGGESTIONS_SUCCESS = 'global-search-fetch-suggestions-success';
const FETCH_SUGGESTIONS_FAILURE = 'global-search-fetch-suggestions-failure';

const CLEAR_SEARCH = 'global-search-clear-search';

const FETCH_HISTORY_REQUEST = 'global-search-fetch-history-request';
const FETCH_HISTORY_SUCCESS = 'global-search-fetch-history-success';
const FETCH_HISTORY_FAILURE = 'global-search-fetch-history-failure';

const SAVE_HISTORY_REQUEST = 'global-search-save-history-request';
const SAVE_HISTORY_SUCCESS = 'global-search-save-history-success';
const SAVE_HISTORY_FAILURE = 'global-search-save-history-failure';

const FECTH_GLOBAL_SEARCH_RESULTS_REQUEST = 'global-search-fetch-request';
const FECTH_GLOBAL_SEARCH_RESULTS_SUCCESS = 'global-search-fetch-success';
const FECTH_GLOBAL_SEARCH_RESULTS_FAILURE = 'global-search-fetch-failure';

const FETCH_COMPANY_SUGGESTIONS_START = 'search-fetch_company-suggestions';
const FETCH_COMPANY_SUGGESTIONS_SUCCESS = 'search-fetch_company-suggestions-success';
const FETCH_COMPANY_SUGGESTIONS_FAILURE = 'search-fetch_company-suggestions-failure';

const INITIAL_STATE = {
  suggestions: [],
  companySuggestions: [],
  query: '',
  searchResults: { matchedPersons: [], partiesForMatches: [] },
  globalSearchResults: [],
  history: [],
  loading: false,
};

export default function reducer(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case FETCH_SUGGESTIONS_START:
      return {
        ...state,
        suggestions: [],
      };
    case FETCH_SUGGESTIONS_SUCCESS:
      return {
        ...state,
        suggestions: action.result || [],
      };
    case FETCH_SUGGESTIONS_FAILURE:
      return {
        // TODO: handle the failure case
        ...state,
      };
    case CLEAR_SEARCH:
      return {
        ...state,
        query: '',
        suggestions: [],
        searchResults: {},
      };
    case FECTH_GLOBAL_SEARCH_RESULTS_REQUEST:
    case FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        searchId: action.searchId,
        query: action.query,
      };
    case FETCH_SUCCESS: {
      const searchResults = action.result || INITIAL_STATE.searchResults;
      return {
        ...state,
        loading: false,
        searchResults,
      };
    }
    case FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        searchResults: INITIAL_STATE.searchResults,
      };
    case SAVE_HISTORY_SUCCESS:
    case FETCH_HISTORY_SUCCESS:
      return {
        ...state,
        history: (action.result || {}).searches,
      };
    case FETCH_HISTORY_FAILURE:
      return {
        ...state,
        history: [],
      };
    case FECTH_GLOBAL_SEARCH_RESULTS_SUCCESS: {
      const globalSearchResults = action.result || INITIAL_STATE.globalSearchResults;
      return {
        ...state,
        loading: false,
        globalSearchResults,
      };
    }
    case FECTH_GLOBAL_SEARCH_RESULTS_FAILURE:
      return {
        ...state,
        loading: false,
        globalSearchResults: INITIAL_STATE.globalSearchResults,
      };
    case FETCH_COMPANY_SUGGESTIONS_START:
      return {
        ...state,
        companySuggestions: [],
      };
    case FETCH_COMPANY_SUGGESTIONS_SUCCESS:
      return {
        ...state,
        companySuggestions: action.result || [],
      };
    case FETCH_COMPANY_SUGGESTIONS_FAILURE:
      return {
        ...state,
      };
    default:
      return state;
  }
}

export const performSearch = (query, filters) => {
  const payload = { query, filters };

  return async (makeRequest, dispatch, getState) => {
    const userId = getState().auth.user.id;
    dispatch({ type: SAVE_HISTORY_REQUEST });

    // we don't need to wait for this one
    makeRequest({
      method: 'put',
      url: `/users/${userId}/search-history`,
      payload: { searches: [{ value: query }] },
    }).then(({ data: result, error }) => {
      if (error) {
        dispatch({ type: SAVE_HISTORY_FAILURE, error });
        return;
      }
      dispatch({ type: SAVE_HISTORY_SUCCESS, result });
    });

    dispatch({ type: FECTH_GLOBAL_SEARCH_RESULTS_REQUEST, query });
    // this one is the one we care about
    const { data: result, error } = await makeRequest({
      method: 'post',
      url: '/globalSearch',
      payload,
    });

    if (error) {
      dispatch({ type: FECTH_GLOBAL_SEARCH_RESULTS_FAILURE, error, query });
      return;
    }
    dispatch({ type: FECTH_GLOBAL_SEARCH_RESULTS_SUCCESS, result, query });
  };
};

export const loadSuggestions = ({ query, filters }) => {
  const payload = { query, filters };
  return async (makeRequest, dispatch) => {
    dispatch({ type: FETCH_SUGGESTIONS_START });

    const { data: result, error } = await makeRequest({
      method: 'post',
      url: '/globalSearch',
      payload,
    });

    if (error) {
      dispatch({ type: FETCH_SUGGESTIONS_FAILURE, error });
      return;
    }

    dispatch({ type: FETCH_SUGGESTIONS_SUCCESS, result });
  };
};

export const clearResults = () => ({ type: CLEAR_SEARCH });

export const getUserSearchHistory = () => async (makeRequest, dispatch, getState) => {
  const userId = getState().auth.user.id;

  dispatch({ type: FETCH_HISTORY_REQUEST });

  const { data: result, error } = await makeRequest({
    method: 'get',
    url: `/users/${userId}/search-history`,
  });

  if (error) {
    dispatch({ type: FETCH_HISTORY_FAILURE, error });
    return;
  }

  dispatch({ type: FETCH_HISTORY_SUCCESS, result });
};

export const loadMatches = payload => async (makeRequest, dispatch) => {
  const { searchId } = payload;
  dispatch({ type: FETCH_REQUEST, searchId });
  const { data: result, error } = await makeRequest({
    method: 'post',
    url: '/search/personMatches',
    payload,
  });

  if (error) {
    dispatch({ type: FETCH_FAILURE, error });
    return;
  }

  dispatch({ type: FETCH_SUCCESS, result });
};

export const loadCompanySuggestions = query => {
  const payload = { query };
  return async (makeRequest, dispatch) => {
    dispatch({ type: FETCH_COMPANY_SUGGESTIONS_START });

    const { data: result, error } = await makeRequest({
      method: 'post',
      url: '/search/companies',
      payload,
    });

    if (error) {
      dispatch({ type: FETCH_COMPANY_SUGGESTIONS_FAILURE, error });
      return;
    }

    dispatch({ type: FETCH_COMPANY_SUGGESTIONS_SUCCESS, result });
  };
};
