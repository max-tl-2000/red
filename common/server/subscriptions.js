/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';

const { PartyEventType } = DALTypes;

export const commEvents = [PartyEventType.COMMUNICATION_COMPLETED];

export const taskEvents = [PartyEventType.TASK_ADDED, PartyEventType.TASK_UPDATED];

export const customEvents = [PartyEventType.CUSTOM_MESSAGE];

export const applicationStatusEvents = [PartyEventType.APPLICATION_STATUS_UPDATED];

export const partyWorflowStateEvents = [PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

export const partyEvents = [PartyEventType.PARTY_UPDATED];

export const quoteEvents = [PartyEventType.QUOTE_PRINTED];

export const leasingEvents = [
  PartyEventType.LEASE_COUNTERSIGNED,
  PartyEventType.LEASE_VOIDED,
  PartyEventType.LEASE_RENEWAL_CREATED,
  PartyEventType.LEASE_PUBLISHED,
  PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT,
  PartyEventType.LEASE_RENEWAL_MOVING_OUT,
  PartyEventType.LEASE_CREATED,
];

export const partyMemberEvents = [
  PartyEventType.CONTACT_INFO_REMOVED,
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.CONTACT_INFO_ADDED,
  PartyEventType.PERSON_UPDATED,
];

export const corticonEvents = [
  ...commEvents,
  ...taskEvents,
  ...customEvents,
  ...applicationStatusEvents,
  ...partyWorflowStateEvents,
  ...partyEvents,
  ...leasingEvents,
  ...partyMemberEvents,
  ...quoteEvents,
];
