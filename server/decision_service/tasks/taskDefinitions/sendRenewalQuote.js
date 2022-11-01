/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { getActiveTasks, getCompletedTasks, findEvent, shouldProcessTaskOnPartyWorkflow } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates, TaskCategories, ActiveLeaseState } = DALTypes;

const eventsFiredForCreateTask = [PartyEventType.LEASE_RENEWAL_CREATED, PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT, PartyEventType.QUOTE_PUBLISHED];

const eventsFiredForCompleteTask = [PartyEventType.COMMUNICATION_ADDED, PartyEventType.QUOTE_PRINTED];

const eventsFiredForCancelTask = [
  PartyEventType.LEASE_RENEWAL_MOVING_OUT,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.LEASE_CREATED,
  PartyEventType.PARTY_CLOSED,
];

const shouldExecuteTask = (eventsWillFireTask, party) => party.events.some(ev => eventsWillFireTask.includes(ev.event));

const isQuotePrinted = party => party.events.some(ev => ev.event === PartyEventType.QUOTE_PRINTED);

const createTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'sendRenewalQuote - createTask');
  if (!shouldProcessTaskOnPartyWorkflow(party, TaskNames.SEND_RENEWAL_QUOTE)) return [];
  if (!shouldExecuteTask(eventsFiredForCreateTask, party)) return [];

  const [activeSendRenewalQuoteTask] = getActiveTasks(party, TaskNames.SEND_RENEWAL_QUOTE);
  if (activeSendRenewalQuoteTask) return [];

  const hasPartyCancelMoveOutEvent = findEvent(party, PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT);
  const hasCompletedSendRenewalTask = getCompletedTasks(party, TaskNames.SEND_RENEWAL_QUOTE).length;
  if (hasPartyCancelMoveOutEvent && hasCompletedSendRenewalTask) return [];

  const task = {
    name: TaskNames.SEND_RENEWAL_QUOTE,
    category: TaskCategories.QUOTE,
    partyId: party.id,
    userIds: [party.userId],
    state: TaskStates.ACTIVE,
    dueDate: now().toDate(),
    metadata: {
      externalId: getUUID(),
      unique: true,
    },
  };
  logger.trace({ ctx, task }, 'CreateSendRenewalQuote');
  return [task];
};

const getMostRecentQuote = quotes => (quotes?.length ? quotes.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0] : undefined);

const isQuoteSentToAllPartyMembers = party => {
  const { comms, members, quotes } = party;

  const lastQuote = getMostRecentQuote(quotes);
  const quoteCommunications = comms?.filter(
    comm =>
      comm.category === DALTypes.CommunicationCategory.QUOTE &&
      comm.direction === DALTypes.CommunicationDirection.OUT &&
      lastQuote.id === comm?.message?.quoteId,
  );
  const personIdsWithReceivedQuoteComm = quoteCommunications ? quoteCommunications.reduce((acc, comm) => acc.concat(comm.persons), []) : [];

  const activeResidents = members.filter(({ partyMember }) => !partyMember.endDate && partyMember.memberType === DALTypes.MemberType.RESIDENT);
  const residentsPersonIds = activeResidents.map(({ partyMember }) => partyMember.personId);

  const membersWithoutQuoteComm = residentsPersonIds.filter(personId => !personIdsWithReceivedQuoteComm.includes(personId));
  return residentsPersonIds.length && !membersWithoutQuoteComm.length;
};

const completeTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'sendRenewalQuote - completeTask');

  if (!shouldExecuteTask(eventsFiredForCompleteTask, party)) return [];

  const [activeSendRenewalQuoteTask] = getActiveTasks(party, TaskNames.SEND_RENEWAL_QUOTE);

  if (!activeSendRenewalQuoteTask) return [];

  if (!isQuoteSentToAllPartyMembers(party) && !isQuotePrinted(party)) return [];

  logger.trace({ ctx, activeSendRenewalQuoteTask }, 'CompleteSendRenewalQuote');
  const completedTask = {
    ...activeSendRenewalQuoteTask,
    state: TaskStates.COMPLETED,
    completionDate: new Date(),
    metadata: {
      completedBy: ctx.userId || DALTypes.CreatedByType.SYSTEM,
    },
  };
  return [completedTask];
};

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'sendRenewalQuote - cancelTask');
  if (!shouldExecuteTask(eventsFiredForCancelTask, party)) return [];

  const activeSendRenewalQuoteTasks = getActiveTasks(party, TaskNames.SEND_RENEWAL_QUOTE);
  if (!activeSendRenewalQuoteTasks.length) return [];

  const [activeLeaseData] = party.activeLeaseData;
  const isPartyMovingOut = activeLeaseData.state === ActiveLeaseState.MOVING_OUT;
  const leaseRenewalMovingOutEvent = findEvent(party, PartyEventType.LEASE_RENEWAL_MOVING_OUT);
  if (leaseRenewalMovingOutEvent && !isPartyMovingOut) return [];

  logger.trace({ ctx, activeSendRenewalQuoteTasks }, 'CancelSendRenewalQuote');
  const canceledTasks = activeSendRenewalQuoteTasks.map(t => ({ ...t, state: TaskStates.CANCELED }));
  return canceledTasks;
};

export const sendRenewalQuote = {
  name: TaskNames.SEND_RENEWAL_QUOTE,
  category: TaskCategories.QUOTE,
  createTasks,
  completeTasks,
  cancelTasks,
};
