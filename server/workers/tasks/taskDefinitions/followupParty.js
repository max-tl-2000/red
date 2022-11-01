/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getFollowupPartyEligibleParties, getTasksForPartiesByName } from '../../../dal/tasksRepo';
import { loadPartiesByIds } from '../../../dal/partyRepo';
import { trySaveTasks, markTasksCompleted as markTasksAsCompleted, markTasksCanceled as markTasksAsCanceled } from '../utils';
import { isCorporateParty, isTaskAllowedOnCorporateParties, isTaskAllowedOnPartyWorkflow } from '../../../../common/helpers/party-utils';
import { now } from '../../../../common/helpers/moment-utils';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'FollowupParty' });

const createTasks = async (ctx, partiesData) => {
  const partyIds = partiesData.map(item => item.id);
  logger.debug({ ctx, partyIds }, 'FollowupParty - createTasks - partyIds');
  const parties = await loadPartiesByIds(ctx, partyIds);
  const taskAllowed = isTaskAllowedOnCorporateParties(DALTypes.TaskNames.FOLLOWUP_PARTY);

  const newTasks = parties
    .filter(
      party =>
        (!isCorporateParty(party) || taskAllowed) &&
        isTaskAllowedOnPartyWorkflow({
          taskName: DALTypes.TaskNames.FOLLOWUP_PARTY,
          partyWorkflowName: party.workflowName,
          partyWorkflowState: party.workflowState,
        }),
    )
    .map(party => ({
      id: newUUID(),
      name: DALTypes.TaskNames.FOLLOWUP_PARTY,
      category: DALTypes.TaskCategories.INACTIVE,
      partyId: party.id,
      userIds: [party.userId],
      state: DALTypes.TaskStates.ACTIVE,
      dueDate: now() // TODO: ask Cluj, do we need timezone here
        .add(2 - 1, 'days')
        .toDate(), // TODO add to a config
    }));

  logger.debug({ ctx, newTasks }, 'FollowupParty - createTasks - newTasks');
  const savedTasks = await trySaveTasks(ctx, newTasks);
  logger.debug({ ctx, savedTasks }, 'FollowupParty - createTasks - savedTasks');
  return savedTasks;
};

export const processTaskDefinition = async (ctx, partyIds = []) => {
  logger.debug({ ctx, partyIds }, 'FollowupParty - processTaskDefinition');
  const eligibleParties = await getFollowupPartyEligibleParties(ctx, partyIds);
  return eligibleParties.length ? createTasks(ctx, eligibleParties) : [];
};

const getTasksToUpdate = async (ctx, partyIds) => {
  logger.debug({ ctx, partyIds }, 'FollowupParty - getTasksToUpdate');
  const followupTasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.FOLLOWUP_PARTY);
  return followupTasks.filter(task => task.state === DALTypes.TaskStates.ACTIVE);
};

export const markTasksCompleted = async (ctx, partyIds) => {
  logger.debug({ ctx, partyIds }, 'FollowupParty - markTasksCompleted');
  const tasksToUpdate = await getTasksToUpdate(ctx, partyIds);
  return await markTasksAsCompleted(ctx, tasksToUpdate);
};

export const markTasksCanceled = async (ctx, partyId) => {
  logger.debug({ ctx, partyId }, 'FollowupParty - markTasksCanceled');
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return await markTasksAsCanceled(ctx, tasksToUpdate);
};

export const followupParty = {
  name: DALTypes.TaskNames.FOLLOWUP_PARTY,
  category: DALTypes.TaskCategories.INACTIVE,
  processTaskDefinition,
  markTasksCompleted,
  markTasksCanceled,
};
