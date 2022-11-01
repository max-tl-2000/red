/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { MainRoleDefinition } from './rolesDefinition';
import { sortOrder, sortRoles, getMinEscalation, getMaxEscalation } from './roles';

const shouldUserBeVisible = (user, teamId, loggedInUserId, loggedInUserMaxEscalation) => {
  if (user.id === loggedInUserId) return true;
  const userTeam = user.teams.find(team => team.id === teamId);

  const userMainRoles = userTeam.mainRoles;
  const minUserEscalation = getMinEscalation(userMainRoles);
  return minUserEscalation <= loggedInUserMaxEscalation;
};

export const dashboardFilterByUser = (loggedInUser, allUsers, selectedUserId) => {
  if (loggedInUser.id === selectedUserId) {
    return {
      users: [selectedUserId],
      teams: loggedInUser.teams.map(team => team.id),
    };
  }

  const selectedUser = allUsers.get(selectedUserId);

  const filteredTeams = selectedUser.teams.filter(selectedUserTeam => {
    const loggedInUserTeam = loggedInUser.teams.find(team => team.id === selectedUserTeam.id);
    if (!loggedInUserTeam) return false;

    const loggedInUserMaxEscalation = getMaxEscalation(loggedInUserTeam.mainRoles);
    const selectedUserMinEscalation = getMinEscalation(selectedUserTeam.mainRoles);
    return loggedInUserMaxEscalation >= selectedUserMinEscalation;
  });

  return {
    users: [selectedUserId],
    teams: filteredTeams.map(team => team.id),
  };
};

export const dashboardFilterByTeam = (loggedInUser, allUsers, selectedTeamId) => {
  const loggedInUserMaxEscalation = getMaxEscalation(loggedInUser.teams.find(team => team.id === selectedTeamId).mainRoles);
  const allTeamUsers = allUsers.filter(user => user.teams.some(team => team.id === selectedTeamId));
  const filteredUsers = allTeamUsers.filter(user => shouldUserBeVisible(user, selectedTeamId, loggedInUser.id, loggedInUserMaxEscalation));
  return {
    users: filteredUsers.toArray().map(user => user.id),
    teams: [selectedTeamId],
  };
};

export const getUserMainRole = roles => {
  const mainRole = roles.sort((role1, role2) => sortRoles(role1, role2, sortOrder.DESC))[0];
  return (mainRole && MainRoleDefinition[mainRole].displayName) || '';
};

export const getUserTitle = user => {
  const allUserRoles = user.teams.reduce((allRoles, team) => [...allRoles, ...team.mainRoles], []);

  return getUserMainRole(allUserRoles);
};
