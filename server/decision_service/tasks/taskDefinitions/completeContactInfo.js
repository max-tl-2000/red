/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isCorporateParty, isTaskAllowedOnCorporateParties } from '../../../../common/helpers/party-utils';
import logger from '../../../../common/helpers/logger';
import { now } from '../../../../common/helpers/moment-utils';
import { shouldProcessTaskOnPartyWorkflow } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates } = DALTypes;

const eventsFiredForCreateTask = [PartyEventType.CONTACT_INFO_REMOVED, PartyEventType.PARTY_MEMBER_ADDED, PartyEventType.LEASE_RENEWAL_CREATED];

const eventsFiredForCompleteTask = [PartyEventType.CONTACT_INFO_ADDED, PartyEventType.PERSON_UPDATED];

const eventsFiredForCancelTask = [
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PERSON_UPDATED,
  PartyEventType.PARTY_CLOSED,
];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const shouldCreateContactInfoTask = member => member && (member.contactInfo || []).length === 0 && !member.partyMember.endDate;

const shouldCancelContactInfoTask = (task, party) => {
  const member = (party.members || []).find(m => m.person.id === task.metadata.personId);
  const isMemberRemovedOrContactInfoAdded = (member.contactInfo || []).length === 0 && !!member.partyMember.endDate;
  const isPartyClosed = !!party.events.find(ev => ev.event === PartyEventType.PARTY_CLOSED);
  return !member || isMemberRemovedOrContactInfoAdded || isPartyClosed;
};

const hasContactInfo = member => member && member.contactInfo && member.contactInfo.length > 0;

const isActiveTask = task => task.name === TaskNames.COMPLETE_CONTACT_INFO && task.state === TaskStates.ACTIVE;

const hasActiveTaskForPerson = (task, member) => isActiveTask(task) && task.metadata.personId === member.person.id;

const createTasks = (ctx, party) => {
  if (!shouldExecuteTask(eventsFiredForCreateTask, party)) return [];

  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(TaskNames.COMPLETE_CONTACT_INFO)) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.COMPLETE_CONTACT_INFO)) return [];

  if (!party.userId) return [];

  const taskEntities = (party.members || [])
    .filter(shouldCreateContactInfoTask)
    .filter(member => !(party.tasks || []).find(task => hasActiveTaskForPerson(task, member)))
    .map(member => {
      const task = {
        name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
        category: DALTypes.TaskCategories.DRAFT,
        partyId: party.id,
        userIds: [party.userId],
        state: DALTypes.TaskStates.ACTIVE,
        dueDate: now().toDate(), // TODO: Ask why do we need the toDate call here?
        metadata: {
          externalId: getUUID(), // to be able to cross reference with external systems
          unique: true,
          createdBy: member.person.modified_by,
          personId: member.person.id,
        },
      };
      logger.trace({ ctx, task }, 'CreateCompleteContactInfo');
      return task;
    });

  return taskEntities;
};

const completeTasks = (ctx, party) => {
  if (!shouldExecuteTask(eventsFiredForCompleteTask, party)) return [];
  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.COMPLETE_CONTACT_INFO)) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.COMPLETE_CONTACT_INFO)) return [];

  const taskEntities = (party.members || [])
    .filter(hasContactInfo)
    .map(member => (party.tasks || []).filter(task => hasActiveTaskForPerson(task, member)))
    .reduce((acc, tasks) => acc.concat(tasks), [])
    .map(task => {
      logger.trace({ ctx, task }, 'CompleteCompleteContactInfo');
      const person = (party.members || []).map(m => m.person).find(p => p.id === task.metadata.personId);
      return {
        id: task.id,
        name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
        state: DALTypes.TaskStates.COMPLETED,
        completionDate: new Date(),
        metadata: {
          completedBy: (person && person.modified_by) || DALTypes.CreatedByType.SYSTEM,
        },
      };
    });
  return taskEntities;
};

const cancelTasks = (ctx, party) => {
  if (!shouldExecuteTask(eventsFiredForCancelTask, party)) return [];

  if (!isCorporateParty(party) || isTaskAllowedOnCorporateParties(DALTypes.TaskNames.COMPLETE_CONTACT_INFO)) {
    const taskEntities = (party.tasks || [])
      .filter(task => isActiveTask(task))
      .filter(task => shouldCancelContactInfoTask(task, party))
      .reduce((acc, tasks) => acc.concat(tasks), [])
      .map(task => ({
        id: task.id,
        name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
        state: DALTypes.TaskStates.CANCELED,
      }));
    return taskEntities;
  }

  // this flow can be triggered via party merge
  return (party.tasks || [])
    .filter(task => isActiveTask(task))
    .map(task => {
      logger.trace({ ctx, task }, 'CancelCompleteContactInfo');
      return {
        id: task.id,
        name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
        state: DALTypes.TaskStates.CANCELED,
      };
    });
};

export const completeContactInfo = {
  name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
  category: DALTypes.TaskCategories.DRAFT,
  createTasks,
  completeTasks,
  cancelTasks,
};
