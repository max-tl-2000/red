/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamMemberByDirectPhoneIdentifier } from '../../dal/teamsRepo';
import { loadProgramForIncomingCommByPhone } from '../../dal/programsRepo';
import loggerModule from '../../../common/helpers/logger';
import { CommTargetType } from './targetUtils';
import { getTargetForProgram } from './targetProcessorHelpers';

const logger = loggerModule.child({ subType: 'comms' });

export const getTargetByPhone = async (ctx, identifier) => {
  const program = await loadProgramForIncomingCommByPhone(ctx, identifier, { includeInactive: true });
  if (program) return await getTargetForProgram({ ctx, program, identifier });

  const teamMember = await getTeamMemberByDirectPhoneIdentifier(ctx, identifier);
  if (teamMember) {
    return {
      type: CommTargetType.TEAM_MEMBER,
      id: teamMember.id,
    };
  }

  logger.error({ tenantId: ctx.tenantId, identifier }, `Phone target not found for identifier: ${identifier}`);
  return {};
};
