/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { savePartyEvent } from '../dal/partyEventsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'partyEventService' });
const { PartyEventType } = DALTypes;

export const saveEvent = async (ctx, partyEvent, eventType) => {
  logger.trace({ ctx, partyEvent, eventType }, 'savePartyEvent');
  await savePartyEvent(ctx, {
    event: eventType,
    ...partyEvent,
    requestIds: [ctx.reqId, ...(ctx.originalRequestIds || [])],
  });
};

export const savePartyCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_CREATED);

export const savePartyUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_UPDATED);

export const savePartyClosedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_CLOSED);

export const savePartyArchivedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_ARCHIVED);

export const savePartyReopenedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_REOPENED);

export const savePartyMergedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MERGED);

export const savePartyStateChangedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_STATE_CHANGED);

export const savePartyScoreChangedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_SCORE_CHANGED);

export const savePartyOwnerChanged = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_OWNER_CHANGED);

export const savePartyMemberAddedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MEMBER_ADDED);

export const savePartyMemberUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MEMBER_UPDATED);

export const savePartyMemberLinkedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MEMBER_LINKED);

export const savePartyMemberTypeUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MEMBER_TYPE_UPDATED);

export const savePartyMemberRemovedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_MEMBER_REMOVED);

export const savePartyReassignedPropertyEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_REASSIGNED_PROPERTY);

export const saveAppointmentCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPOINTMENT_CREATED);

export const saveAppointmentCompletedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPOINTMENT_COMPLETED);

export const saveAppointmentCanceledEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPOINTMENT_CANCELED);

export const saveAppointmentUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPOINTMENT_UPDATED);

export const saveQuoteCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.QUOTE_CREATED);

export const saveQuotePublishedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.QUOTE_PUBLISHED);

export const saveApplicationStatusUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPLICATION_STATUS_UPDATED);

export const saveApplicationTransactionUpdatedEvent = async (ctx, partyEvent) =>
  await saveEvent(ctx, partyEvent, PartyEventType.APPLICATION_TRANSACTION_UPDATED);

export const saveApplicationPaymentProcessedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.APPLICATION_PAYMENT_PROCESSED);

export const saveLeaseCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_CREATED);

export const saveLeaseRenewalCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_RENEWAL_CREATED);

export const saveRenewalMovingOutEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_RENEWAL_MOVING_OUT);

export const saveRenewalCancelMoveOutEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT);

export const saveLeasePublishedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_PUBLISHED);

export const saveLeaseVersionCreatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_VERSION_CREATED);

export const saveLeaseVoidedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_VOIDED);

export const saveLeaseSignedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_SIGNED);

export const saveLeaseCountersignedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_COUNTERSIGNED);

export const saveLeaseExecutedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_EXECUTED);

export const saveLeaseSentEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.LEASE_SENT);

const enhanceContactInfoPartyEvent = (partyEvent, contactInfo) => ({
  ...partyEvent,
  metadata: {
    ...partyEvent.metadata,
    contactInfoIds: contactInfo.map(ci => ci.id),
  },
});

export const saveContactInfoAddedEvent = async (ctx, partyEvent, contactInfo) =>
  await saveEvent(ctx, enhanceContactInfoPartyEvent(partyEvent, contactInfo), PartyEventType.CONTACT_INFO_ADDED);

export const saveContactInfoRemovedEvent = async (ctx, partyEvent, contactInfo) =>
  await saveEvent(ctx, enhanceContactInfoPartyEvent(partyEvent, contactInfo), PartyEventType.CONTACT_INFO_REMOVED);

export const savePersonUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PERSON_UPDATED);

export const saveCommunicationSentEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_SENT);

export const saveCommunicationReceivedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_RECEIVED);

export const saveCommunicationAddedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_ADDED);

export const saveMissedCallEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_MISSED_CALL);

export const saveAnsweredCallEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_ANSWERED_CALL);

export const savePaymentReceivedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PAYMENT_RECEIVED);

export const saveApplicantReportStatusUpdatedEvent = async (ctx, partyEvent) =>
  await saveEvent(ctx, partyEvent, PartyEventType.APPLICANT_REPORT_STATUS_UPDATED);

export const saveQuoteMailSentEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.QUOTE_SENT);

export const saveQuotePrintedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.QUOTE_PRINTED);

export const savePersonApplicationInviteEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PERSON_TO_PERSON_APPLICATION_INVITE);

export const savePersonsMergedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PERSONS_MERGED);

export const saveScreeningResponseProcessedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.SCREENING_RESPONSE_PROCESSED);

export const saveQuotePromotionUpdatedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.QUOTE_PROMOTION_UPDATED);

export const demoteApplicationEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.DEMOTE_APPLICATION);

export const savePersonApplicationMergedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PERSONS_APPLICATION_MERGED);

export const saveCustomMessageEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.CUSTOM_MESSAGE);

export const saveCommunicationCompletedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.COMMUNICATION_COMPLETED);

export const saveUnitHeldEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.UNIT_HELD);

export const saveUnitReleasedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.UNIT_RELEASED);

export const saveReassignPartyFromInactiveTeamEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.PARTY_TEAM_REASSIGNED);

export const saveServiceAnimalAddedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.SERVICE_ANIMAL_ADDED);

export const saveAllServiceAnimalsRemovedEvent = async (ctx, partyEvent) => await saveEvent(ctx, partyEvent, PartyEventType.ALL_SERVICE_ANIMALS_REMOVED);
