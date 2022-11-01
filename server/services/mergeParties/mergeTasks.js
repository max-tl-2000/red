/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise } from 'bluebird';
import isEmpty from 'lodash/isEmpty';

import { DALTypes } from '../../../common/enums/DALTypes';
import * as taskRepo from '../../dal/tasksRepo';
import * as mergeRepo from '../../dal/mergePartyRepo';
import * as taskService from '../tasks';
import { updateEvent, removeEventByAppointment } from '../externalCalendars/cronofyService';
import loggerModule from '../../../common/helpers/logger';
import { getAppointmentAddress } from '../helpers/calendarHelpers';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

const prepareApointmentTask = ({ task, basePartyId, partyOwnerId, reassignTask, mergedMembers }) => {
  const {
    metadata: { partyMembers: oldPartyMemberIds },
  } = task;

  const newPartyMembers = oldPartyMemberIds.map(mId => mergedMembers.find(m => m.mergedPartyMember.id === mId)).filter(x => x);
  const newPartyMemberIds = newPartyMembers.map(member => member.id);

  if (!newPartyMemberIds.length) return {};

  return {
    ...task,
    partyId: basePartyId,
    userIds: reassignTask ? [partyOwnerId] : task.userIds,
    metadata: {
      ...task.metadata,
      partyMembers: newPartyMemberIds,
    },
  };
};

const prepareManualTask = ({ task, basePartyId, partyOwnerId, reassignTask }) => ({
  ...task,
  partyId: basePartyId,
  userIds: reassignTask ? [partyOwnerId] : task.userIds,
});

const taskCategoriesToMerge = [DALTypes.TaskCategories.MANUAL, DALTypes.TaskCategories.APPOINTMENT];

export const mergeTasks = async ({ ctx, basePartyId, mergedPartyId, mergedPartyUserId, mergedMembers, partyOwnerId }) => {
  logger.trace({ ctx, basePartyId, mergedPartyId, mergedPartyUserId, mergedMembers, partyOwnerId }, 'mergeTasks - params');
  const start = new Date().getTime();

  const tasksToMove = await taskRepo.getTasksForPartyByCategories(ctx, mergedPartyId, taskCategoriesToMerge);

  const result = await Promise.reduce(
    tasksToMove,
    async (movedTasks, task) => {
      const reassignTask = taskService.shouldReassignTask(task, mergedPartyUserId);
      const taskToUpdate =
        task.name === DALTypes.TaskNames.APPOINTMENT
          ? prepareApointmentTask({
              task,
              basePartyId,
              partyOwnerId,
              reassignTask,
              mergedMembers,
            })
          : prepareManualTask({
              task,
              basePartyId,
              partyOwnerId,
              reassignTask,
            });
      const updatedTask = !isEmpty(taskToUpdate) && (await mergeRepo.updateTask(ctx, taskToUpdate));

      if (task.name === DALTypes.TaskNames.APPOINTMENT) {
        const propertyAddress = await getAppointmentAddress(ctx, updatedTask);
        await removeEventByAppointment(ctx, task);
        await updateEvent(ctx, { appointment: updatedTask, propertyAddress });
      }

      return [...movedTasks, updatedTask];
    },
    [],
  );

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeTasks - duration');
  return result;
};
