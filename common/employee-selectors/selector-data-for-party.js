/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import { getEmployeesSelectorData } from './selector-data';

const getCollaborators = (users, currentUserId, party) => {
  const isNotCurrentUser = user => user.id !== currentUserId;
  const isUserInPartyTeams = user => party.teams.includes(user.currentTeamId);
  const isACollaborator = user => party.collaborators.includes(user.id);

  return users.filter(isNotCurrentUser).filter(isUserInPartyTeams).filter(isACollaborator);
};

const sortUsersByPartyAssignee = (allUsers, currentUserId, party) => {
  const isInPrimaryTeam = user => user.currentTeamId === party.ownerTeam;
  const owner = allUsers.find(user => isInPrimaryTeam(user) && user.id === party.userId);

  const currentUsers = allUsers.filter(u => u.id === currentUserId);
  const collaborators = getCollaborators(allUsers, currentUserId, party);

  // show the currentUser 2nd if they are in the party primary team or in a team that manages the party property
  const currentUserInPrimaryTeam = currentUsers.find(isInPrimaryTeam);

  const isManagingThePrimaryProperty = user => {
    const { associatedProperties } = user.teams.find(team => team.id === user.currentTeamId);

    return associatedProperties.find(property => property.id === party.assignedPropertyId);
  };

  const currentUsersForPrimaryProperty = !currentUserInPrimaryTeam ? currentUsers.filter(isManagingThePrimaryProperty) : [];

  const primaryTeamUsers = allUsers.filter(isInPrimaryTeam);
  const users = uniq([owner, currentUserInPrimaryTeam, ...currentUsersForPrimaryProperty, ...collaborators, ...primaryTeamUsers].filter(u => u));

  return Array.from(users.values());
};

export const loadDataForParty = (users, loggedInUser, party) => {
  if (!party) return {};

  const selectorDataForParty = getEmployeesSelectorData(users);
  const teams = selectorDataForParty.teams.filter(team => party.teams.includes(team.id));

  return {
    ...selectorDataForParty,
    users: sortUsersByPartyAssignee(selectorDataForParty.allUsers, loggedInUser.id, party),
    teams,
  };
};
