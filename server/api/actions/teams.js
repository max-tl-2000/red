/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { exists } from '../../database/factory';
import * as validators from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import { updateTeam as updateTeamInDb } from '../../dal/teamsRepo';

export const validateTeam = async (ctx, teamId) => {
  validators.uuid(teamId, 'INVALID_TEAM_ID');

  if (!(await exists(ctx.tenantId, 'Teams', teamId))) {
    throw new ServiceError({
      token: 'TEAM_NOT_FOUND',
      status: 404,
    });
  }
};

export const updateTeam = async req => {
  const { teamId } = req.params;

  await validateTeam(req, teamId);

  return updateTeamInDb(req, teamId, req.body);
};
