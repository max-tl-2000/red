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
import { toMoment } from '../../../../common/helpers/moment-utils';

const { PartyEventType, TaskNames, TaskCategories, TaskStates } = DALTypes;

const eventsForCreateTask = [PartyEventType.LEASE_EXECUTED];

const eventsForCancelTask = [PartyEventType.LEASE_VOIDED, PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

const getExecutedLeaseById = (party, leaseId) => (party.leases || []).find(lease => lease.status === DALTypes.LeaseStatus.EXECUTED && lease.id === leaseId);

const shouldExecuteTask = (party, eventsWillFireTask) => !!findEvents(party, eventsWillFireTask)?.length;

const createTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'collectEmergencyContact - createTask');
  if (!shouldExecuteTask(party, eventsForCreateTask)) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.COLLECT_EMERGENCY_CONTACT)) return [];

  const createEvent = party.events.find(ev => eventsForCreateTask.includes(ev.event));
  const { showEmergencyContactTask = false, leaseId = '' } = createEvent.metadata;
  if (!showEmergencyContactTask) return [];

  const [activeCollectEmergencyTask] = getActiveTasks(party, TaskNames.COLLECT_EMERGENCY_CONTACT);
  if (activeCollectEmergencyTask) return [];

  const executedLease = getExecutedLeaseById(party, leaseId);
  if (!executedLease) return [];

  const moveInDate = executedLease.baselineData.publishedLease.moveInDate;
  const timezone = party?.property?.timeZone;
  const dueDate = toMoment(moveInDate, { timezone }).toDate();
  const startDate = toMoment(moveInDate, { timezone }).subtract(2, 'days').toDate();

  const newTask = {
    id: getUUID(),
    name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
    category: DALTypes.TaskCategories.FUTURE_RESIDENT,
    partyId: party.id,
    userIds: [party.userId],
    state: TaskStates.ACTIVE,
    dueDate,
    metadata: { createdByType: DALTypes.CreatedByType.SYSTEM, startDate, leaseId: executedLease.id, unique: true },
  };

  return [newTask];
};

const completeTasks = () => []; // task is completed manually

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'collectEmergencyContact - cancelTask');
  if (!shouldExecuteTask(party, eventsForCancelTask)) return [];

  const activeCollectEmergencyTask = getActiveTasks(party, TaskNames.COLLECT_EMERGENCY_CONTACT);
  if (!activeCollectEmergencyTask?.length) return [];

  const taskEntities = activeCollectEmergencyTask.map(task => ({
    id: task.id,
    name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
    state: DALTypes.TaskStates.CANCELED,
  }));

  if (taskEntities) {
    logger.trace({ ctx, taskEntities, partyId: party.id }, 'CancelCollectEmergencyContact');
  }
  return taskEntities;
};

export const collectEmergencyContact = {
  name: TaskNames.COLLECT_EMERGENCY_CONTACT,
  category: TaskCategories.FUTURE_RESIDENT,
  createTasks,
  completeTasks,
  cancelTasks,
};
