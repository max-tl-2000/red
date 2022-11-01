/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { validateUser } from './users';
import { validateTeam } from './teams';
import { ServiceError } from '../../common/errors';
import { getTeamMemberByTeamAndUser } from '../../dal/teamsRepo';
import * as validators from '../helpers/validators';
import * as availabilityService from '../../services/floatingAgents';

const logger = loggerModule.child({ subType: 'api/actions/availability' });

export const getAgentAvailability = async req => {
  logger.trace({ ctx: req }, 'getAgentAvailability');
  const { userId, startDate, endDate } = req.params;

  await validateUser(req, userId);
  validators.validDate(startDate, 'INCORRECT_DATE');
  validators.validDate(endDate, 'INCORRECT_DATE');
  return await availabilityService.getAgentAvailability(req, { userId, startDate, endDate });
};

export const saveAgentAvailability = async req => {
  logger.trace({ ctx: req, ...req.body }, 'saveAgentAvailability');
  const { userId, teamId, day, isUnavailable } = req.body;
  const { id: modifiedBy } = req.authUser;

  await validateUser(req, userId);
  await validators.validDate(day, 'INCORRECT_DATE');
  if (isUnavailable) {
    await availabilityService.deleteAgentAvailability(req, userId, day);
  } else {
    await validateTeam(req, teamId);
    const teamMember = await getTeamMemberByTeamAndUser(req, teamId, userId);

    if (!modifiedBy) {
      throw new ServiceError({ token: 'MISSING_AUTHENTICATED_USER', status: 403 });
    }

    if (!teamMember) {
      throw new ServiceError({ token: 'TEAM_MEMBER_NOT_FOUND', status: 404 });
    }

    await availabilityService.saveAgentAvailability(req, { teamMemberId: teamMember.id, day, modifiedBy, userId });
  }
  return { httpStatusCode: 200 };
};
