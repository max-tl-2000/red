/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { omit, pull } from 'lodash'; // eslint-disable-line red/no-lodash
import * as repo from '../dal/tasksRepo';
import { DALTypes } from '../../common/enums/DALTypes.js';
import { getUsersFullNamesByIds, getUserFullNameById, getRevaAdmin } from '../dal/usersRepo';
import { bulkCreateEvents } from './externalCalendars/cronofyService';
import { performPartyStateTransition } from './partyStatesTransitions';
import * as activityLogService from './activityLogService';
import { notify } from '../../common/server/notificationClient';
import { runInTransaction } from '../database/factory';
import { sendMessageToCompleteFollowupPartyTasks } from '../helpers/taskUtils';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { addAppointment, updateAppointment, cancelAppointment } from './appointments';
import { getPersonById } from '../dal/personRepo';
import * as partyRepo from '../dal/partyRepo';
import eventTypes from '../../common/enums/eventTypes';
import loggerModule from '../../common/helpers/logger';
import { toMoment, now } from '../../common/helpers/moment-utils';
import { saveEvent } from './partyEvent';
import { updatePartyTeams } from './helpers/party';

const logger = loggerModule.child({ subtype: 'services/tasks' });

const isAgent = user => user && user !== DALTypes.CreatedByType.SYSTEM;

const getCreatedByType = (ctx, user) => (ctx.authUser?.userId || isAgent(user) ? DALTypes.CreatedByType.USER : DALTypes.CreatedByType.SYSTEM);

const getCompletedBy = async (ctx, createdByType, completedBy) => {
  if (createdByType === DALTypes.CreatedByType.USER) {
    const userId = isAgent(completedBy) ? completedBy : ctx.authUser?.userId;
    return await getUserFullNameById(ctx, userId);
  }
  return completedBy;
};

const getManualReminderActivityType = taskState => {
  if (taskState === DALTypes.TaskStates.COMPLETED) return ACTIVITY_TYPES.COMPLETED;
  if (taskState === DALTypes.TaskStates.ACTIVE) return ACTIVITY_TYPES.UPDATE;

  return ACTIVITY_TYPES.REMOVE;
};

export const logTaskUpdated = async (ctx, task) => {
  logger.trace({ ctx, task }, 'log tasks updated');
  const createdByType = await getCreatedByType(ctx, task.metadata.completedBy);

  const completedBy = await getCompletedBy(ctx, createdByType, task.metadata.completedBy);
  const logEntry = {
    partyId: task.partyId || (await repo.getTaskById(ctx, task.id)).partyId,
    notes: task.metadata ? task.metadata.closingNote : '',
    assignee: (await getUsersFullNamesByIds(ctx, task.userIds)).join(', '),
    createdByType,
    dueDate: task.dueDate || '',
    id: task.id,
    completedBy,
    taskName: task.name,
  };

  if (task.name === DALTypes.TaskNames.COMPLETE_CONTACT_INFO || task.name === DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL) {
    logEntry.createdByType = DALTypes.CreatedByType.SYSTEM;
  }

  const activityType = task.state === DALTypes.TaskStates.COMPLETED ? ACTIVITY_TYPES.COMPLETED : ACTIVITY_TYPES.UPDATE;

  return await activityLogService.logEntity(ctx, { entity: logEntry, activityType, component: COMPONENT_TYPES.TASK });
};

export const logTaskAdded = async (ctx, task) => {
  logger.trace({ ctx, task }, 'log tasks added');

  const createdByType = await getCreatedByType(ctx, task.metadata.createdBy);
  const createdBy = await getUserFullNameById(ctx, task.metadata.createdBy);
  const partyOwner = await getUserFullNameById(ctx, task.metadata.originalPartyOwner);

  const logEntry = {
    partyId: task.partyId,
    taskName: task.name,
    assignee: (await getUsersFullNamesByIds(ctx, task.userIds)).join(', '),
    createdByType,
    dueDate: task.dueDate || '',
    id: task.id,
    createdBy,
    partyOwner,
  };

  if (task.name === DALTypes.TaskNames.COMPLETE_CONTACT_INFO) {
    const guest = await getPersonById(ctx, task.metadata.personId);
    logEntry.guests = [guest];
    logEntry.createdByType = DALTypes.CreatedByType.SYSTEM;
  }

  if (task.name === DALTypes.TaskNames.APPOINTMENT) {
    const guests = await partyRepo.loadPartyMemberByIds(ctx, task.metadata.partyMembers);
    logEntry.guests = guests;
  }

  if (task.name === DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL) {
    logEntry.createdByType = DALTypes.CreatedByType.SYSTEM;
  }

  if (task.name === DALTypes.TaskNames.HOLD_INVENTORY) {
    logEntry.guests = [task.metadata.holdDepositPayer];
  }

  if (task.category === DALTypes.TaskCategories.MANUAL_REMINDER) {
    logEntry.taskCategory = task.category;
  }

  await activityLogService.logEntityAdded(ctx, { entity: logEntry, component: COMPONENT_TYPES.TASK });
};

