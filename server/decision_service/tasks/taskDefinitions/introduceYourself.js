/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { findEvent, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';
import logger from '../../../../common/helpers/logger';

const { TaskNames } = DALTypes;

const createTasks = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'introduceYourself - createTask');
  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.INTRODUCE_YOURSELF)) return [];

  const commReceivedEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.COMMUNICATION_RECEIVED);
  const missedCallEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL);
  if (!commReceivedEvent && !missedCallEvent) return [];

  const taskAlreadyExists = (party.tasks || []).some(task => task.name === DALTypes.TaskNames.INTRODUCE_YOURSELF);
  if (taskAlreadyExists) return [];

  if (commReceivedEvent) {
    const { communicationId, isLeadCreated } = commReceivedEvent.metadata;
    const comm = party.comms.find(c => c.id === communicationId);

    // Ignore calls, they are processed on the missed call event. Ignore any received comm that didn't create a new party
    if (comm.type === DALTypes.CommunicationMessageType.CALL || !isLeadCreated) return [];
  }

  if (missedCallEvent && party.comms.length > 1) {
    return [];
  }

  const newTask = {
    id: getUUID(),
    name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
    category: DALTypes.TaskCategories.PARTY,
    partyId: party.id,
    userIds: [party.userId],
    state: DALTypes.TaskStates.ACTIVE,
    dueDate: now().toDate(),
    metadata: { createdByType: DALTypes.CreatedByType.SYSTEM, unique: true },
  };

  return [newTask];
};

const getActiveTasks = party =>
  (party.tasks || []).filter(task => task.name === DALTypes.TaskNames.INTRODUCE_YOURSELF && task.state === DALTypes.TaskStates.ACTIVE);

const markTasksAsComplete = (ctx, tasks) =>
  tasks.map(task => ({
    ...task,
    state: DALTypes.TaskStates.COMPLETED,
    completionDate: new Date(),
    metadata: { completedBy: ctx.userId || DALTypes.CreatedByType.SYSTEM },
  }));

const completeTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'introduceYourself - completeTasks');
  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.INTRODUCE_YOURSELF)) return [];

  const commSentEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.COMMUNICATION_SENT);
  const commAddedEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.COMMUNICATION_ADDED);
  const answeredCallEvent = party.events.find(ev => ev.event === DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL);
  if (!commSentEvent && !commAddedEvent && !answeredCallEvent) return [];

  const activeTasks = getActiveTasks(party);

  if (commAddedEvent) {
    const { communicationId } = commAddedEvent.metadata;
    const comm = party.comms.find(c => c.id === communicationId);

    if (comm.type === DALTypes.CommunicationMessageType.CONTACTEVENT) {
      return markTasksAsComplete(ctx, activeTasks);
    }
  }

  return markTasksAsComplete(ctx, activeTasks);
};

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'introduceYourself - cancelTasks');

  const closedPartyEvent = findEvent(party, DALTypes.PartyEventType.PARTY_CLOSED);
  const archivedPartyEvent = findEvent(party, DALTypes.PartyEventType.PARTY_ARCHIVED);

  if (closedPartyEvent || archivedPartyEvent) {
    const activeTasks = getActiveTasks(party);
    return activeTasks.map(task => ({ ...task, state: DALTypes.TaskStates.CANCELED }));
  }

  return [];
};

export const introduceYourself = {
  name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
  category: DALTypes.TaskCategories.PARTY,
  createTasks,
  completeTasks,
  cancelTasks,
};
