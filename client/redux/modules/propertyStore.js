/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const SET_SELECTED_PROPERTY_ID = 'reva/SET_SELECTED_PROPERTY_ID';
const SET_OWNER_TEAM_ID = 'reva/SET_OWNER_TEAM_ID';

const initialState = {
  selectedPropertyId: null,
  ownerTeamId: null,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case SET_SELECTED_PROPERTY_ID:
      return {
        ...state,
        selectedPropertyId: action.propertyId,
      };
    case SET_OWNER_TEAM_ID:
      return {
        ...state,
        ownerTeamId: action.teamId,
      };
    default:
      return state;
  }
}

export const setSelectedPropertyId = propertyId => ({
  type: SET_SELECTED_PROPERTY_ID,
  propertyId,
});

export const setOwnerTeamId = teamId => ({
  type: SET_OWNER_TEAM_ID,
  teamId,
});
