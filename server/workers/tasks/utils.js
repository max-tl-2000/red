/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { updateTasksBulk, updateTask, saveTask } from '../../dal/tasksRepo';
import { getPartyOwner, isCorporateLeaseType } from '../../dal/partyRepo';
import { logTaskAdded, logTaskUpdated } from '../../services/tasks';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isTaskAllowedOnCorporateParties } from '../../../common/helpers/party-utils';
import { runInTransaction } from '../../database/factory';

const logger = loggerModule.child({ subtype: 'Tasks-Utils' });

const updateTasks = async (ctx, tasks, updates) => {
  logger.trace({ ctx, updateTasks: tasks, updates }, 'updateTasks - params');
  try {
    const result = await updateTasksBulk(
      ctx,
      tasks.map(t => t.id),
      updates,
    );
    await mapSeries(result, async task => await logTaskUpdated(ctx, task));
    return result;
  } catch (error) {
    logger.error({ ctx, error, tasks }, 'Unable to update tasks');
  }
  return false;
};

export const markTasksCompleted = async (ctx, tasks) => {
  logger.trace({ ctx, completeTasks: tasks }, 'markTasksCompleted - params');
  const delta = {
    state: DALTypes.TaskStates.COMPLETED,
    completionDate: new Date(),
    metadata: ctx.userId ? { completedBy: ctx.userId } : {},
  };

  return await updateTasks(ctx, tasks, delta);
};

export const markTasksCanceled = async (ctx, tasks) => {
  logger.trace({ ctx, cancelTasks: tasks }, 'markTasksCanceled - params');
  return await updateTasks(ctx, tasks, { state: DALTypes.TaskStates.CANCELED });
};

export const trySaveTasks = async (ctx, tasks) => {
  logger.trace({ ctx, saveTasks: tasks }, 'trySaveTasks - params');
  const sanitizedTasks = tasks
    .map(t => ({
      ...t,
      userIds: t.userIds.filter(u => u),
    }))
    .filter(t => t.userIds.length);

  const tasksToSave = await mapSeries(sanitizedTasks, async t => ({
    ...t,
    metadata: {
      ...(t.metadata || {}),
      createdBy: ctx.userId,
      originalPartyOwner: await getPartyOwner(ctx, t.partyId),
      originalAssignees: t.userIds,
    },
  }));

  return await mapSeries(
    tasksToSave,
    async t =>
      await runInTransaction(async trx => {
        const innerCtx = { trx, ...ctx };
        const task = await saveTask(innerCtx, t);
        await logTaskAdded(innerCtx, task);
        return task;
      }, ctx),
  );
};

export const getPartiesWithAllowedTasks = async (ctx, partyIds = [], tasks = []) => {
  logger.trace({ ctx, partyIds, partyTasks: tasks }, 'getPartiesWithAllowedTasks - params');
  const partyTypesTuple = await mapSeries(partyIds, async partyId => [partyId, await isCorporateLeaseType(ctx, partyId)]);
  return partyTypesTuple.map(([partyId, isCorporateParty]) => ({
    partyId,
    isCorporateParty,
    tasks: isCorporateParty ? tasks.filter(name => isTaskAllowedOnCorporateParties(name)) : tasks,
  }));
};

export const shouldProcessTaskOnCorporateParty = async (ctx, partyId, taskName) => {
  logger.trace({ ctx, partyId, taskName }, 'shouldProcessTaskOnCorporateParty - params');
  const taskAllowed = isTaskAllowedOnCorporateParties(taskName);
  return taskAllowed && (await isCorporateLeaseType(ctx, partyId));
};

export const isActiveTask = ({ state } = {}) => state === DALTypes.TaskStates.ACTIVE;

export const addAssociatedIdToActiveTaskMetadata = async (ctx, task, associatedId, associatedFieldName) => {
  logger.trace({ ctx, task, associatedId, associatedFieldName }, 'addAssociatedIdToActiveTaskMetadata - params');
  if (!isActiveTask(task) || !associatedId || !associatedFieldName) return undefined;
  if (!(await isCorporateLeaseType(ctx, task.partyId))) return undefined;
  const metadata = task.metadata || {};
  const associatedIds = metadata[associatedFieldName] || [];
  const activeTask = {
    metadata: {
      ...task.metadata,
      [associatedFieldName]: Array.from(new Set([...associatedIds, associatedId])),
    },
  };
  return await updateTask(ctx, task.id, activeTask);
};
