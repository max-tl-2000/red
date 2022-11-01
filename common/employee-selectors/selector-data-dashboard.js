/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import { getMinEscalation, getMaxEscalation } from '../acd/roles';
import { getUserTitle } from '../acd/filters';

const getVisibleTeamUsers = (allTeamUsers, teamId, loggedInUserMaxEscalation) => {
  const visibleUsers = allTeamUsers.filter(user => {
    const userTeam = user.teams.find(team => team.id === teamId);

    const userMinEscalation = getMinEscalation(userTeam.mainRoles);
    return loggedInUserMaxEscalation >= userMinEscalation;
  });
  return visibleUsers.map(user => user.id);
};

export const employeesSelectorData = (allUsers, loggedInUser) => {
  if (!allUsers.size) {
    return {
      users: [],
      teams: [],
    };
  }

  const allVisibleUsers = loggedInUser.teams.reduce((visibleUsers, loggedInUserTeam) => {
    const loggedInUserMaxEscalation = getMaxEscalation(loggedInUserTeam.mainRoles);
    const allTeamUsers = allUsers.filter(user => user.teams.some(team => team.id === loggedInUserTeam.id));
    const visibleTeamUser = getVisibleTeamUsers(allTeamUsers.toArray(), loggedInUserTeam.id, loggedInUserMaxEscalation);
    return [...visibleUsers, ...visibleTeamUser];
  }, []);

  const uniqueUsers = new Set([loggedInUser.id, ...allVisibleUsers]);
  const filteredUsers = [...uniqueUsers].map(id => allUsers.get(id));
  const filteredUsersWithTitle = filteredUsers.map(user => ({
    ...user,
    title: getUserTitle(user),
  }));

  const currentUser = filteredUsersWithTitle.find(u => u.id === loggedInUser.id);

  return {
    users: uniq([currentUser, ...sortBy(filteredUsersWithTitle, 'fullName')]),
    teams: sortBy(loggedInUser.teams, 'displayName'),
  };
};
