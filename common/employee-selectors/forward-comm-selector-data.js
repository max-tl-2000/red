/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import concat from 'lodash/concat';
import uniq from 'lodash/uniq';
import sortBy from 'lodash/sortBy';

const getTeamUsers = (users, teamId) => {
  const result = users.filter(u => u.teams.map(t => t.id).includes(teamId));

  return result.toArray();
};

const getPartyUsers = (users, currentUserId, party) => {
  const result = concat(party.collaborators, party.userId).filter(userId => userId !== currentUserId);

  return result.map(id => users.get(id));
};

const getActiveUsers = users => users.filter(user => user && user.teamIds.length);

export const getUsersAndTeamsForForwardComm = (allUsers, allTeams, party, currentUser) => {
  if (!party || !party.userId) {
    return {
      suggestedTeams: [],
      suggestedUsers: [],
      allUsers: allUsers ? allUsers.toArray() : [],
      allTeams: allTeams ? allTeams.toArray() : [],
    };
  }

  const partyUsers = getPartyUsers(allUsers, currentUser.id, party);
  const activePartyUsers = getActiveUsers(partyUsers);
  const teamUsers = getTeamUsers(allUsers, party.ownerTeam);
  const suggestedUsers = uniq(concat(activePartyUsers, teamUsers));
  const activeUsers = getActiveUsers(allUsers);

  const suggestedTeams = party.teams.map(id => allTeams.get(id)).filter(t => t);

  return {
    suggestedTeams,
    suggestedUsers: sortBy(suggestedUsers, ['fullName']),
    allUsers: activeUsers.filter(u => u.id !== currentUser.id).toArray(),
    allTeams: allTeams.toArray(),
  };
};
