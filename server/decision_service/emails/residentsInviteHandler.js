/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import difference from 'lodash/difference';
import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import { isSignatureStatusSigned } from '../../../common/helpers/lease';
import { CommunicationContext } from '../../../common/enums/communicationTypes';
import ResidentInvitationActions from '../../../common/enums/residentInvitationActions';
import { getUsersAccessedProperties } from '../../../auth/server/dal/common-user-repo';

const isLeaseSignedByAllPartyMembers = (party, leaseSignedEvent) => {
  const activeResidents = party.members.filter(
    ({ partyMember }) => [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.GUARANTOR].includes(partyMember.memberType) && !partyMember.endDate,
  );
  const partyMemberIds = activeResidents.map(({ partyMember }) => partyMember.id);

  const lease = party.leases.find(l => l.id === leaseSignedEvent.metadata?.leaseId);

  const partyMembersThatSigned = lease.signatures
    .filter(signature => isSignatureStatusSigned(signature.status))
    .filter(signature => signature.partyMemberId)
    .map(signature => signature.partyMemberId);

  return difference(partyMemberIds, partyMembersThatSigned).length === 0;
};

const getResidentsWhoDidNotAccesTheApp = async (ctx, { personIds, propertyId }) => {
  const excludedPersonIds = await getUsersAccessedProperties(ctx, { personIds, propertyId });
  return difference(personIds, excludedPersonIds);
};

const excludeResidentsWithReceivedInvite = (party, personIds) => {
  const residentInviteCommunications = (party.comms || []).filter(c => c.category === DALTypes.CommunicationCategory.RESIDENT_INVITE);
  const personIdsFromComm = uniq(flatten(residentInviteCommunications.map(comm => comm.persons)));
  return difference(personIds, personIdsFromComm);
};

const getPersonsIdsForEmailReceiving = async (ctx, party) => {
  const activeResidents = party.members.filter(({ partyMember }) => partyMember.memberType === DALTypes.MemberType.RESIDENT && !partyMember.endDate);
  const personIds = activeResidents.map(({ partyMember }) => partyMember.personId);

  const filteredPersonIds = excludeResidentsWithReceivedInvite(party, personIds);

  const residentsWhoDidNotAccessTheApp = await getResidentsWhoDidNotAccesTheApp(ctx, { personIds, propertyId: party.assignedPropertyId });
  return uniq([...residentsWhoDidNotAccessTheApp, ...filteredPersonIds]);
};

export const processResidentsInviteEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process residents invite events');

  const leaseSignedEvent = party.events.find(ev => DALTypes.PartyEventType.LEASE_SIGNED === ev.event);
  const partyCreatedEvent = party.events.find(ev => DALTypes.PartyEventType.PARTY_CREATED === ev.event);
  if (!leaseSignedEvent && !partyCreatedEvent) return {};

  const sendResidentsInviteEmailEnabled = party.property[0].app?.autoInvite;
  if (!sendResidentsInviteEmailEnabled) return {};

  if (leaseSignedEvent) {
    if (party.leaseType !== DALTypes.PartyTypes.TRADITIONAL) return {};
    const isLeaseSignedByAllMembers = isLeaseSignedByAllPartyMembers(party, leaseSignedEvent);
    if (!isLeaseSignedByAllMembers) return {};
  }

  if (partyCreatedEvent) {
    const shouldSendAtNewPartyCreation = partyCreatedEvent.metadata?.sendResidentsInvite;
    if (!shouldSendAtNewPartyCreation) return {};
  }

  const personIdsToSendComm = await getPersonsIdsForEmailReceiving(ctx, party);
  if (!personIdsToSendComm.length) return {};

  return {
    emailInfo: {
      partyId: party.id,
      propertyId: party.assignedPropertyId,
      section: 'CONSUMER_ACCOUNT',
      actions: { newResidentInvite: ResidentInvitationActions.NEW_RESIDENT_REGISTRATION, invite: ResidentInvitationActions.RESIDENT_INVITATION },
      personIds: personIdsToSendComm,
      type: leaseSignedEvent?.event || partyCreatedEvent?.event,
      context: CommunicationContext.PREFER_EMAIL,
      communicationCategory: DALTypes.CommunicationCategory.RESIDENT_INVITE,
    },
  };
};
