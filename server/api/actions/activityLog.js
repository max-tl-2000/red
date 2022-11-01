/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getActivityLogs as getActivityLogsFromDb } from '../../dal/activityLogRepo';
import {
  getActivityLogsByParty as getActivityLogsByPartyService,
  getActivityLogById as getActivityLogByIdService,
  logEntity,
} from '../../services/activityLogService';
import { uuid as validateUuid } from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import { isRevaAdmin } from '../../../common/helpers/auth';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import logger from '../../../common/helpers/logger';

const getActivityLogsByParty = async req => {
  const { tenantId, authUser } = req;
  const partyId = req.query.partyId;
  validateUuid(partyId, 'INVALID_PARTY_ID');

  return await getActivityLogsByPartyService({ tenantId, authUser }, partyId);
};

const getActivityLogById = async req => {
  const logId = req.params.id;
  validateUuid(logId, 'INVALID_ACTIVITY_LOG_ID');

  const activityLogEntry = await getActivityLogByIdService(req.tenantId, logId);
  if (!activityLogEntry) {
    throw new ServiceError({
      token: 'ACTIVITY_LOG_NOT_FOUND',
      status: 404,
    });
  }

  return activityLogEntry;
};

export const getActivityLogs = async req => {
  if (req.query.partyId) {
    return await getActivityLogsByParty(req);
  }

  return await getActivityLogsFromDb(req);
};

export const getActivityLog = async req => await getActivityLogById(req);

export const addActivityLog = async req => {
  const { authUser, body } = req;
  const { entity, activityType } = body;

  logger.trace({ ctx: req, ...entity }, 'Add activity Log');
  validateUuid(entity.id, 'INVALID_PARTY_ID');
  if (activityType === ACTIVITY_TYPES.MANUAL && !isRevaAdmin(authUser)) throw new ServiceError({ token: 'UNAUTHORIZED', status: 401 });

  return await logEntity(req, { entity, activityType, component: COMPONENT_TYPES.PARTY });
};
