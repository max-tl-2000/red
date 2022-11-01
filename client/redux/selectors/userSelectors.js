/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import { isRevaAdmin, isAuditorRole } from 'helpers/auth';
import { dashboardFilterByUser, dashboardFilterByTeam } from 'acd/filters';

const getUserFeatures = state => state.auth.user.features;

export const isUserARevaAdmin = createSelector(
  state => state.auth.user,
  user => (user ? isRevaAdmin(user) : false),
);

export const isAuditorUser = createSelector(
  state => state.auth.user,
  (state, props) => props?.party?.teams,
  (currentUser, partyTeams) => {
    if (currentUser && partyTeams) {
      return isAuditorRole(currentUser, partyTeams);
    }
    return false;
  },
);

export const canUserBlockContact = createSelector(
  state => state.auth.user,
  user => user.teams.find(t => t.metadata.comms && t.metadata.comms.allowBlockContactFlag),
);

export const isDuplicatePersonNotificationEnabled = createSelector(
  state => state.auth.user,
  state => isUserARevaAdmin(state),
  (currentUser, isAdmin) => {
    if (!currentUser) return false;
    const { features } = currentUser;
    if (!features) return false;
    // this makes undefined be true. It will only be false if
    // set to false on purpose the flag
    return features.duplicatePersonNotification !== false || isAdmin;
  },
);

export const getPartyFilterSelector = createSelector(
  s => s.dashboardStore.dashboardSelection,
  s => s.auth.user,
  s => s.globalStore.get('users'),
  (dashboardSelection, currentUser, allUsers) => {
    if (!currentUser) return { users: [], teams: [] };

    // TODO: what is different from currentUser and
    // the user returned from this get call? it shall be
    // the same instance right?
    const loggedInUser = allUsers.get(currentUser.id);
    if (!loggedInUser) return { users: [], teams: [] };

    const filterBy = selection =>
      selection.isTeam ? dashboardFilterByTeam(loggedInUser, allUsers, selection.id) : dashboardFilterByUser(loggedInUser, allUsers, selection.id);

    const partySelector = dashboardSelection
      ? filterBy(dashboardSelection)
      : {
          users: [currentUser.id],
          teams: (currentUser.teams || []).map(team => team.id),
        };
    return partySelector;
  },
);

export const areNativeCommsEnabled = createSelector(
  state => state.auth.user,
  user => {
    const { teams } = user || {};
    return (teams || []).some(team => team.metadata.comms?.nativeCommsEnabled);
  },
);

export const canMergeParties = createSelector(
  state => state.auth.user,
  user => {
    if (!user) return false;
    const { features = {} } = user;

    return features.enableMergeParty !== false;
  },
);

export const getCurrentUser = createSelector(
  state => state.auth.user,
  state => state.globalStore.get('users'),
  (authUser, users) => {
    const currentUser = users.get(authUser.id);
    return currentUser;
  },
);
export const doesPartyHaveWorkflow = createSelector(
  state => state.partyStore.partyWorkflow,
  partyWorkflow => !!partyWorkflow,
);

export const userHasPropertyAndTeamAndChannelSelections = createSelector(
  state => state.partyStore.contactChannel,
  state => state.propertyStore.ownerTeamId,
  state => state.propertyStore.selectedPropertyId,
  (contactChannel, ownerTeamId, selectedPropertyId) => contactChannel && ownerTeamId && selectedPropertyId,
);

export const hasRenewalsFeatureOn = createSelector(getUserFeatures, features => !!features?.enableRenewals);
