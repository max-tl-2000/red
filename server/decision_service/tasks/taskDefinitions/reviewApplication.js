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
import { isCorporateParty, isTaskAllowedOnCorporateParties } from '../../../../common/helpers/party-utils';
import { findEvent, getActiveTasks, getQuotePromotionsByStatus } from '../taskHelper';
import { getUserIdsWithFunctionalRolesForProperty } from '../../../dal/usersRepo';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

const { PartyEventType, TaskNames, TaskStates, TaskCategories } = DALTypes;

const eventsFireForCreateTask = [PartyEventType.QUOTE_PROMOTION_UPDATED];

const eventsFireForCompleteTask = [PartyEventType.APPLICATION_STATUS_UPDATED];

const eventsFireForCancelTask = [PartyEventType.DEMOTE_APPLICATION, PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const createTasks = async (ctx, party) => {
  if (!shouldExecuteTask(eventsFireForCreateTask, party)) return [];

  const activeTaskExists = getActiveTasks(party, TaskNames.REVIEW_APPLICATION);
  if (activeTaskExists.length) return [];

  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.REVIEW_APPLICATION)) return [];

  const partyUpdatedEvent = findEvent(party, PartyEventType.QUOTE_PROMOTION_UPDATED);
  const shouldCreateReviewApplicationTask = partyUpdatedEvent.metadata && partyUpdatedEvent.metadata.handleReviewApplicationTask;
  if (partyUpdatedEvent && !shouldCreateReviewApplicationTask) return [];

  const { id: partyId, assignedPropertyId } = party;
  const userIds = await getUserIdsWithFunctionalRolesForProperty(ctx, partyId, FunctionalRoleDefinition.LAA.name, assignedPropertyId);

  const quotePromotion = getQuotePromotionsByStatus(party, DALTypes.PromotionStatus.PENDING_APPROVAL);
  if (!quotePromotion) return [];

  const newTask = {
    id: getUUID(),
    name: TaskNames.REVIEW_APPLICATION,
    category: TaskCategories.APPLICATION_APPROVAL,
    partyId,
    userIds,
    state: TaskStates.ACTIVE,
    dueDate: now()
      .add(1 - 1, 'days')
      .toDate(),
    metadata: { quotePromotions: [quotePromotion.id] },
  };
  logger.trace({ ctx, newTask }, 'Create review application task');
  return [newTask];
};

const completeTasks = async (ctx, party) => {
  if (!party.events || !party.events.length) return [];
  if (!shouldExecuteTask(eventsFireForCompleteTask, party)) return [];

  const partyUpdatedEvent = findEvent(party, PartyEventType.APPLICATION_STATUS_UPDATED);
  const isApplicationUpdateFromUserAction = !!partyUpdatedEvent.userId;
  if (!isApplicationUpdateFromUserAction) return [];

  const activeTasks = getActiveTasks(party, TaskNames.REVIEW_APPLICATION);

  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Complete review application task');
    return {
      ...task,
      state: DALTypes.TaskStates.COMPLETED,
      completionDate: new Date(),
      metadata: { completedBy: ctx.userId || DALTypes.CreatedByType.SYSTEM },
    };
  });
};

const cancelTasks = async (ctx, party) => {
  if (!party.events || !party.events.length) return [];
  if (!shouldExecuteTask(eventsFireForCancelTask, party)) return [];

  const activeTasks = getActiveTasks(party, TaskNames.REVIEW_APPLICATION);
  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Cancel review application task');
    return { ...task, state: TaskStates.CANCELED };
  });
};

export const reviewApplication = {
  name: DALTypes.TaskNames.REVIEW_APPLICATION,
  category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
  requiredRoles: [FunctionalRoleDefinition.LAA.name],
  createTasks,
  completeTasks,
  cancelTasks,
};
