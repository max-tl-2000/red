/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import { getTasksForPartiesByName } from '../../../dal/tasksRepo';
import { markTasksCompleted as markTasksAsCompleted, markTasksCanceled as markTasksAsCanceled } from '../utils';

const getTasksToUpdate = async (ctx, partyIds) => {
  const requestWorkTasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.REQUIRE_ADDITIONAL_WORK);
  return requestWorkTasks.filter(task => task.state === DALTypes.TaskStates.ACTIVE);
};

export const markTasksCompleted = async (ctx, partyIds) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, partyIds);
  return markTasksAsCompleted(ctx, tasksToUpdate);
};

export const markTasksCanceled = async (ctx, partyId) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return markTasksAsCanceled(ctx, tasksToUpdate);
};

export const requireWork = {
  name: DALTypes.TaskNames.REQUIRE_ADDITIONAL_WORK,
  category: DALTypes.TaskCategories.REQUIRE_WORK,
  markTasksCompleted,
  markTasksCanceled,
};
