/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTasksForPartiesByCategory } from '../../../dal/tasksRepo';
import { markTasksCanceled as markTasksAsCanceled } from '../utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'ManualTask' });

const getTasksToUpdate = async (ctx, partyIds) => {
  logger.debug({ ctx, partyIds }, 'Manual Tasks - getTasksToUpdate');
  const manualTasks = await getTasksForPartiesByCategory(ctx, partyIds, DALTypes.TaskCategories.MANUAL);
  return manualTasks.filter(task => task.state === DALTypes.TaskStates.ACTIVE);
};

export const markTasksCanceled = async (ctx, partyId) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return await markTasksAsCanceled(ctx, tasksToUpdate);
};

export const manual = {
  name: DALTypes.TaskNames.MANUAL,
  category: DALTypes.TaskCategories.MANUAL,
  markTasksCanceled,
};
