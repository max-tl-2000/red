/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { REVA_ADMIN_EMAIL } from '../auth-constants';
import { FunctionalRoleDefinition } from '../acd/rolesDefinition';

export const isAdmin = user => user.metadata && user.metadata.isAdmin;

export const isCustomerAdmin = user => user && user.metadata && user.metadata.isCustomerAdmin;

export const isRevaAdmin = user => user?.email === REVA_ADMIN_EMAIL;

export const isAuditorRole = (user, partyTeams) => {
  const authUserTeams = user.teams || [];
  if (!partyTeams.length || !authUserTeams.length) return false;
  const functionalRoles = authUserTeams.reduce((acc, team) => {
    if (partyTeams.includes(team.id)) {
      acc.push(...team.functionalRoles);
    }
    return acc;
  }, []);
  const hasAuditorRole = functionalRoles.some(r => r === FunctionalRoleDefinition.AUD.name);
  return hasAuditorRole;
};

export const enhanceAppConfigFromPersonMapping = (appConfig, personMapping) => ({
  ...appConfig,
  tenantId: appConfig.tenantId || personMapping.tenantId,
  commonUserId: appConfig.commonUserId || personMapping.commonUserId,
  personId: appConfig.personId || personMapping.personId,
});

export const stripPersonMappingDataFromAppConfig = appConfig => {
  if (!appConfig) return {};

  const { tenantId, commonUserId, personId, ...rest } = appConfig;
  return rest;
};
