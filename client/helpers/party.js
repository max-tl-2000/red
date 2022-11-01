/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../../common/enums/DALTypes';
import notifier from './notifier/notifier';
import cfg from './cfg';
import { areOccupantsAllowedOnParty, isPartyLevelGuarantorOnTraditionalParty, isResident, isGuarantor, isOccupant } from '../../common/helpers/party-utils';
import { isAnonymousEmail } from '../../common/helpers/anonymous-email';

export const getPartyStateToDisplay = partyState => {
  const partyStateMap = {
    [`${DALTypes.PartyStateType.CONTACT}`]: `${t('PARTY_STATE_CONTACT')}`,
    [`${DALTypes.PartyStateType.LEAD}`]: `${t('PARTY_STATE_LEAD')}`,
    [`${DALTypes.PartyStateType.PROSPECT}`]: `${t('PARTY_STATE_PROSPECT')}`,
    [`${DALTypes.PartyStateType.APPLICANT}`]: `${t('PARTY_STATE_APPLICANT')}`,
    [`${DALTypes.PartyStateType.LEASE}`]: `${t('PARTY_STATE_LEASE')}`,
    [`${DALTypes.PartyStateType.PASTRESIDENT}`]: `${t('PARTY_STATE_PAST_RESIDENTS')}`,
    [`${DALTypes.PartyStateType.FUTURERESIDENT}`]: `${t('PARTY_STATE_FUTURE_RESIDENTS')}`,
  };

  return partyStateMap[partyState];
};

export const isMissingPropertyOrTeam = (party = {}) => !party.assignedPropertyId || !party.ownerTeam;

const isPropertyTeamInPartyTeams = ({ teamIds = [] }, partyTeams = []) => teamIds.some(teamId => partyTeams.includes(teamId));

export const getAssociatedTeamPropertiesForParty = (properties = [], party = {}) =>
  properties.filter(property => isPropertyTeamInPartyTeams(property, party.teams));

const getAssignPartyMessage = (isCurrentUser, assignTo, name) => {
  if (assignTo.userId) {
    return isCurrentUser ? t('YOU_ARE_NOW_PRIMARY_AGENT') : t('IS_NOW_PRIMARY_AGENT', { name });
  }

  return t('PARTY_IS_REROUTED', { name });
};

export const showPartyAssignedMessage = (isCurrentUser, assignTo, name) => {
  const successMessage = getAssignPartyMessage(isCurrentUser, assignTo, name);
  notifier.info(successMessage);
};

export const getIdFromFirstElement = (condition, values) => (condition ? values[0].id : '');

export const getAssignedTeamOwner = (hasOneTeam, teams) => getIdFromFirstElement(hasOneTeam, teams);

export const getAssignedProperty = (hasOneProperty, properties) => getIdFromFirstElement(hasOneProperty, properties);

const isPartyMemberWithBlockedContact = partyMember => partyMember.person.contactInfo.all.some(ci => ci.isSpam);

export const isPartyWithBlockedContact = (party, partyMembers) =>
  !!(
    party &&
    party.metadata &&
    DALTypes.ClosePartyReasons[party.metadata.closeReasonId] === DALTypes.ClosePartyReasons.BLOCKED_CONTACT &&
    partyMembers.toArray().some(pm => isPartyMemberWithBlockedContact(pm))
  );

export const isPartyWithPreviouslyBlockedContact = (party, partyMembers) =>
  !!(party && party.metadata && !party.metadata.closeReasonId && partyMembers.toArray().some(pm => isPartyMemberWithBlockedContact(pm)));

export const getAlreadyPrimaryAgentMessage = (isCurrentUser, selectedItemFullName) =>
  isCurrentUser ? t('YOU_ARE_ALREADY_PRIMARY_AGENT') : t('IS_ALREADY_PRIMARY_AGENT', { name: selectedItemFullName });

export const getMembersAfterLinking = (selectedPartyMember, personsToLink, partyMembers) => {
  let currentMembers = [];
  if (isResident(selectedPartyMember)) {
    currentMembers = partyMembers.map(partyMember => {
      let [guaranteedBy] = personsToLink;
      guaranteedBy = partyMember.id === selectedPartyMember.id ? guaranteedBy : null;
      return { ...partyMember, guaranteedBy };
    });
  } else {
    currentMembers = partyMembers.map(partyMember => {
      let guaranteedBy = partyMember.guaranteedBy === selectedPartyMember.id ? null : partyMember.guaranteedBy;
      guaranteedBy = personsToLink.length && personsToLink.some(residentId => residentId === partyMember.id) ? selectedPartyMember.id : guaranteedBy;
      return { ...partyMember, guaranteedBy };
    });
  }
  return currentMembers;
};

export const removeGuaranteedByLinkFor = (selectedPartyMember, partyMembers) =>
  partyMembers.map(partyMember => ({
    ...partyMember,
    guaranteedBy: partyMember.id === selectedPartyMember.id ? null : partyMember.guaranteedBy,
  }));

export const isGuarantorLinkHoldType = partyMembers =>
  !partyMembers.filter(isGuarantor).every(guarantor => partyMembers.some(partyMember => partyMember.guaranteedBy === guarantor.id));

