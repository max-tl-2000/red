/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getContactsInfoByEmail, getContactsInfoByPhone } from '../../../dal/contactInfoRepo';
import { getPersonsByFullName } from '../../../dal/personRepo';
import { getPartyMembersByPartyIds, loadPartyMemberById, getPartyAdditionalInfoByPartyId } from '../../../dal/partyRepo';
import { getActiveLeaseIdByInventoryId } from '../../../dal/activeLeaseWorkflowRepo';
import { getPrimaryExternalInfoByParty } from '../../../dal/exportRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getPersonByExternalIdMatch } from '../../../dal/import-repo';
import { formatPhoneNumberForDb } from '../../../helpers/phoneUtils';
import { getFormattedNamesForQuery, handleUpdatedExternalInfo, cleanAndFormatRevaName } from './helpers';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

export const checkIfChild = type => type === DALTypes.ExternalMemberType.CHILD;

export const checkMatchingPersonData = async (ctx, { email, phone, receivedResident, personId, externalId, isInitialImport }) => {
  let emailMatchFound;
  let contactInfosWithTheSamePhone = [];

  if (isInitialImport) {
    const matchedPersonByExternalId = externalId && (await getPersonByExternalIdMatch(ctx, externalId));

    if (matchedPersonByExternalId) {
      return { personMatchFound: matchedPersonByExternalId };
    }
  }

  if (email) {
    const emailCheckResult = await getContactsInfoByEmail(ctx, email);
    emailMatchFound = emailCheckResult.find(ci => ci.personId !== personId);
  }

  if (phone) {
    const phoneCheckResult = await getContactsInfoByPhone(ctx, phone);
    contactInfosWithTheSamePhone = phoneCheckResult.filter(ci => ci.personId !== personId);
  }

  const { nameWithMiddleInitial, nameWithoutMiddleInitial } = getFormattedNamesForQuery(receivedResident);
  const nameCheckResult = await getPersonsByFullName(ctx, nameWithMiddleInitial, nameWithoutMiddleInitial);
  const personsWithTheSameName = nameCheckResult ? nameCheckResult.filter(p => p.id !== personId) : [];

  const nameMatchFound = !!personsWithTheSameName.length;
  const phoneMatchFound = !!contactInfosWithTheSamePhone.length;
  const personMatchFound = emailMatchFound && nameMatchFound && personsWithTheSameName.find(p => p.id === emailMatchFound.personId);
  const nameAndPhoneMatchFound = contactInfosWithTheSamePhone.find(match => !!personsWithTheSameName.find(person => person.id === match.personId));

  const result = { emailMatchFound, phoneMatchFound, nameMatchFound, personMatchFound, nameAndPhoneMatchFound };
  logger.trace({ ctx, matchingPersonResult: result }, 'checkMatchingPersonData - result');
  return result;
};

export const checkMatchingPartyMember = (receivedMember, revaMembers, revaChildren) => {
  let matchedPartyMembers = [];

  const { nameWithMiddleInitial, nameWithoutMiddleInitial } = getFormattedNamesForQuery(receivedMember);
  const receivedFullName = nameWithMiddleInitial.replace(/%/g, ' ');
  if (checkIfChild(receivedMember.type)) {
    const matchedChild =
      !!revaChildren?.length &&
      revaChildren.filter(child => child?.info?.fullName && cleanAndFormatRevaName(child.info.fullName).toLowerCase() === receivedFullName?.toLowerCase())[0];
    return matchedChild?.id ? { isMemberMatched: true, childId: matchedChild?.id } : { isMemberMatched: false };
  }

  const receivedFullNameWithoutMiddleInitial = nameWithoutMiddleInitial.replace(/%/g, ' ');
  matchedPartyMembers = revaMembers.filter(
    revaMember =>
      revaMember.fullName &&
      (cleanAndFormatRevaName(revaMember.fullName).toLowerCase() === receivedFullName?.toLowerCase() ||
        cleanAndFormatRevaName(revaMember.fullName).toLowerCase() === receivedFullNameWithoutMiddleInitial?.toLowerCase()),
  );

  if (!matchedPartyMembers.length) return { isMemberMatched: false };

  if (receivedMember.email) {
    const matchedPartyMembersByEmail = matchedPartyMembers?.filter(revaMember =>
      (revaMember.contactInfo.emails || []).some(e => e.value?.toLowerCase() === receivedMember.email?.toLowerCase()),
    );
    if (matchedPartyMembersByEmail.length) return { isMemberMatched: true, matchedPartyMemberId: matchedPartyMembersByEmail[0].id };
  }

  if (receivedMember.phone) {
    const formattedReceivedPhone = formatPhoneNumberForDb(receivedMember.phone);
    const matchedPartyMembersByPhone = matchedPartyMembers?.filter(revaMember =>
      (revaMember.contactInfo.phones || []).some(e => e.value === formattedReceivedPhone),
    );
    if (matchedPartyMembersByPhone.length) return { isMemberMatched: true, matchedPartyMemberId: matchedPartyMembersByPhone[0].id };
  }

  return { isMemberMatched: false };
};

