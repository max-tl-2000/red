/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../helpers/validators';
import loggerModule from '../../../common/helpers/logger';
import { validateUser } from './users';
import * as sickLeaveService from '../../services/sickLeaves';
import { ServiceError } from '../../common/errors';
import { getTimezoneNames } from '../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'api/actions/sickLeaves' });

const validateTimezone = timezone => {
  if (timezone === undefined || !getTimezoneNames().some(m => m === timezone)) {
    throw new ServiceError({
      token: 'INVALID_TIMEZONE',
      status: 400,
    });
  }
};

export const getAgentSickLeaves = async req => {
  const { userId } = req.params;
  const { query } = req;
  const { timezone } = query;
  logger.trace({ ctx: req, userId, timezone }, 'getAgentSickLeaves');
  await validateUser(req, userId);
  await validateTimezone(timezone);

  return await sickLeaveService.getSickLeavesForUser(req, userId, timezone);
};

const validateSickLeaveDates = async sickLeave => {
  if (sickLeave.startDate && sickLeave.endDate && sickLeave.endDate > sickLeave.startDate) {
    await validateTimezone(sickLeave.timezone);
    return;
  }

  throw new ServiceError({
    token: 'INVALID_APPOINTMENT_DATES',
    status: 400,
  });
};

export const addSickLeave = async req => {
  const sickLeave = req.body;
  logger.trace({ ctx: req, sickLeave }, 'addSickLeave action - input params');

  await validateUser(req, sickLeave.userId);

  await validateSickLeaveDates(sickLeave);

  return await sickLeaveService.addSickLeave(req, sickLeave);
};

export const removeSickLeave = async req => {
  const { sickLeaveId } = req.params;
  logger.trace({ ctx: req, sickLeaveId }, 'removeSickLeave');
  validators.uuid(sickLeaveId, 'INVALID_SICK_LEAVE_ID');

  return await sickLeaveService.removeSickLeave(req, sickLeaveId);
};