const add = async (req, task) => {
  const usersInfo = {
    createdBy: (task.metadata || {}).createdBy || req.authUser.id,
    originalPartyOwner: await partyRepo.getPartyOwner(req, task.partyId),
    originalAssignees: task.userIds || null,
  };

  const savedTask = await repo.saveTask(req, {
    ...task,
    metadata: { ...(task.metadata || {}), ...usersInfo },
  });

  if (savedTask) {
    const isTaskManual = savedTask.category === DALTypes.TaskCategories.MANUAL;
    await logTaskAdded(req, savedTask);
    isTaskManual && (await partyRepo.updatePartyCollaborators(req, savedTask.partyId, savedTask.userIds));
    await updatePartyTeams(req, { partyId: savedTask.partyId, userIds: savedTask.userIds, manuallySelectedTeamId: savedTask.metadata.teamId });
  }
  return savedTask;
};

const getActivityLogEntryForManualReminder = async (ctx, reminderTask) => {
  const closingNote = reminderTask.metadata.closingNote || '';
  const assignee = await getUserFullNameById(ctx, reminderTask.userIds[0]);
  const createdBy = await getUserFullNameById(ctx, reminderTask.metadata.createdBy);
  const partyOwner = await getUserFullNameById(ctx, reminderTask.metadata.originalPartyOwner);
  const completedBy = await getUserFullNameById(ctx, reminderTask.metadata.completedBy);
  const reopenedBy = await getUserFullNameById(ctx, reminderTask.metadata.reopenedBy);

  return {
    taskName: reminderTask.name,
    dueDate: reminderTask.dueDate,
    partyId: reminderTask.partyId,
    id: reminderTask.id,
    note: reminderTask.metadata.note,
    closingNote,
    createdBy,
    partyOwner,
    assignee,
    completedBy,
    reopenedBy,
    createdByType: DALTypes.CreatedByType.USER,
  };
};

const logManualReminderTask = async (ctx, prevState, currentState) => {
  const { assignee, ...restLogEntry } = await getActivityLogEntryForManualReminder(ctx, prevState);
  const currentActivityLogEntry = await getActivityLogEntryForManualReminder(ctx, currentState);
  const previousActivityLogEntry = !currentState.metadata?.isReopened ? { assignee, ...restLogEntry } : { ...restLogEntry };
  await activityLogService.logEntityUpdated({
    req: ctx,
    entityPrevState: previousActivityLogEntry,
    entityNextState: currentActivityLogEntry,
    component: COMPONENT_TYPES.TASK,
    createdByType: DALTypes.CreatedByType.USER,
    taskCategory: prevState.category,
    type: getManualReminderActivityType(currentState.state),
  });
};

const update = async (ctx, id, data) => {
  logger.trace({ ctx, id, data }, 'update - params');
  const delta = omit(data, ['sendConfirmationMail']);
  const prevState = await repo.getTaskById(ctx, id);
  const updatedTask = await repo.updateTask(ctx, id, delta);

  if (prevState.category === DALTypes.TaskCategories.MANUAL_REMINDER) {
    await logManualReminderTask(ctx, prevState, updatedTask);
  } else {
    await logTaskUpdated(ctx, updatedTask);
  }

  await performPartyStateTransition(ctx, updatedTask.partyId);
  return updatedTask;
};

const cancel = async (ctx, task) => {
  logger.trace({ ctx, task }, 'cancel - params');

  return await update(ctx, task.id, {
    id: task.id,
    state: DALTypes.TaskStates.CANCELED,
    partyId: task.partyId,
  });
};

const getSpecificOperations = task =>
  task.category === DALTypes.TaskCategories.APPOINTMENT
    ? { add: addAppointment, update: updateAppointment, cancel: cancelAppointment }
    : { add, update, cancel };

const removeMemberFromTask = async (ctx, memberId, task) => {
  task.metadata.partyMembers = pull(task.metadata.partyMembers, memberId);
  const updatedTask = await getSpecificOperations(task).update(ctx, task.id, { ...task, sendConfirmationMail: true });

  return updatedTask;
};

