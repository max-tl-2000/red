/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import { getActiveTasks } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates, TaskCategories } = DALTypes;

const eventsForCompleteTask = [
  PartyEventType.LEASE_RENEWAL_MOVING_OUT,
  PartyEventType.COMMUNICATION_SENT,
  PartyEventType.COMMUNICATION_ADDED,
  PartyEventType.QUOTE_SENT,
];

const eventsForCancelTask = [PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const createTasks = () => []; // task is created by recurring job

const completeTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'sendRenewalReminder - completeTask');
  if (!shouldExecuteTask(eventsForCompleteTask, party)) return [];
  const [activeSendRenewalReminderTask] = getActiveTasks(party, TaskNames.SEND_RENEWAL_REMINDER);

  if (!activeSendRenewalReminderTask) return [];

  logger.trace({ ctx, activeSendRenewalReminderTask }, 'CompleteSendRenewalReminder');
  const completedTask = {
    ...activeSendRenewalReminderTask,
    state: TaskStates.COMPLETED,
    completionDate: new Date(),
    metadata: {
      completedBy: ctx.userId || DALTypes.CreatedByType.SYSTEM,
    },
  };
  return [completedTask];
};

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'sendRenewalReminder - cancelTask');
  if (!shouldExecuteTask(eventsForCancelTask, party)) return [];
  const activeSendRenewalReminderTasks = getActiveTasks(party, TaskNames.SEND_RENEWAL_REMINDER);
  if (!activeSendRenewalReminderTasks.length) return [];

  logger.trace({ ctx, activeSendRenewalReminderTasks }, 'CancelSendRenewalReminder');
  const canceledTasks = activeSendRenewalReminderTasks.map(t => ({ ...t, state: TaskStates.CANCELED }));
  return canceledTasks;
};

export const sendRenewalReminder = {
  name: TaskNames.SEND_RENEWAL_REMINDER,
  category: TaskCategories.INACTIVE,
  createTasks,
  completeTasks,
  cancelTasks,
};
