/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getNavigationHistory as getNavigationHistoryFromDb, saveNavigationHistoryEntry } from '../../dal/navigationHistoryRepo';
import { exists } from '../../database/factory';
import { uuid as validateUuid } from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { enhanceNavigationHistoryElement } from '../../services/navigationHistoryService';
import { now } from '../../../common/helpers/moment-utils';
import config from '../../config';

const logger = loggerModule.child({ subType: 'api/actions/navigationHistory' });

export const loadNavigationHistoryForUser = async req => {
  const userId = req.authUser.id;
  logger.trace({ ctx: req, userId }, 'loadNavigationHistoryForUser');
  validateUuid(userId, 'INVALID_USER_ID');

  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  const navigationHistory = await getNavigationHistoryFromDb(ctx, userId);
  return await mapSeries(navigationHistory, async element => await enhanceNavigationHistoryElement(req, element));
};

export const addNavigationHistoryEntry = async req => {
  const { entityId: entity_id, entityType: entity_type } = req.body;
  logger.trace({ ctx: req, entity_id, entity_type }, 'addNavigationHistoryEntry');

  validateUuid(entity_id, 'INVALID_ENTITY_ID');

  if (!(await exists(req.tenantId, entity_type, entity_id))) {
    throw new ServiceError({
      status: 412,
      token: 'ENTITY_DOES_NOT_EXIST',
    });
  }

  const entry = await saveNavigationHistoryEntry(req, {
    userId: req.authUser.id,
    entity_id,
    entity_type,
    visited_at: now().toISOString(),
  });

  return entry;
};