export const removeMember = (partyMembers, selectedPartyMember) =>
  partyMembers.delete(selectedPartyMember.id).map(member => ({
    ...member,
    guaranteedBy: member.guaranteedBy === selectedPartyMember.id ? null : member.guaranteedBy,
  }));

export const areOccupantsAllowed = party => areOccupantsAllowedOnParty(party, cfg('partySettings', {}));
export const isPartyLevelGuarantor = isPartyLevelGuarantorOnTraditionalParty(cfg('partySettings', {}));

export const getPropertiesForPropertySelectorDialog = (
  properties,
  { preferredPropertyIds = [], unitsOnAppointmentPropertyIds = [], favoriteUnitsPropertyIds = [], assignedPropertyId = null },
) => {
  const joinedPropertiesIds = new Set([...preferredPropertyIds, ...unitsOnAppointmentPropertyIds, ...favoriteUnitsPropertyIds, assignedPropertyId]);

  return properties
    .filter(({ id }) => joinedPropertiesIds.has(id))
    .map(p => ({ ...p, displayNameForSelector: `${p.displayName} - ${p.leasingOfficeAddress}` }));
};

export const filterSpamAndAnonymousEmails = emails => emails.filter(email => !email.isSpam && !isAnonymousEmail(email.value));

export const filterSpamPhones = phones => phones.filter(({ isSpam, metadata = {} }) => !isSpam && (metadata.sms || false));

export const getLeaseTypeQualificationAnswer = questions => (questions || []).filter(question => question.id === 'leaseTypeTxt');

export const getMembersWithInvalidEmail = (partyMembers, isCorporateParty) =>
  partyMembers.filter(pm => {
    if (isCorporateParty && isOccupant(pm)) return false;

    const { defaultEmail } = pm.person.contactInfo || {};
    return !defaultEmail || isAnonymousEmail(defaultEmail);
  });

export const partyIsNotActive = party =>
  !!(party && (party.workflowState === DALTypes.WorkflowState.ARCHIVED || party.workflowState === DALTypes.WorkflowState.CLOSED));

export const partyIsRenewalOrActiveLease = party =>
  !!(party && (party.workflowName === DALTypes.WorkflowName.RENEWAL || party.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE));

export const getVisibleCloseReasons = (isAdmin, isResidentParty) => {
  const reasons = DALTypes.ClosePartyReasons;

  const closeReasonForResidents = [reasons.EVICTION, reasons.ABANDON, reasons.INTEGRATION_ISSUES, reasons.PROPERTY_SOLD];
  const notVisibleCloseReasons = [
    reasons.REVA_TESTING,
    reasons.NO_MEMBERS,
    reasons.CLOSED_DURING_IMPORT,
    reasons.BLOCKED_CONTACT,
    reasons.MERGED_WITH_ANOTHER_PARTY,
  ];
  const notVisibleCloseReasonsForNonResidentParty = [...closeReasonForResidents, ...notVisibleCloseReasons];
  const revaTestingEnumKey = 'REVA_TESTING';

  const closeReasons = isResidentParty
    ? Object.keys(reasons).filter(key => closeReasonForResidents.includes(reasons[key]))
    : Object.keys(reasons).filter(key => !notVisibleCloseReasonsForNonResidentParty.includes(reasons[key]));

  return isAdmin ? [revaTestingEnumKey, ...closeReasons] : closeReasons;
};

export const MERGE_DIALOG_OPENED_FROM_TYPE = {
  FROM_PARTY_CARD: 'partyCard',
  FROM_DONT_MERGE_BUTTON: 'dontMergeButton',
  FROM_MERGE_PARTY: 'mergeParty',
  FROM_MERGE_PERSON: 'mergePerson',
};

const MERGE_DIALOG_TITLE = {
  FROM_PARTY_CARD: 'DID_NOT_FIND_ANY_MATCHING_PARTIES',
  FROM_DONT_MERGE_BUTTON: 'PARTIES_WERE_NOT_MERGED',
  FROM_MERGE_PARTY: 'PARTIES_SUCCESSFULLY_MERGED',
  FROM_MERGE_PERSON: 'PEOPLE_SUCCESSFULLY_MERGED',
};

export const getMergeDialogTitle = from =>
  t(
    MERGE_DIALOG_TITLE[Object.keys(MERGE_DIALOG_OPENED_FROM_TYPE).find(key => MERGE_DIALOG_OPENED_FROM_TYPE[key] === from)] ||
      'NO_MORE_DUPLICATE_PARTY_FOUND_LABEL',
  );

const MERGE_DIALOG_BODY = {
  FROM_PARTY_CARD: 'NO_DUPLICATE_PARTY_FOUND_INFO3',
  FROM_DONT_MERGE_BUTTON: 'NO_DUPLICATE_PARTY_FOUND_INFO4',
  FROM_MERGE_PARTY: 'NO_DUPLICATE_PARTY_FOUND_INFO5',
  FROM_MERGE_PERSON: 'NO_DUPLICATE_PARTY_FOUND_INFO6',
};
export const getMergeDialogBody = from =>
  t(MERGE_DIALOG_BODY[Object.keys(MERGE_DIALOG_OPENED_FROM_TYPE).find(key => MERGE_DIALOG_OPENED_FROM_TYPE[key] === from)] || 'NO_DUPLICATE_PARTY_FOUND_INFO1');