export const removeMemberFromTasks = async (ctx, partyId, member) => {
  logger.trace({ ctx, partyId, member }, 'remove member from tasks');
  const tasks = (await repo.getTasksForPartyMember(ctx, member)).filter(t => t.state === DALTypes.TaskStates.ACTIVE);

  return mapSeries(tasks, async t => {
    if (t.metadata.partyMembers && t.metadata.partyMembers.length > 1) {
      return await removeMemberFromTask(ctx, member.id, t);
    }

    return await getSpecificOperations(t).cancel(ctx, t);
  });
};

export const cancelUpcomingTasks = async (ctx, taskDetails) => {
  const { taskCategory = '', taskName = '', sendConfirmationMail = false, partyId } = taskDetails;
  logger.trace({ ctx, partyId, taskCategory, taskName }, 'cancel upcoming tasks');
  const tasks = (await repo.getTasksByPartyIds(ctx, [partyId])).filter(
    t => (t.category === taskCategory || t.name === taskName) && t.state === DALTypes.TaskStates.ACTIVE && now().isBefore(toMoment(t.dueDate)),
  );
  return await mapSeries(tasks, async task => await getSpecificOperations(task).cancel(ctx, { ...task, sendConfirmationMail }));
};

export const cancelTasksByCategories = async (ctx, partyId, taskCategories) => {
  logger.trace({ ctx, partyId, taskCategories }, 'cancel tasks by categories');
  const tasks = (await repo.getTasksByPartyIds(ctx, [partyId])).filter(
    task => taskCategories.some(category => category === task.category) && task.state === DALTypes.TaskStates.ACTIVE,
  );

  return await mapSeries(tasks, async t => await getSpecificOperations(t).cancel(ctx, t));
};

export const cancelTasksByNames = async (ctx, partyId, names) => {
  logger.trace({ ctx, partyId, names }, 'cancel tasks by names');
  const tasks = (await repo.getTasksByPartyIds(ctx, [partyId])).filter(
    task => names.some(name => name === task.name) && task.state === DALTypes.TaskStates.ACTIVE,
  );

  return await mapSeries(tasks, async t => await getSpecificOperations(t).cancel(ctx, t));
};

export const shouldReassignTask = (task, fromUserId) => task.state === DALTypes.TaskStates.ACTIVE && task.userIds.indexOf(fromUserId) >= 0;

export const reassignActivePartyTasks = async (ctx, partyId, fromUserId, toUserId, toTeamId) => {
  const tasksWithMultipleOwners = [DALTypes.TaskNames.REVIEW_APPLICATION, DALTypes.TaskNames.SEND_CONTRACT, DALTypes.TaskNames.COUNTERSIGN_LEASE];

  const tasks = (await repo.getTasksByPartyIds(ctx, [partyId])).filter(t => shouldReassignTask(t, fromUserId) && !tasksWithMultipleOwners.includes(t.name));

  logger.trace({ ctx, partyId, fromUserId, toUserId, tasksToReassign: tasks }, 'reassignActivePartyTasks');

  const result = await mapSeries(
    tasks,
    async t =>
      await getSpecificOperations(t).update(ctx, t.id, {
        id: t.id,
        userIds: [toUserId],
        ...(toTeamId && { metadata: { teamId: toTeamId } }),
      }),
  );

  await bulkCreateEvents(
    ctx,
    result.filter(t => t.name === DALTypes.TaskNames.APPOINTMENT),
  );
  return result;
};

const createTask = async (ctx, task) => {
  const savedTask = await getSpecificOperations(task).add(ctx, task);

  logger.trace(
    {
      tenantId: ctx.tenantId,
      partyId: savedTask.partyId,
      taskId: savedTask.id,
    },
    `Add task/appointment, send message to complete follow-up with party task: tenantId=${ctx.tenantId}, partyId=${savedTask.partyId}, taskId=${savedTask.id}`,
  );

  return savedTask;
};

export const addTask = async (outerCtx, task) =>
  await runInTransaction(async trx => {
    const partyId = task.partyId;
    const newCtx = { trx, ...outerCtx };

    const savedTask = await createTask(newCtx, task);
    const { teams } = await partyRepo.loadPartyById(newCtx, partyId);
    await sendMessageToCompleteFollowupPartyTasks(newCtx, [savedTask.partyId]);

    await saveEvent(newCtx, { partyId, metadata: { taskId: savedTask.id, category: savedTask.category } }, DALTypes.PartyEventType.TASK_ADDED);

    notify({
      ctx: newCtx,
      event: eventTypes.PROCESS_TASK_EVENT,
      data: {
        tasks: [{ taskId: savedTask.id, partyId: savedTask.partyId }],
        partyId: savedTask.partyId,
      },
      routing: { teams },
    });

    if (savedTask.name === DALTypes.TaskNames.APPOINTMENT) {
      const { userIds, metadata } = savedTask;
      const { startDate, teamId } = metadata;
      const timezone = await partyRepo.getTimezoneForParty(newCtx, partyId);

      notify({
        ctx: newCtx,
        event: eventTypes.LOAD_APPOINTMENTS_EVENT,
        data: {
          date: startDate,
          agentId: userIds[0],
          teamId,
          timezone,
          isNotification: true,
        },
        routing: { teams },
      });
    }
    return savedTask;
  }, outerCtx);

