/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { teamExists } from '../../dal/teamsRepo';
import { userExists } from '../../dal/usersRepo';
import loggerModule from '../../../common/helpers/logger';
import { CommTargetType } from './targetUtils';
const logger = loggerModule.child({ subType: 'comms' });

export const getTargetByTeamId = async (ctx, id, program) => {
  if (await teamExists(ctx, id)) return { type: CommTargetType.TEAM, id, program };

  logger.error({ tenantId: ctx.tenantId }, `Target not found for identifier: ${id}`);
  return {};
};

export const getTargetByUserId = async (ctx, id, program) => {
  if (await userExists(ctx, id)) return { type: CommTargetType.INDIVIDUAL, id, program };

  logger.error({ tenantId: ctx.tenantId }, `Target not found for identifier: ${id}`);
  return {};
};
