/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getTasksForPartiesByName } from '../../../dal/tasksRepo';
import { loadPartiesByIds } from '../../../dal/partyRepo';
import { trySaveTasks, markTasksCompleted as markTasksAsCompleted, markTasksCanceled as markTasksAsCanceled, isActiveTask } from '../utils';
import { now } from '../../../../common/helpers/moment-utils';

const createTasks = async (ctx, partyIds, metadata) => {
  const alreadyCreatedTasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.HOLD_INVENTORY);
  const createdTasksSet = new Set(alreadyCreatedTasks.filter(isActiveTask).map(t => t.partyId));
  const parties = await loadPartiesByIds(ctx, partyIds);
  const newTasks = parties.map(party => {
    if (createdTasksSet.has(party.id)) {
      return false;
    }

    return {
      id: getUUID(),
      name: DALTypes.TaskNames.HOLD_INVENTORY,
      category: DALTypes.TaskCategories.PARTY,
      partyId: party.id,
      userIds: [party.userId],
      state: DALTypes.TaskStates.ACTIVE,
      dueDate: now().toDate(),
      metadata: {
        ...metadata,
      },
    };
  });
  return await trySaveTasks(
    ctx,
    newTasks.filter(t => t),
  );
};

export const processTaskDefinition = async (ctx, partyIds, metadata) => await createTasks(ctx, partyIds, metadata);

const getTasksToUpdate = async (ctx, partyIds) => {
  const holdInventoryTasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.HOLD_INVENTORY);
  return holdInventoryTasks.filter(isActiveTask);
};

export const markTasksCompleted = async (ctx, partyIds) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, partyIds);
  return await markTasksAsCompleted(ctx, tasksToUpdate);
};

export const markTasksCanceled = async (ctx, partyId) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return await markTasksAsCanceled(ctx, tasksToUpdate);
};

export const placeInventoryHold = {
  name: DALTypes.TaskNames.HOLD_INVENTORY,
  category: DALTypes.TaskCategories.PARTY,
  processTaskDefinition,
  markTasksCompleted,
  markTasksCanceled,
};
