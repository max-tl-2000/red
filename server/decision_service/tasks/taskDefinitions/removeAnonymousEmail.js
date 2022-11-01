/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isCorporateParty } from '../../../../common/helpers/party-utils';
import logger from '../../../../common/helpers/logger';
import { now } from '../../../../common/helpers/moment-utils';
import { isAnonymousEmail } from '../../../../common/helpers/anonymous-email';
import { shouldProcessTaskOnPartyWorkflow } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates } = DALTypes;

const eventsFireForCreateTask = [PartyEventType.PARTY_MEMBER_ADDED, PartyEventType.CONTACT_INFO_ADDED, PartyEventType.PARTY_UPDATED];

const eventsFireForCancelTask = [
  PartyEventType.PERSON_UPDATED,
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.PARTY_UPDATED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PARTY_CLOSED,
];

const eventsFireForCompleteTask = [
  PartyEventType.PERSON_UPDATED,
  PartyEventType.CONTACT_INFO_ADDED,
  PartyEventType.CONTACT_INFO_REMOVED,
  PartyEventType.PARTY_MEMBER_UPDATED,
];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const isActiveTask = task => task.name === TaskNames.REMOVE_ANONYMOUS_EMAIL && task.state === TaskStates.ACTIVE;

const hasActiveTaskForPerson = (task, member) => isActiveTask(task) && task.metadata.personId === member.person.id;

const areThereContactInfo = member => (member.contactInfo || []).length;

const hasAnonymousEmail = comms => comms.some(comm => comm.type === DALTypes.ContactInfoType.EMAIL && isAnonymousEmail(comm.value));

const shouldCreateRemoveAnonymousEmailTask = member => member && !member.partyMember.endDate && hasAnonymousEmail(member.contactInfo || []);

const shouldCompleteRemoveAnonymousEmailTask = member =>
  member && (!areThereContactInfo(member) || (areThereContactInfo(member) && !hasAnonymousEmail(member.contactInfo)));

const shouldCancelRemoveAnonymousEmailTask = (task, party) => {
  if (isCorporateParty(party)) return true;
  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL)) return true;

  const member = (party.members || []).find(m => m.person.id === task.metadata.personId);
  return !member || (!areThereContactInfo(member) && !!member.partyMember.endDate);
};

const createTasks = async (ctx, party) => {
  if (isCorporateParty(party) || !party.userId || !shouldExecuteTask(eventsFireForCreateTask, party)) return [];
  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL)) return [];

  return (party.members || [])
    .filter(member => !(party.tasks || []).some(task => hasActiveTaskForPerson(task, member)))
    .filter(shouldCreateRemoveAnonymousEmailTask)
    .map(member => {
      const task = {
        name: DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
        category: DALTypes.TaskCategories.DRAFT,
        partyId: party.id,
        userIds: [party.userId],
        state: DALTypes.TaskStates.ACTIVE,
        dueDate: now().toDate(),
        metadata: {
          externalId: getUUID(),
          unique: true,
          createdBy: member.person.modified_by,
          personId: member.person.id,
        },
      };
      logger.trace({ ctx, task }, 'CreateRemoveAnonymousEmail');
      return task;
    });
};

const completeTasks = (ctx, party) => {
  if (isCorporateParty(party) || !shouldExecuteTask(eventsFireForCompleteTask, party)) return [];
  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL)) return [];

  return (party.members || [])
    .filter(shouldCompleteRemoveAnonymousEmailTask)
    .map(member => (party.tasks || []).filter(task => hasActiveTaskForPerson(task, member)))
    .reduce((acc, tasks) => acc.concat(tasks), [])
    .map(task => {
      logger.trace({ ctx, task }, 'CompleteRemoveAnonymousEmail');
      const person = (party.members || []).map(m => m.person).find(p => p.id === task.metadata.personId);
      return {
        id: task.id,
        name: DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
        state: DALTypes.TaskStates.COMPLETED,
        completionDate: new Date(),
        metadata: {
          completedBy: (person || {}).modified_by,
        },
      };
    });
};

const cancelTasks = (ctx, party) => {
  if (!shouldExecuteTask(eventsFireForCancelTask, party)) return [];

  const taskEntities = (party.tasks || [])
    .filter(isActiveTask)
    .filter(task => shouldCancelRemoveAnonymousEmailTask(task, party))
    .reduce((acc, tasks) => acc.concat(tasks), [])
    .map(task => ({
      id: task.id,
      name: DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
      state: DALTypes.TaskStates.CANCELED,
    }));
  logger.trace({ ctx, taskEntities }, 'CancelRemoveAnonymousEmail');
  return taskEntities;
};

export const removeAnonymousEmail = {
  name: DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
  category: DALTypes.TaskCategories.PARTY,
  createTasks,
  completeTasks,
  cancelTasks,
};
