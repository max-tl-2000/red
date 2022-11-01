/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';
import { getTeamMembersWhereUserIsAgent } from '../../../common/acd/roles';

const getTeamMembersUsers = (teamMembers, allUsers) => {
  const agentsTeamMembers = getTeamMembersWhereUserIsAgent(teamMembers);
  return agentsTeamMembers.map(teamMember => allUsers.get(teamMember.id));
};

export const getUserCallQueueTeams = state => {
  const loggedInUser = state.auth.user;
  const allTeams = state.globalStore.get('teams');
  const allUsers = state.globalStore.get('users');

  const userCallQueueTeams = loggedInUser.teams
    .filter(({ endDate, metadata }) => !endDate && metadata?.callQueue?.enabled)
    .map(({ id: teamId, displayName }) => {
      const { teamMembers } = allTeams.get(teamId) || {};
      return {
        teamId,
        displayName,
        teamMembers: getTeamMembersUsers(teamMembers, allUsers),
      };
    });

  return sortBy(userCallQueueTeams, 'displayName');
};
