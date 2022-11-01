/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import logger from '../../../../common/helpers/logger';
import { isCorporateParty, isTaskAllowedOnCorporateParties, hasActiveQuotePromotion } from '../../../../common/helpers/party-utils';
import { allPartyMembersHavePersonApplication } from '../../../../rentapp/server/screening/utils';
import { findEvent, getActiveTasks, findEvents, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';
import { FADV_RESPONSE_STATUS } from '../../../../rentapp/common/screening-constants';

const { PartyEventType, TaskNames, TaskStates, TaskCategories } = DALTypes;

const eventsFireForCreateTask = [
  PartyEventType.LEASE_VOIDED,
  PartyEventType.PERSONS_MERGED,
  PartyEventType.PERSONS_APPLICATION_MERGED,
  PartyEventType.PARTY_UPDATED,
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.SCREENING_RESPONSE_PROCESSED,
];

const eventsFireForCompleteTask = [PartyEventType.QUOTE_PROMOTION_UPDATED];

const eventsFireForCancelTask = [
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_UPDATED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PERSONS_APPLICATION_MERGED,
];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const excludePersonsApplicationsForInactiveMembers = (personApplications, activePartyMembers) => {
  const personIds = activePartyMembers.map(member => member.personId);
  return personApplications.filter(application => personIds.includes(application.personId));
};

const areAllScreeningsCompleted = screeningResults => {
  const { submissionRequests, submissionResponses } = screeningResults;

  if (!submissionRequests?.length || !submissionResponses?.length) return false;
  const requests = uniqBy(
    submissionRequests.filter(submissionRequest => submissionRequest.rentData),
    'id',
  );
  const completedResponses = submissionResponses.filter(submissionResponse => submissionResponse.status === FADV_RESPONSE_STATUS.COMPLETE);

  return requests.every(req => completedResponses.find(response => response.submissionRequestId === req.id));
};

const areAllPersonAppsCompleted = party => {
  const { personApplications, members } = party;

  const activeMembers = members && members.length && members.filter(({ partyMember }) => !partyMember.endDate);
  const partyMembers = flatten(activeMembers.map(member => member.partyMember));
  if (!partyMembers || !personApplications) return false;
  if (!partyMembers.length || !personApplications.length) return false;

  const activePersonApplications = excludePersonsApplicationsForInactiveMembers(personApplications, partyMembers);

  const result =
    allPartyMembersHavePersonApplication(partyMembers, activePersonApplications) &&
    activePersonApplications.every(app => app.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED);

  return result;
};

const shouldCreatePartyPromotionTask = party => {
  const { screeningResults } = party;

  const arePersonApplicationsCompleted = areAllPersonAppsCompleted(party);
  const areScreeningsCompleted = areAllScreeningsCompleted(screeningResults);

  return arePersonApplicationsCompleted && areScreeningsCompleted;
};

const createTasks = async (ctx, party) => {
  if (!shouldExecuteTask(eventsFireForCreateTask, party)) return [];

  const applicationStatusUpdatedEvent = findEvent(party, PartyEventType.APPLICATION_STATUS_UPDATED);
  const isContactApplicationDeclinedTaskCreated = applicationStatusUpdatedEvent?.metadata?.createDeclinedTask;
  if (isContactApplicationDeclinedTaskCreated) return [];

  const activeTaskExists = getActiveTasks(party, TaskNames.PROMOTE_APPLICATION);
  const quotePromotions = party.promotions || [];
  if (activeTaskExists.length || hasActiveQuotePromotion(quotePromotions, party.id)) return [];

  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.PROMOTE_APPLICATION)) return [];

  const partyUpdatedEvent = findEvent(party, PartyEventType.PARTY_UPDATED);
  const shouldCreatePromoteApplicationTask = partyUpdatedEvent && partyUpdatedEvent.metadata && partyUpdatedEvent.metadata.handlePromoteApplicationTask;
  if (partyUpdatedEvent && !shouldCreatePromoteApplicationTask) return [];

  const eventsWithAdditionalData = findEvents(party, [PartyEventType.LEASE_VOIDED, PartyEventType.PERSONS_APPLICATION_MERGED]);
  const appsCompleted = areAllPersonAppsCompleted(party);

  const shouldHandleTask = eventsWithAdditionalData?.some(event => event.metadata && event.metadata.handlePromoteApplicationTask);

  const shouldCreateTask = eventsWithAdditionalData?.length ? shouldHandleTask && appsCompleted : shouldCreatePartyPromotionTask(party);

  if (!shouldCreateTask) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.PROMOTE_APPLICATION)) return [];

  const newTask = {
    id: getUUID(),
    name: TaskNames.PROMOTE_APPLICATION,
    category: TaskCategories.APPLICATION_APPROVAL,
    partyId: party.id,
    userIds: [party.userId],
    state: TaskStates.ACTIVE,
    dueDate: now().toDate(),
  };
  logger.trace({ ctx, newTask }, 'Create promote application task');
  return [newTask];
};

const completeTasks = async (ctx, party) => {
  if (!party.events || !party.events.length) return [];
  if (!shouldExecuteTask(eventsFireForCompleteTask, party)) return [];

  const activeTasks = getActiveTasks(party, TaskNames.PROMOTE_APPLICATION);
  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Complete promote application task');
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

  const partyUpdatedEvent = findEvent(party, PartyEventType.PARTY_UPDATED);
  const shouldCancelPromoteApplicationTask = partyUpdatedEvent && partyUpdatedEvent.metadata && partyUpdatedEvent.metadata.handlePromoteApplicationTask;
  if (partyUpdatedEvent && !shouldCancelPromoteApplicationTask && !isCorporateParty(party)) return [];

  const activeTasks = getActiveTasks(party, TaskNames.PROMOTE_APPLICATION);
  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Cancel promote application task');
    return { ...task, state: TaskStates.CANCELED };
  });
};

export const promoteApplication = {
  name: TaskNames.PROMOTE_APPLICATION,
  category: TaskCategories.APPLICATION_APPROVAL,
  createTasks,
  completeTasks,
  cancelTasks,
};
