/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minBy from 'lodash/minBy';
import maxBy from 'lodash/maxBy';
import { MainRoleDefinition, FunctionalRoleDefinition } from './rolesDefinition';
import { DALTypes } from '../enums/DALTypes';

export const sortOrder = {
  ASC: 'asc',
  DESC: 'desc',
};

export const sortRoles = (role1, role2, order) => {
  const role1Escalation = MainRoleDefinition[role1].escalation;
  const role2Escalation = MainRoleDefinition[role2].escalation;

  if (role1Escalation < role2Escalation) {
    return order === sortOrder.ASC ? -1 : 1;
  }
  if (role1Escalation > role2Escalation) {
    return order === sortOrder.ASC ? 1 : -1;
  }
  return 0;
};

const toRole = name => MainRoleDefinition[name];
const toRoles = roleNames => roleNames.map(toRole);

export const getMaxEscalation = roleNames => {
  const maxRole = maxBy(toRoles(roleNames), 'escalation');
  return (maxRole || {}).escalation;
};

export const getMinEscalation = roleNames => {
  const minRole = minBy(toRoles(roleNames), 'escalation');
  return (minRole || {}).escalation;
};

export const isAtLeast = (roleNames, roleEscalation) => getMaxEscalation(roleNames) >= roleEscalation;

export const isManager = (user, teamId) => {
  const team = user.teams.find(t => t.id === teamId);
  if (!team) return false;
  return team.mainRoles.some(r => r === MainRoleDefinition.LM);
};

export const getTeamsWhereUserIsAgent = user => user.teams.filter(team => team.functionalRoles.includes(FunctionalRoleDefinition.LWA.name));

export const getTeamsWhereUserIsAgentExceptResidentServiceTeams = user =>
  getTeamsWhereUserIsAgent(user).filter(t => t.module !== DALTypes.ModuleType.RESIDENT_SERVICES);

export const isAgentInMultipleTeams = user => getTeamsWhereUserIsAgentExceptResidentServiceTeams(user).length > 1;

export const isAgent = user => user.teams.some(team => team.functionalRoles.includes(FunctionalRoleDefinition.LWA.name));

export const isScheduleManager = user => user.teams.some(team => team.functionalRoles.includes(FunctionalRoleDefinition.LSM.name));
export const isCohortCommunicationApprover = user => user.teams.some(team => team.functionalRoles.includes(FunctionalRoleDefinition.CCA.name));

export const getTeamMembersWhereUserIsAgent = teamMembers =>
  teamMembers.filter(teamMember => teamMember?.functionalRoles?.includes(FunctionalRoleDefinition.LWA.name));
