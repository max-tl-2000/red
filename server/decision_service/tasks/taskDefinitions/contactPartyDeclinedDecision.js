/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import { getActiveTasks, findEvents, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';
import { now } from '../../../../common/helpers/moment-utils';
import { isCreatedOnOfficeHours } from '../../../services/teams';

const { PartyEventType, TaskNames, TaskCategories, TaskStates } = DALTypes;

const eventsForCreateTask = [PartyEventType.APPLICATION_STATUS_UPDATED, PartyEventType.PARTY_REOPENED];

const eventsForCancelTask = [PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

const shouldExecuteTask = (party, eventsWillFireTask) => !!findEvents(party, eventsWillFireTask)?.length;

const createTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'contactPartyDeclinedDecision - createTask');
  if (!shouldExecuteTask(party, eventsForCreateTask)) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.CONTACT_PARTY_DECLINE_DECISION)) return [];

  const createEvent = party.events.find(ev => eventsForCreateTask.includes(ev.event));
  const { createDeclinedTask = false } = createEvent?.metadata || {};
  if (!createDeclinedTask) return [];

  const [activeContactPartyDeclinedDecisionTask] = getActiveTasks(party, TaskNames.CONTACT_PARTY_DECLINE_DECISION);
  if (activeContactPartyDeclinedDecisionTask) return [];

  const timezone = party?.property?.timeZone;
  const [team] = party?.ownerTeamData;
  const taskCreatedDuringOfficeHours = isCreatedOnOfficeHours(team, now({ timezone }));

  const dueDate = now({ timezone }).toDate();

  const newTask = {
    id: getUUID(),
    name: TaskNames.CONTACT_PARTY_DECLINE_DECISION,
    category: TaskCategories.APPLICATION_APPROVAL,
    partyId: party.id,
    userIds: [party.userId],
    state: TaskStates.ACTIVE,
    dueDate,
    metadata: { createdByType: DALTypes.CreatedByType.SYSTEM, unique: true, taskCreatedDuringOfficeHours },
  };

  return [newTask];
};

const completeTasks = () => []; // task is completed manually

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'contactPartyDeclinedDecision - cancelTask');
  if (!shouldExecuteTask(party, eventsForCancelTask)) return [];

  const activeContactPartyDeclinedDecisionTask = getActiveTasks(party, TaskNames.CONTACT_PARTY_DECLINE_DECISION);
  if (!activeContactPartyDeclinedDecisionTask?.length) return [];

  const taskEntities = activeContactPartyDeclinedDecisionTask.map(task => ({
    id: task.id,
    name: TaskNames.CONTACT_PARTY_DECLINE_DECISION,
    state: TaskStates.CANCELED,
  }));

  if (taskEntities) {
    logger.trace({ ctx, taskEntities, partyId: party.id }, 'CancelContactPartyDeclinedDecision');
  }
  return taskEntities;
};

export const contactPartyDeclinedDecision = {
  name: TaskNames.CONTACT_PARTY_DECLINE_DECISION,
  category: TaskCategories.APPLICATION_APPROVAL,
  createTasks,
  completeTasks,
  cancelTasks,
};
