/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import { isDateInThePast } from './date-utils';
import { DALTypes } from '../enums/DALTypes';
import { now, toMoment } from './moment-utils';
import { isRevaAdmin } from './auth';

const getResidents = lease => lease.baselineData?.residents || [];
const getOccupants = lease => lease.baselineData?.occupants || [];
const getGuarantors = lease => lease.baselineData?.guarantors || [];

const getMembersByFilters = (lease, includeGuarantors = true, includeOccupants = true) => {
  const result = getResidents(lease);
  includeOccupants && result.concat(getOccupants(lease));
  includeGuarantors && result.concat(getGuarantors(lease));
  return result;
};

const getLeaseCompanyName = lease => lease?.baselineData?.companyName;

export const getMembersWithModifiedCompanyName = (lease, partyMembers) => {
  const result = [];
  const companyName = getLeaseCompanyName(lease);
  const [pointOfContact] = partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT);

  if (companyName !== pointOfContact?.displayName) {
    result.push({ oldName: companyName, newName: pointOfContact?.displayName });
  }

  return result;
};

export const getMembersWithModifiedNames = (lease, partyMembers) => {
  const result = [];
  const leaseMembers = getMembersByFilters(lease);
  partyMembers.forEach(pm => {
    const matchingLeaseMember = leaseMembers.find(l => pm.id === l.id);
    matchingLeaseMember && matchingLeaseMember.name !== pm.fullName && result.push({ oldName: matchingLeaseMember.name, newName: pm.fullName });
  });

  return result;
};

export const getMembersWithModifiedEmails = (lease, partyMembers) => {
  const result = [];
  const leaseMembers = getResidents(lease);

  partyMembers.forEach(pm => {
    const matchingLeaseMember = leaseMembers.find(l => pm.id === l.id);
    matchingLeaseMember && matchingLeaseMember.email !== pm.contactInfo.defaultEmail && result.push(pm.fullName);
  });

  return result;
};

export const hasPartyMemberNumberChanged = (lease, partyMembers) => {
  const partyMemberIds = partyMembers.map(pm => pm.id);
  const leaseMembersIds = getMembersByFilters(lease, true, false).map(m => m.id);

  return !leaseMembersIds.every(l => partyMemberIds.includes(l));
};

export const checkHasLeaseStarted = (lease, timezone) => {
  const { publishedLease = {} } = (lease && lease.baselineData) || {};
  return publishedLease && isDateInThePast(publishedLease.leaseStartDate, { timezone });
};

const envelopeIdSeparator = '-';

export const buildBluemoonEnvelopeId = (bmLeaseId, bmESignId) => `${bmLeaseId}${envelopeIdSeparator}${bmESignId}`;
export const extractFromBluemoonEnvelopeId = envelopeId => {
  const values = envelopeId.split(envelopeIdSeparator);
  return { bmLeaseId: values[0], bmESignId: values[1] };
};

export const shouldShowLeaseWarningCheck = (lease, party) => {
  const partyMembers = party.partyMembers;
  const wereMembersNamesModified = getMembersWithModifiedNames(lease, partyMembers).length > 0;
  const wasPartyCompositionModified = hasPartyMemberNumberChanged(lease, partyMembers);
  const wereMemberEmailsChanged = getMembersWithModifiedEmails(lease, partyMembers).length > 0;
  const wasCompanyNameChanged = party.leaseType === DALTypes.LeaseType.CORPORATE && getMembersWithModifiedCompanyName(lease, partyMembers).length > 0;
  return wereMembersNamesModified || wereMemberEmailsChanged || wasPartyCompositionModified || wasCompanyNameChanged;
};

export const canVoidLease = (lease, user = {}) => {
  if (lease.status !== DALTypes.LeaseStatus.EXECUTED) return true;
  const {
    baselineData: { publishedLease, timezone },
  } = lease;
  const { leaseStartDate } = publishedLease;
  const leaseStartDateMoment = toMoment(leaseStartDate, { timezone });
  const nowDate = now({ timezone });
  const isValidLeaseStartDate = leaseStartDateMoment.isSameOrAfter(nowDate, 'day');

  return isValidLeaseStartDate || isRevaAdmin(user);
};

export const isSignatureStatusSigned = status => [DALTypes.LeaseSignatureStatus.SIGNED, DALTypes.LeaseSignatureStatus.WET_SIGNED].includes(status);

export const getVoidLeaseEmailRecipients = signatures =>
  signatures
    .filter(s => s.partyMemberId && [DALTypes.LeaseSignatureStatus.SIGNED, DALTypes.LeaseSignatureStatus.SENT].includes(s.status))
    .map(s => s.partyMemberId);

export const allMembersSigned = (partyMembers, signatures) => {
  const partyMemberIds = partyMembers.map(resident => resident.id);

  const partyMembersThatSigned = signatures
    .filter(signature => isSignatureStatusSigned(signature.status))
    .filter(signature => signature.partyMemberId)
    .map(signature => signature.partyMemberId);

  return difference(partyMemberIds, partyMembersThatSigned).length === 0;
};

export const allMembersWetSignedByEnvelopeId = (envelopeId, signatures) => {
  const signaturesByEnvelopeId = signatures.filter(s => s.envelopeId === envelopeId && s.partyMemberId);

  return signaturesByEnvelopeId.every(signature => signature.status === DALTypes.LeaseSignatureStatus.WET_SIGNED);
};
