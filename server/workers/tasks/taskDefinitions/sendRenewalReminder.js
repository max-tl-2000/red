/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getRenewalReminderEligibleParties, getTasksForPartiesByName } from '../../../dal/tasksRepo';
import { loadPartiesByIds } from '../../../dal/partyRepo';
import { trySaveTasks, markTasksCanceled as markTasksAsCanceled } from '../utils';
import { isCorporateParty, isTaskAllowedOnCorporateParties, isTaskAllowedOnPartyWorkflow } from '../../../../common/helpers/party-utils';
import { now } from '../../../../common/helpers/moment-utils';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'SendRenewalReminder' });

const createTasks = async (ctx, partiesData) => {
  const partyIds = partiesData.map(item => item.id);
  logger.trace({ ctx, partyIds }, 'SendRenewalReminder - createTasks - partyIds');
  const parties = await loadPartiesByIds(ctx, partyIds);
  const taskAllowed = isTaskAllowedOnCorporateParties(DALTypes.TaskNames.SEND_RENEWAL_REMINDER);

  const newTasks = parties
    .filter(
      party =>
        (!isCorporateParty(party) || taskAllowed) &&
        isTaskAllowedOnPartyWorkflow({
          taskName: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          partyWorkflowName: party.workflowName,
          partyWorkflowState: party.workflowState,
        }),
    )
    .map(party => ({
      id: newUUID(),
      name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
      category: DALTypes.TaskCategories.INACTIVE,
      partyId: party.id,
      userIds: [party.userId],
      state: DALTypes.TaskStates.ACTIVE,
      dueDate: now().add(1, 'days').toDate(),
    }));

  logger.trace({ ctx, newTasks }, 'SendRenewalReminder - createTasks - newTasks');
  const savedTasks = await trySaveTasks(ctx, newTasks);
  logger.trace({ ctx, savedTasks }, 'SendRenewalReminder - createTasks - savedTasks');
  return savedTasks;
};

export const processTaskDefinition = async ctx => {
  logger.trace({ ctx }, 'SendRenewalReminder - processTaskDefinition');
  const eligibleParties = await getRenewalReminderEligibleParties(ctx);
  return eligibleParties.length ? createTasks(ctx, eligibleParties) : [];
};

const getTasksToUpdate = async (ctx, partyIds) => {
  logger.trace({ ctx, partyIds }, 'SendRenewalReminder - getTasksToUpdate');
  const followupTasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
  return followupTasks.filter(task => task.state === DALTypes.TaskStates.ACTIVE);
};

export const markTasksCanceled = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'SendRenewalReminder - markTasksCanceled');
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return await markTasksAsCanceled(ctx, tasksToUpdate);
};

export const sendRenewalReminder = {
  name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
  category: DALTypes.TaskCategories.INACTIVE,
  processTaskDefinition,
  markTasksCanceled,
};
