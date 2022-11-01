/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import logger from '../../../../common/helpers/logger';
import { getActiveTasks } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates, TaskCategories } = DALTypes;

const eventsForCreateTask = [PartyEventType.SERVICE_ANIMAL_ADDED, PartyEventType.PARTY_REOPENED];

const eventsForCancelTask = [PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED, PartyEventType.ALL_SERVICE_ANIMALS_REMOVED];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const createTasks = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'collect service animal documentation - createTask');
  if (!shouldExecuteTask(eventsForCreateTask, party)) return [];

  const serviceAnimals = party.pets ? party.pets.some(pet => pet.info.isServiceAnimal) : false;
  if (!serviceAnimals) return [];

  const activeCollectServiceAnimalDocTasks = getActiveTasks(party, TaskNames.COLLECT_SERVICE_ANIMAL_DOC);
  if (activeCollectServiceAnimalDocTasks.length) return [];

  const newTask = {
    id: getUUID(),
    name: DALTypes.TaskNames.COLLECT_SERVICE_ANIMAL_DOC,
    category: DALTypes.TaskCategories.PARTY,
    partyId: party.id,
    userIds: [party.userId],
    state: DALTypes.TaskStates.ACTIVE,
    dueDate: now().add(2, 'days').toDate(),
  };

  return [newTask];
};

const completeTasks = () => []; // manual completion

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'collect service animal documentation - cancelTask');
  if (!shouldExecuteTask(eventsForCancelTask, party)) return [];

  const activeCollectServiceAnimalDocTasks = getActiveTasks(party, TaskNames.COLLECT_SERVICE_ANIMAL_DOC);
  if (!activeCollectServiceAnimalDocTasks.length) return [];

  logger.trace({ ctx, activeCollectServiceAnimalDocTasks }, 'CancelCollectServiceAnimalDoc');
  const canceledTasks = activeCollectServiceAnimalDocTasks.map(t => ({ ...t, state: TaskStates.CANCELED }));
  return canceledTasks;
};

export const collectServiceAnimalDoc = {
  name: TaskNames.COLLECT_SERVICE_ANIMAL_DOC,
  category: TaskCategories.PARTY,
  createTasks,
  completeTasks,
  cancelTasks,
};