const removeRevaAdminFromAssignees = async (ctx, task) => {
  if (task.userIds?.length <= 1) return task;
  const { id: revaAdminId } = (await getRevaAdmin(ctx)) || {};
  logger.trace({ ctx, assignedUsers: task.userIds, revaAdminId }, 'remove Reva Admin from task assignees');
  return {
    ...task,
    userIds: task.userIds.filter(id => id !== revaAdminId),
  };
};

export const addAutomaticTask = async (outerCtx, task) =>
  await runInTransaction(async trx => {
    const partyId = task.partyId;
    const ctx = { trx, ...outerCtx };
    const updatedTask = await removeRevaAdminFromAssignees(ctx, task);
    logger.trace({ ctx, partyId, updatedTask }, 'addAutomaticTask');
    const savedTask = await add(ctx, updatedTask);
    if (savedTask) {
      const { teams } = await partyRepo.loadPartyById(ctx, partyId);

      notify({
        ctx,
        event: eventTypes.PROCESS_TASK_EVENT,
        data: {
          tasks: [{ taskId: savedTask.id, partyId: savedTask.partyId }],
          partyId: savedTask.partyId,
        },
        routing: { teams },
      });
    }
    return savedTask;
  }, outerCtx);

export const updateTask = async (outerCtx, taskId, updateDelta) =>
  await runInTransaction(async trx => {
    const ctx = { ...outerCtx, trx };
    const task = await repo.getTaskById(ctx, taskId);

    const delta =
      updateDelta.state === DALTypes.TaskStates.COMPLETED
        ? {
            ...updateDelta,
            completionDate: now(),
            metadata: {
              ...(updateDelta.metadata || {}),
              completedBy: (updateDelta.metadata || {}).completedBy || ctx.authUser.id,
            },
          }
        : updateDelta;

    const updatedTask = await getSpecificOperations(task).update(ctx, taskId, delta, updateDelta.sendConfirmationMail);

    // manually cancelling automatic tasks such as Send contract task should not add all the users on the task as collaborators
    const userIds = updatedTask.userIds.length > 1 ? [ctx.authUser.id] : updatedTask.userIds;
    await partyRepo.updatePartyCollaborators(ctx, updatedTask.partyId, userIds);
    await updatePartyTeams(ctx, { partyId: updatedTask.partyId, userIds, manuallySelectedTeamId: updatedTask.metadata.teamId });

    const { teams } = await partyRepo.loadPartyById(ctx, task.partyId);

    await saveEvent(
      ctx,
      { partyId: updatedTask.partyId, metadata: { taskId: updatedTask.id, category: updatedTask.category } },
      DALTypes.PartyEventType.TASK_UPDATED,
    );

    notify({
      ctx,
      event: eventTypes.PROCESS_TASK_EVENT,
      data: {
        tasks: [{ taskId: task.id, partyId: task.partyId }],
        partyId: task.partyId,
      },
      routing: { teams },
    });

    return updatedTask;
  }, outerCtx);

export const updateAutomaticTask = async (outerCtx, id, delta) =>
  await runInTransaction(async trx => {
    const ctx = { ...outerCtx, trx };

    logger.trace({ ctx, id, delta }, 'updateAutomaticTask');
    const task = await repo.getTaskById(ctx, id);

    if (task.state === delta.state) {
      logger.trace({ ctx, id, delta }, 'skipping task update as there is no state change.');
      return task;
    }

    const data =
      delta.state === DALTypes.TaskStates.COMPLETED
        ? {
            ...delta,
            completionDate: new Date(),
            metadata: {
              ...(delta.metadata || {}),
              completedBy: (delta.metadata || {}).completedBy || ctx.authUser.id,
            },
          }
        : delta;

    const updatedTask = await update(ctx, id, data);

    const { teams } = await partyRepo.loadPartyById(ctx, task.partyId);
    notify({
      ctx,
      event: eventTypes.PROCESS_TASK_EVENT,
      data: {
        tasks: [{ taskId: task.id, partyId: task.partyId }],
        partyId: task.partyId,
      },
      routing: { teams },
    });

    return updatedTask;
  }, outerCtx);
