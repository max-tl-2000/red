/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isAtLeast, getMinEscalation, isCohortCommunicationApprover } from './roles';
import { FunctionalRoleDefinition } from './rolesDefinition';
import { isCorporateParty as _isCorporateParty } from '../helpers/party-utils';

const userOwnsParty = (user, party) => party.userId === user.id;

const userCollaboratedWithParty = (user, party) => (party.collaborators || []).includes(user.id);

const getPartyTeamsWithBothUsers = (firstUser, secondUser, teamIds) => {
  if (!teamIds) return [];

  const isUserInTeam = (user, teamId) => user.teams && user.teams.some(t => t.id === teamId);
  return teamIds.filter(teamId => isUserInTeam(firstUser, teamId) && isUserInTeam(secondUser, teamId));
};

const userRoleIsAtLeastAsOwners = (user, owner, teamId) => {
  const usersRoles = user.teams.find(t => t.id === teamId).mainRoles;
  const ownersRoles = owner.teams.find(t => t.id === teamId).mainRoles;
  const ownersMinimumRole = getMinEscalation(ownersRoles);

  return isAtLeast(usersRoles, ownersMinimumRole);
};

const isUserTeamAssociatedWithPartyTeam = (party, associatedTeams = []) => associatedTeams.some(team => team.id === party.ownerTeam);
const userManagesPartyProperty = (party, properties = []) => properties.some(prop => prop.id === party.assignedPropertyId);

export const allowedToSignLease = (user, party) =>
  party.teams.some(teamId => {
    const userTeam = user.teams.find(t => t.id === teamId);
    if (!userTeam) return false; // the user is not a member of this team
    return userTeam.functionalRoles.includes(FunctionalRoleDefinition.LCA.name);
  });

export const allowedToModifyParty = (user, party) => {
  if (userOwnsParty(user, party)) return true;

  if (userCollaboratedWithParty(user, party)) return true;

  if (isUserTeamAssociatedWithPartyTeam(party, user.associatedTeams) && userManagesPartyProperty(party, user.properties)) return true;

  if (!user.teams) return false;

  const teamsAllowedToModify = party.teamsAllowedToModify || [];
  return !!user.teams.find(team => teamsAllowedToModify.includes(team.id));
};

const getUserAccessibleParties = (user, parties) => {
  const accessibleParties = parties.filter(party => allowedToModifyParty(user, party));
  return accessibleParties.map(p => p.id);
};

const isDirectCommunicationInRelatedTeams = (communication, currentUser, currentUserTeamsIds, users) => {
  const commUser = users.get(communication.userId);
  const partyTeamsWithBothUsers = getPartyTeamsWithBothUsers(currentUser, commUser, currentUserTeamsIds);
  return partyTeamsWithBothUsers.some(teamId => userRoleIsAtLeastAsOwners(currentUser, commUser, teamId));
};

export const getCommunicationsAccessibleByUser = (currentUser, personId, users, allCommunications, parties) => {
  const communications = allCommunications.filter(c => c.persons.includes(personId));
  if (communications.length === 0) return [];

  const currentUserTeamsIds = (currentUser.teams || []).map(t => t.id);
  const accessiblePartiesIds = getUserAccessibleParties(currentUser, parties);

  return communications.filter(
    comm =>
      (comm.userId && (comm.userId === currentUser.id || isDirectCommunicationInRelatedTeams(comm, currentUser, currentUserTeamsIds, users))) ||
      comm.parties.some(p => accessiblePartiesIds.includes(p)),
  );
};

export const getAppointmentsAccessibleByUser = (currentUser, allAppointments, personId, members, parties, users, inactiveMembers) => {
  const getPersonId = pm => (members.get(pm) || inactiveMembers.get(pm) || []).personId;
  const appointments = allAppointments.filter(a => a.metadata.partyMembers.map(getPersonId).includes(personId));
  const accessiblePartiesIds = getUserAccessibleParties(currentUser, parties);

  return appointments.filter(a => accessiblePartiesIds.includes(a.partyId));
};

export const allowedToReviewApplication = (currentUser, party) => {
  if (!party || !party.teams || !currentUser || !currentUser.teams) return false;

  return party.teams.some(partyTeamId =>
    currentUser.teams.filter(p => p.id === partyTeamId).some(team => team.functionalRoles.includes(FunctionalRoleDefinition.LAA.name)),
  );
};

export const allowedToDownloadApplicationDocuments = (currentUser, party) => {
  const partyTeamIds = (party || {}).teams || [];
  return partyTeamIds.some(partyTeamId => currentUser.teams.some(userTeam => userTeam.id === partyTeamId));
};

export const allowedAccessToCohortCommms = user => {
  if (!user) return false;

  const isCohortCommsEnabled = user.features.enableCohortComms && !user.isTrainingTenant;
  return isCohortCommsEnabled && isCohortCommunicationApprover(user);
};
