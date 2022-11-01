/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getSubscriptions, updateMultipleSubscriptions, deleteMultipleSubscriptions, insertMultipleSubscriptions } from '../../services/subscriptions';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'tenantsAPI' });

export const fetchSubscriptions = async req => {
  logger.trace({ ctx: req }, 'fetchAppSettings');
  return await getSubscriptions(req);
};

export const updateSubscriptions = async req => {
  logger.trace({ ctx: req }, 'updateSubscriptions');
  const { subscriptions } = req.body;
  if (!subscriptions || !subscriptions.length) return [];

  return await updateMultipleSubscriptions(req, subscriptions);
};

export const deleteSubscriptions = async req => {
  logger.trace({ ctx: req }, 'deleteSubscriptions');
  const { subscriptionsToDelete } = req.body;
  if (!subscriptionsToDelete || !subscriptionsToDelete.length) return [];

  return await deleteMultipleSubscriptions(req, subscriptionsToDelete);
};

export const addSubscriptions = async req => {
  logger.trace({ ctx: req }, 'addSubscriptions');
  const { subscriptionsToInsert } = req.body;
  if (!subscriptionsToInsert || !subscriptionsToInsert.length) return [];

  return await insertMultipleSubscriptions(req, subscriptionsToInsert);
};
