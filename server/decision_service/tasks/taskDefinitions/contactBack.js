/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'Contact Back Task' });
import { findEvent, getActiveTasks, markTasksAsComplete, findEvents, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';

const createTasks = async (ctx, party) => {
  if (party && [DALTypes.PartyStateType.FUTURERESIDENT, DALTypes.PartyStateType.RESIDENT].includes(party.state)) {
    logger.trace({ ctx, partyId: party.id }, `party already in ${party.state} state, will not create a contact back task`);
    return [];
  }

  const callBackRequestedEvent = findEvent(party, DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED);

  if (!callBackRequestedEvent) return [];

  const activeTaskExists = (party.tasks || []).some(task => task.name === DALTypes.TaskNames.CALL_BACK && task.state === DALTypes.TaskStates.ACTIVE);
  if (activeTaskExists) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.CALL_BACK)) return [];

  const newTask = {
    id: getUUID(),
    name: DALTypes.TaskNames.CALL_BACK,
    category: DALTypes.TaskCategories.PARTY,
    partyId: party.id,
    userIds: [party.userId],
    state: DALTypes.TaskStates.ACTIVE,
    dueDate: now().toDate(),
  };

  return [newTask];
};

const completeTasks = (ctx, party) => {
  if (!party.events || !party.events.length) return [];

  const { COMMUNICATION_ADDED, COMMUNICATION_SENT, COMMUNICATION_ANSWERED_CALL, TASK_ADDED, LEASE_COUNTERSIGNED, LEASE_VOIDED } = DALTypes.PartyEventType;
  const completeEvents = findEvents(party, [
    COMMUNICATION_ADDED,
    LEASE_VOIDED,
    LEASE_COUNTERSIGNED,
    TASK_ADDED,
    COMMUNICATION_ANSWERED_CALL,
    COMMUNICATION_SENT,
  ]);

  const eventCount = completeEvents.length;
  if (!eventCount) return [];

  const taskAddedEvent = findEvent(party, DALTypes.PartyEventType.TASK_ADDED);
  if (eventCount === 1 && taskAddedEvent) {
    const { category } = taskAddedEvent.metadata;
    if (category !== DALTypes.TaskCategories.APPOINTMENT && category !== DALTypes.TaskCategories.MANUAL) {
      return [];
    }
  }

  const activeTasks = getActiveTasks(party, DALTypes.TaskNames.CALL_BACK);

  return markTasksAsComplete(ctx, activeTasks);
};

const cancelTasks = (ctx, party) => {
  const closedPartyEvent = findEvent(party, DALTypes.PartyEventType.PARTY_CLOSED);
  const archivedPartyEvent = findEvent(party, DALTypes.PartyEventType.PARTY_ARCHIVED);
  if (closedPartyEvent || archivedPartyEvent) {
    const activeTasks = getActiveTasks(party, DALTypes.TaskNames.CALL_BACK);
    return activeTasks.map(task => ({ ...task, state: DALTypes.TaskStates.CANCELED }));
  }

  return [];
};

export const contactBack = {
  name: DALTypes.TaskNames.CALL_BACK,
  category: DALTypes.TaskCategories.PARTY,
  createTasks,
  completeTasks,
  cancelTasks,
};
