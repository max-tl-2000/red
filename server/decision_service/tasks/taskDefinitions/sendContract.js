/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import concat from 'lodash/concat';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import logger from '../../../../common/helpers/logger';
import { getActiveTasks, findEvent, findEvents, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';
import { getUserIdsWithFunctionalRolesForProperty } from '../../../dal/usersRepo';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { isCorporateParty, isTaskAllowedOnCorporateParties } from '../../../../common/helpers/party-utils';
import { addAssociatedIdToActiveTaskMetadata } from '../../../workers/tasks/utils';

const { PartyEventType, TaskNames, TaskStates, TaskCategories, PromotionStatus, LeaseSignatureStatus } = DALTypes;

const eventsFireForCreateTask = [PartyEventType.QUOTE_PROMOTION_UPDATED];

const eventsFireForCompleteTask = [PartyEventType.LEASE_SENT, PartyEventType.LEASE_VOIDED, PartyEventType.LEASE_SIGNED];

const eventsFireForCancelTask = [PartyEventType.PARTY_CLOSED, PartyEventType.LEASE_VOIDED, PartyEventType.PARTY_ARCHIVED];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const isNotSentLease = ({ signatures, status }) => {
  if (!signatures || !signatures.length) return status !== DALTypes.LeaseStatus.VOIDED;

  const excludedStates = [LeaseSignatureStatus.SENT, LeaseSignatureStatus.SIGNED, LeaseSignatureStatus.WET_SIGNED, LeaseSignatureStatus.VOIDED];
  return signatures.some(signature => signature.partyMemberId && !excludedStates.includes(signature.status));
};

export const hasNotSentLeasesOnCorporateParties = party => {
  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(TaskNames.SEND_CONTRACT)) return false;

  return party.leases?.length && party.leases.some(isNotSentLease);
};

const isQuotePromotionApproved = (party, quotePromotionId) =>
  party?.promotions?.some(promotion => promotion.id === quotePromotionId && promotion.promotionStatus === PromotionStatus.APPROVED);

const getLeaseSignaturesByLeaseId = (party, leaseId) => {
  const lease = party?.leases?.find(l => l.id === leaseId);

  return lease?.signatures;
};

const atLeastOneLeaseSignatureIsMailed = party => {
  const [partyEvent] = findEvents(party, eventsFireForCompleteTask);
  const leaseId = partyEvent?.metadata?.leaseId;
  if (!leaseId) return false;

  const leaseSignatures = getLeaseSignaturesByLeaseId(party, leaseId);
  const signaturesMailed =
    leaseSignatures &&
    leaseSignatures.filter(
      s => s.partyMemberId && [LeaseSignatureStatus.SENT, LeaseSignatureStatus.SIGNED, LeaseSignatureStatus.WET_SIGNED].includes(s.status),
    );
  return !!signaturesMailed && !!signaturesMailed.length;
};

const isLeaseIdInTask = (partyEvent, activeTasks) => {
  const leaseId = partyEvent && partyEvent.metadata && partyEvent.metadata.leaseId;
  return leaseId && activeTasks?.length && activeTasks[0].metadata?.leases?.includes(leaseId);
};

const createTasks = async (ctx, party) => {
  if (!shouldExecuteTask(eventsFireForCreateTask, party)) return [];
  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.SEND_CONTRACT)) return [];

  const quotePromotionUpdatedEvent = findEvent(party, PartyEventType.QUOTE_PROMOTION_UPDATED);
  const { quotePromotionId, leaseId } = quotePromotionUpdatedEvent.metadata;
  if (!isQuotePromotionApproved(party, quotePromotionId)) return [];

  const [activeTask] = getActiveTasks(party, TaskNames.SEND_CONTRACT);
  if (leaseId && activeTask) {
    if (!activeTask?.metadata?.leases?.some(id => id === leaseId)) {
      await addAssociatedIdToActiveTaskMetadata(ctx, activeTask, leaseId, 'leases');
      return [];
    }
  }

  const userIds = await getUserIdsWithFunctionalRolesForProperty(ctx, party.id, FunctionalRoleDefinition.LAA.name, party.assignedPropertyId);

  const newTask = {
    id: getUUID(),
    name: TaskNames.SEND_CONTRACT,
    category: TaskCategories.CONTRACT_SIGNING,
    partyId: party.id,
    userIds: concat(party.userId, userIds),
    state: TaskStates.ACTIVE,
    dueDate: now().toDate(),
    metadata: {
      ...(leaseId ? { leases: [leaseId] } : {}),
    },
  };
  logger.trace({ ctx, newTask }, 'Create send contract task');
  return [newTask];
};

const completeTasks = async (ctx, party) => {
  if (!party.events || !party.events.length) return [];
  if (!shouldExecuteTask(eventsFireForCompleteTask, party)) return [];

  if (!atLeastOneLeaseSignatureIsMailed(party) || hasNotSentLeasesOnCorporateParties(party)) return [];

  const [partyEvent] = findEvents(party, eventsFireForCompleteTask);
  const activeTasks = getActiveTasks(party, TaskNames.SEND_CONTRACT);
  if (!isLeaseIdInTask(partyEvent, activeTasks)) return [];

  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Complete send contract task');
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

  if (atLeastOneLeaseSignatureIsMailed(party) || hasNotSentLeasesOnCorporateParties(party)) return [];

  const leaseVoidedEvent = findEvent(party, PartyEventType.LEASE_VOIDED);
  const activeTasks = getActiveTasks(party, TaskNames.SEND_CONTRACT);
  if (leaseVoidedEvent && !isLeaseIdInTask(leaseVoidedEvent, activeTasks)) return [];

  return activeTasks.map(task => {
    logger.trace({ ctx, task }, 'Cancel send contract task');
    return { ...task, state: TaskStates.CANCELED };
  });
};

export const sendContract = {
  name: DALTypes.TaskNames.SEND_CONTRACT,
  category: DALTypes.TaskCategories.CONTRACT_SIGNING,
  createTasks,
  completeTasks,
  cancelTasks,
};
