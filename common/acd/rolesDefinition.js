/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const MainRoleDefinition = {
  V: {
    displayName: 'Viewer',
    name: 'V',
  },
  LA: {
    escalation: 100,
    displayName: 'Leasing Agent',
    name: 'LA',
  },
  LM: {
    displayName: 'Leasing Manager',
    escalation: 200,
    name: 'LM',
  },
  APM: {
    displayName: 'Assistant Property Manager',
    escalation: 300,
    name: 'APM',
  },
  PM: {
    displayName: 'Property Mananger',
    escalation: 400,
    name: 'PM',
  },
  RM: {
    displayName: 'Regional Manager',
    escalation: 500,
    name: 'RM',
  },
  VP: {
    displayName: 'Vice President',
    escalation: 600,
    name: 'VP',
  },
};

export const FunctionalRoleDefinition = {
  LD: {
    displayName: 'Leasing Dispatcher',
    name: 'LD',
    isMandatory: true,
    maxMembersWithThisRole: 1,
  },
  LAA: {
    displayName: 'Leasing Application Approver',
    name: 'LAA',
    isMandatory: true,
  },
  LCA: {
    displayName: 'Leasing Contract Approver',
    name: 'LCA',
    isMandatory: true,
  },
  LWA: {
    displayName: 'Leasing Working Agent',
    name: 'LWA',
    isMandatory: true,
  },
  LSM: {
    displayName: 'Leasing Schedule Manager',
    name: 'LSM',
    isMandatory: true,
  },
  CCA: {
    displayName: 'Cohort Communication Approver',
    name: 'CCA',
    isMandatory: false,
  },
  AUD: {
    displayName: 'Auditor',
    name: 'AUD',
    isMandatory: false,
  },
};

export const getFunctionalRoleNames = () => Object.keys(FunctionalRoleDefinition);

export const getMandatoryFunctionalRoles = () => Object.keys(FunctionalRoleDefinition).filter(key => FunctionalRoleDefinition[key].isMandatory);

export const getFunctionalRolesHavingMaxMembersLimit = () =>
  Object.keys(FunctionalRoleDefinition).filter(key => FunctionalRoleDefinition[key].maxMembersWithThisRole);