export const isOldPrimaryMatched = async (ctx, receivedMembers, primaryExternalId, partyIdMatched) => {
  const oldPrimaryExternalInfo = await getPrimaryExternalInfoByParty(ctx, partyIdMatched);
  if (!oldPrimaryExternalInfo) return false;

  const [oldPrimaryMember] = oldPrimaryExternalInfo.externalId && (await loadPartyMemberById(ctx, oldPrimaryExternalInfo.partyMemberId));
  const matchesForOldPrimary = receivedMembers.filter(member => {
    if (member?.id === primaryExternalId) return false;
    const matchedPartyMember = checkMatchingPartyMember(member, [oldPrimaryMember]);
    return matchedPartyMember?.isMemberMatched;
  });
  return !!matchesForOldPrimary.length;
};

const updateExternalsForMatchingPartyMembers = async (
  ctx,
  { partyIdMatched, receivedMembers, allRevaMembersByPartyId, revaChildren, primaryExternalId, propertyId },
) =>
  await mapSeries(receivedMembers, async receivedMember => {
    const isPrimarySwitch = true;
    if (receivedMember.id === primaryExternalId) {
      const primaryPartyMember = checkMatchingPartyMember(receivedMember, allRevaMembersByPartyId);
      primaryPartyMember?.matchedPartyMemberId &&
        (await handleUpdatedExternalInfo(
          ctx,
          { partyId: partyIdMatched, memberId: primaryPartyMember.matchedPartyMemberId, propertyId },
          { externalId: receivedMember.id, externalProspectId: receivedMember.prospectId, isPrimary: true, metadata: { isPrimarySwitch: true } },
          isPrimarySwitch,
        ));
      return;
    }

    if (checkIfChild(receivedMember.type)) {
      const matchedChild = checkMatchingPartyMember(receivedMember, allRevaMembersByPartyId, revaChildren);
      matchedChild?.childId &&
        (await handleUpdatedExternalInfo(
          ctx,
          { partyId: partyIdMatched, memberId: matchedChild.childId, propertyId },
          { externalRoommateId: receivedMember?.id, isChild: true, metadata: { isPrimarySwitch: true } },
          isPrimarySwitch,
        ));
      return;
    }

    const partyMember = checkMatchingPartyMember(receivedMember, allRevaMembersByPartyId);
    partyMember?.matchedPartyMemberId &&
      (await handleUpdatedExternalInfo(
        ctx,
        { partyId: partyIdMatched, memberId: partyMember.matchedPartyMemberId, propertyId },
        { externalRoommateId: receivedMember.id, metadata: { isPrimarySwitch: true } },
      ));
  });

export const checkAndUpdateChangedExternalIds = async (ctx, receivedMembers, primaryExternalId, inventoryId, propertyId) => {
  const partyIdMatched = await getActiveLeaseIdByInventoryId(ctx, inventoryId);
  if (!partyIdMatched) return '';

  if (!(await isOldPrimaryMatched(ctx, receivedMembers, primaryExternalId, partyIdMatched))) return '';

  const allRevaMembersByPartyId = await getPartyMembersByPartyIds(ctx, [partyIdMatched]);
  const revaChildren = ((await getPartyAdditionalInfoByPartyId(ctx, partyIdMatched)) || []).filter(p => p.type === DALTypes.AdditionalPartyMemberType.CHILD);
  await updateExternalsForMatchingPartyMembers(ctx, { partyIdMatched, receivedMembers, allRevaMembersByPartyId, revaChildren, primaryExternalId, propertyId });

  logger.trace({ ctx, newPrimaryExternal: primaryExternalId, partyIdMatched }, 'checkAndUpdateChangedExternalIds - party match found and externals updated');
  return receivedMembers.map(r => r.id);
};
