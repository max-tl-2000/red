/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const LOAD_DRAFTS_FAIL = 'communicationDraftStore/LOAD_DRAFTS_FAIL';
const LOAD_DRAFTS_SUCCESS = 'communicationDraftStore/LOAD_DRAFTS_SUCCESS';
const LOAD_DRAFTS_STARTED = 'communicationDraftStore/LOAD_DRAFTS_STARTED';

const initialState = {
  communicationDrafts: [],
  saveDraftError: '',
  loadDraftsError: '',
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_DRAFTS_STARTED: {
      return {
        ...state,
        communicationDrafts: [],
        loadDraftsError: '',
      };
    }
    case LOAD_DRAFTS_SUCCESS: {
      return {
        ...state,
        communicationDrafts: action.result,
      };
    }
    case LOAD_DRAFTS_FAIL: {
      return {
        ...state,
        loadDraftsError: action.error.token,
      };
    }
    default:
      return state;
  }
}

export const saveCommunicationDraft = draft => async makeRequest =>
  await makeRequest({
    method: 'POST',
    url: '/communications/draft',
    payload: { draft },
  });

export const deleteCommunicationDraft = draftId => makeRequest =>
  makeRequest({
    method: 'DEL',
    url: `/communications/drafts/${draftId}`,
  });

export const getDraftsForUserAndParty = (userId, partyId) => async (makeRequest, dispatch) => {
  await dispatch({ type: LOAD_DRAFTS_STARTED });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/communications/drafts/${userId}/${partyId}`,
  });

  if (error) {
    console.error(`Failed to load drafts of party ${partyId} for user ${userId}`);
    await dispatch({ type: LOAD_DRAFTS_FAIL, error });
    return;
  }

  await dispatch({ type: LOAD_DRAFTS_SUCCESS, result: { ...data } });
};
