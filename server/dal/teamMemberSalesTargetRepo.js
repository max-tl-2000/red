/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, initQuery } from '../database/factory';

export const saveTeamMemberSalesTarget = (ctx, teamMemberSalesTarget) => insertOrUpdate(ctx.tenantId, 'TeamMemberSalesTargets', teamMemberSalesTarget);

export const getTeamMemberSalesTargetsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `TeamMemberSalesTargets.${field}`);
  const foreignKeysToSelect = ['Teams.name as team', 'Users.email as registrationEmail'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('TeamMemberSalesTargets')
    .innerJoin('Teams', 'TeamMemberSalesTargets.teamId', 'Teams.id')
    .innerJoin('Users', 'TeamMemberSalesTargets.userId', 'Users.id')
    .innerJoin('TeamProperties', 'Teams.id', 'TeamProperties.teamId')
    .whereIn('TeamProperties.propertyId', propertyIdsToExport);
};
