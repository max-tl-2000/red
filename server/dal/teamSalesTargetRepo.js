/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertOrUpdate } from '../database/factory';

export const saveTeamSalesTarget = (ctx, teamSalesTarget) => insertOrUpdate(ctx.tenantId, 'TeamSalesTargets', teamSalesTarget);

export const getTeamSalesTargetsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `TeamSalesTargets.${field}`);
  const foreignKeysToSelect = ['Teams.name as name'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx).select(allFieldsToSelect).from('TeamSalesTargets').innerJoin('Teams', 'TeamSalesTargets.teamId', 'Teams.id');
};
