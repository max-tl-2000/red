/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import { getUserMainRole } from '../acd/filters';
import { tenantAdminEmail } from '../helpers/database';

const getUserTitleInTeam = (user, team) => {
  const role = getUserMainRole(team.mainRoles);
  return role ? `${role}: ${team.displayName}` : team.displayName;
};

const getAllTeams = allUsers => {
  if (!allUsers.size) return [];

  const teams = allUsers.toArray().map(user => user.teams);

  return uniqBy(flatten(teams), 'id');
};

export const getEmployeesSelectorData = allUsers => {
  if (!allUsers.size) return { users: [], teams: [], allUsers: [], allTeams: [] };

  const filteredUsers = allUsers.filter(user => user.email !== tenantAdminEmail && !user.inactive);

  const allUsersByTeam = flatten(
    filteredUsers
      .map(user =>
        user.teams.map(team => ({
          ...user,
          titleInTeam: getUserTitleInTeam(user, team),
          currentTeamId: team.id,
        })),
      )
      .toArray(),
  );

  const sortedUsers = sortBy(allUsersByTeam, 'fullName');
  const sortedTeams = sortBy(getAllTeams(allUsers), 'displayName');

  return {
    allUsers: sortedUsers,
    users: sortedUsers,
    teams: sortedTeams,
    allTeams: sortedTeams,
  };
};

export const loadData = users => {
  const selectorData = getEmployeesSelectorData(users);

  selectorData.allTeams = getAllTeams(users);

  return { selectorData };
};
