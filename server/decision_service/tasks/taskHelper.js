/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { isTaskAllowedOnPartyWorkflow } from '../../../common/helpers/party-utils';

export const findEvent = (partyDocument, eventName) => partyDocument.events.find(ev => ev.event === eventName);

export const findEvents = (partyDocument, eventNames) => partyDocument.events.filter(ev => eventNames.includes(ev.event));

export const getActiveTasks = (partyDocument, name) =>
  (partyDocument.tasks || []).filter(task => task.name === name && task.state === DALTypes.TaskStates.ACTIVE);

export const getCompletedTasks = (partyDocument, name) =>
  (partyDocument.tasks || []).filter(task => task.name === name && task.state === DALTypes.TaskStates.COMPLETED);

export const markTasksAsComplete = (ctx, tasks) =>
  tasks.map(task => ({
    ...task,
    state: DALTypes.TaskStates.COMPLETED,
    completionDate: new Date(),
    metadata: { completedBy: ctx.userId || DALTypes.CreatedByType.SYSTEM },
  }));

export const shouldProcessTaskOnPartyWorkflow = (party, taskName) => {
  const partyWorkflowData = {
    taskName,
    partyWorkflowName: party.workflowName,
    partyWorkflowState: party.workflowState,
  };

  return isTaskAllowedOnPartyWorkflow(partyWorkflowData);
};

export const getQuotePromotionsByStatus = ({ promotions = [] }, promotionStatus) => promotions.find(p => p.promotionStatus === promotionStatus);
