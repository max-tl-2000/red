/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import { personHasValidSMSNumber } from 'helpers/contactInfoUtils';
import { isPartyWithBlockedContact, isPartyWithPreviouslyBlockedContact, partyIsNotActive } from 'helpers/party';
import { DALTypes } from 'enums/DALTypes';
import { allowedToModifyParty } from 'acd/access';
import { getEnhancedAppointments } from 'helpers/appointments';
import Immutable from 'immutable';
import { hasActiveQuotePromotion, isTaskAllowedOnCorporateParties } from 'helpers/party-utils';
import { QuoteModel } from 'helpers/models/quoteListModel';
import { AdditionalInfoTypes } from 'enums/partyTypes';
import { isDuplicatePersonNotificationEnabled } from './userSelectors';
import { canMemberBeInvitedToApply, isApplicationApprovable } from '../../../common/helpers/quotes';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { setQualificationQuestionsAsSummary } from '../../helpers/models/party';
import { toMoment, now } from '../../../common/helpers/moment-utils';

const getAssociatedProperty = (party, properties) => {
  if (!party || !properties) return '';

  const assignedPropertyId = party.assignedPropertyId;
  return properties.find(p => p.id === assignedPropertyId);
};

const getPropertyName = assignedProperty => (assignedProperty ? assignedProperty.displayName : '');

export const getParty = createSelector(
  // hard dependency on the fact that dataStore is immutable
  state => state.dataStore.get('parties'),
  (state, props) => props.partyId,
  (parties, partyId) => {
    if (!partyId) return undefined;
    return parties.find(p => p.id === partyId);
  },
);

export const getActiveLeaseWorkflowData = createSelector(
  getParty,
  state => state.dataStore.get('activeLeaseWorkflowData'),
  (party, activeLeaseWorkflowData) => {
    if (!party) return null;
    const partyIdToMatch = party.workflowName === DALTypes.WorkflowName.RENEWAL ? party.seedPartyId : party.id;
    return activeLeaseWorkflowData.find(workflow => workflow.partyId === partyIdToMatch);
  },
);

export const isPartyNotActive = createSelector(getParty, party => partyIsNotActive(party));

export const isPartyClosed = createSelector(getParty, party => !!(party && party.workflowState === DALTypes.WorkflowState.CLOSED));

export const isPartyArchived = createSelector(getParty, party => !!(party && party.workflowState === DALTypes.WorkflowState.ARCHIVED));

export const disableCommsForArchivedParty = createSelector(
  getParty,
  state => state.globalStore.get('properties'),
  (state, props) => isPartyArchived(state, props),
  (party, properties, partyIsArchived) => {
    if (!partyIsArchived || !properties.length) return false;
    if (party.workflowName !== DALTypes.WorkflowName.ACTIVE_LEASE) return true;
    const { settings, timezone } = properties.find(p => p.id === party.assignedPropertyId);
    const daysToRouteToALPostMoveout = settings.comms.daysToRouteToALPostMoveout;
    return toMoment(party.archiveDate, { timezone }).add(daysToRouteToALPostMoveout, 'days').isBefore(now({ timezone }));
  },
);

export const getDaysToRouteToALPostMoveout = createSelector(
  getParty,
  state => state.globalStore.get('properties'),
  (party, properties) => {
    const { settings = {} } = properties.find(p => p.id === party?.assignedPropertyId) || {};
    return settings?.comms?.daysToRouteToALPostMoveout;
  },
);

export const isCaiEnabled = createSelector(getParty, party => !!(party && party.metadata?.caiEnabled));

export const getPartyMembers = createSelector(
  state => state.dataStore.get('members'),
  state => state.dataStore.get('persons'),
  s => s.dataStore.get('applications'),
  (state, props) => props.partyId,
  (members, persons, applications, partyId) => {
    if (!partyId) return new Immutable.Map();
    return members
      .filter(m => m.partyId === partyId)
      .map(m => ({
        ...m,
        person: persons.get(m.personId),
        application: applications.filter(application => application.personId === m.personId && application.partyId === partyId).first(),
      }))
      .sortBy(m => getDisplayName(m.person));
  },
);

export const getNumberOfGuarantors = createSelector(
  state => state.dataStore.get('members'),
  (state, props) => props.partyId,
  (members, partyId) => {
    if (!partyId) return 0;
    return members.filter(m => m.partyId === partyId && m.memberType === DALTypes.MemberType.GUARANTOR).size;
  },
);

export const getNumberOfPets = createSelector(
  state => state.dataStore.get('partiesAdditionalInfo'),
  (state, props) => props.partyId,
  (partiesAdditionalInfo, partyId) => {
    if (!partyId) return 0;
    return partiesAdditionalInfo.filter(m => m.partyId === partyId && m.type === AdditionalInfoTypes.PET).size;
  },
);

export const getPartyVehicles = createSelector(
  state => state.dataStore.get('partiesAdditionalInfo'),
  (state, props) => props.partyId,
  (partiesAdditionalInfo, partyId) => {
    if (!partyId) return [];
    const partyVehicles = partiesAdditionalInfo.filter(m => m.partyId === partyId && m.type === AdditionalInfoTypes.VEHICLE);
    return Array.from(partyVehicles.values()).filter(x => x.partyId === partyId);
  },
);

export const getPartyPets = createSelector(
  state => state.dataStore.get('partiesAdditionalInfo'),
  (state, props) => props.partyId,
  (partiesAdditionalInfo, partyId) => {
    if (!partyId) return [];
    const partyPets = partiesAdditionalInfo.filter(m => m.partyId === partyId && m.type === AdditionalInfoTypes.PET);
    return Array.from(partyPets.values()).filter(x => x.partyId === partyId);
  },
);

export const getPartyProgram = createSelector(
  state => state.dataStore.get('partiesProgram'),
  (state, props) => props.partyId,
  (partiesProgram, partyId) => {
    if (!partyId) return '';
    const filtered = partiesProgram.find(m => m.partyId === partyId);
    if (filtered) return filtered.program;
    return '';
  },
);

export const getAllApplicationsAreCompleted = createSelector(getPartyMembers, partyMembers =>
  partyMembers.every(m => m.application && m.application.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED),
);

export const getEnhancedInactiveMembers = createSelector(
  state => state.dataStore.get('inactiveMembers'),
  state => state.dataStore.get('persons'),
  (state, props) => props.partyId,
  (members, personsMap, partyId) =>
    members
      .filter(m => m.partyId === partyId)
      .map(m => ({
        ...m,
        person: personsMap.get(m.personId),
      })),
);

export const getPersons = createSelector(
  state => state.dataStore.get('persons'),
  (state, props) => getPartyMembers(state, props),
  (state, props) => getEnhancedInactiveMembers(state, props),
  (persons, partyMembers, inactiveMembers) =>
    // TODO: Check why we need to iterate over persons first
    // wouldn't be easier to get all the personIds and then just pick those
    // from the persons Map?
    persons.filter(person => partyMembers.find(pm => pm.personId === person.id) || inactiveMembers.find(im => im.personId === person.id)),
);

// TODO: What is different from this way of getting the persons from the party active and inactive members
// from the method used above?
export const getPersonsInParty = createSelector(getPartyMembers, getEnhancedInactiveMembers, (partyMembers, inactiveMembers) => {
  const partyMembersPerson = partyMembers.mapEntries(([_key, member]) => [member.person.id, member.person]);
  const inactivePartyMembersPerson = inactiveMembers.mapEntries(([_key, member]) => [member.person.id, member.person]);
  return partyMembersPerson.merge(inactivePartyMembersPerson);
});

export const getPersonsInPartyFlags = createSelector(
  (state, props) => getPersons(state, props),
  (state, props) => getEnhancedInactiveMembers(state, props),
  (persons, inactiveMembers) => {
    if (!persons) return {};
    const activePersons = persons.filter(person => !inactiveMembers.map(im => im.personId).includes(person.id));

    return {
      partyHasMemberWithStrongMatch: activePersons.some(p => p.strongMatchCount > 0),
      noMembersHavePhoneNos: activePersons.every(p => ((p.contactInfo || {}).phones || []).length === 0),
      atLeastOnePersonHasSMSNos: activePersons.find(p => personHasValidSMSNumber(p)),
      noMembersHaveEmailAddresses: activePersons.every(p => ((p.contactInfo || {}).emails || []).length === 0),
    };
  },
);

export const getPropertyNameForParty = createSelector(
  getParty,
  state => state.globalStore.get('properties'),
  (party, properties) => {
    const property = getAssociatedProperty(party, properties);
    return getPropertyName(property);
  },
);

export const getAssociatedPropertyForParty = createSelector(
  getParty,
  state => state.globalStore.get('properties'),
  (party, properties) => {
    const { displayName, id } = getAssociatedProperty(party, properties) || {};
    return { propertyName: displayName, propertyId: id };
  },
);

export const getAssociatedPropertySettingsForParty = createSelector(
  getParty,
  state => state.globalStore.get('properties'),
  (party, properties) => (getAssociatedProperty(party, properties) || {}).settings,
);

export const getTourTypesAvailableForParty = createSelector(getAssociatedPropertySettingsForParty, settings => settings?.appointment?.tourTypesAvailable);

export const propertyHasResidentDataImportOn = createSelector(getAssociatedPropertySettingsForParty, settings => !!settings?.integration?.import?.residentData);

export const getPropertyAppSettings = createSelector(getAssociatedPropertySettingsForParty, settings => settings?.rxp?.app);

export const partyHaveBlockedContacts = createSelector(
  getParty,
  (state, props) => getPartyMembers(state, props),
  (party, partyMembers) => {
    if (!party) return false;
    return isPartyWithBlockedContact(party, partyMembers);
  },
);

export const partyIsMerged = createSelector(
  getParty,
  (state, props) => isPartyArchived(state, props),
  (party, partyIsArchived) => {
    if (!party) return false;
    const { ArchivePartyReasons } = DALTypes;
    const { metadata } = party;

    return partyIsArchived && !!(metadata && ArchivePartyReasons[metadata.closeReasonId] === ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY);
  },
);

export const canModifyParty = createSelector(
  getParty,
  state => state.auth.user,
  (party, currentUser) => party && allowedToModifyParty(currentUser, party),
);

export const canBeMarkedAsSpam = createSelector(getParty, (party = {}) => {
  if (!party) return false;

  const { partyMembers = [], state } = party;

  const isInContactState = state === DALTypes.PartyStateType.CONTACT;
  const hasOnlyOneMember = partyMembers.length === 1;

  const hasOnlyOneContactInfo = () => {
    const firstPartyMember = partyMembers[0] || {};
    const { contactInfo = {} } = firstPartyMember;
    const { all = [] } = contactInfo;

    return all.filter(c => c.value).length === 1;
  };

  return isInContactState && hasOnlyOneMember && hasOnlyOneContactInfo();
});

export const partyHasPreviouslyBlockedContacts = createSelector(canBeMarkedAsSpam, getParty, getPartyMembers, (allowMarkAsSpam, party, partyMembers) => {
  if (!allowMarkAsSpam) return false;

  return isPartyWithPreviouslyBlockedContact(party, partyMembers);
});

export const isCorporateParty = createSelector(getParty, party => {
  if (!party) return false;
  return party.leaseType === DALTypes.PartyTypes.CORPORATE;
});

export const isRenewalParty = createSelector(getParty, party => {
  if (!party) return false;
  return party.workflowName === DALTypes.WorkflowName.RENEWAL;
});

export const isActiveLeaseParty = createSelector(getParty, party => {
  if (!party) return false;
  return party.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE;
});

export const isNewLeaseParty = createSelector(getParty, party => {
  if (!party) return false;
  return party.workflowName === DALTypes.WorkflowName.NEW_LEASE;
});

export const getPartyTasks = createSelector(
  state => state.dataStore.get('tasks'),
  (state, props) => props.partyId,
  (state, props) => isCorporateParty(state, props),
  (tasks, partyId, partyIsCorporate) => {
    if (!partyId) return new Immutable.Map();
    return tasks.filter(
      task =>
        task.partyId === partyId &&
        (!partyIsCorporate || (task.category !== DALTypes.TaskCategories.APPOINTMENT && isTaskAllowedOnCorporateParties(task.name, task.category))),
    );
  },
);

export const getTaskOwners = createSelector(
  state => (state.partyStore.selectorData || {}).allUsers,
  (users = []) => users.map(user => ({ id: user.id, fullName: user.fullName })),
);

export const getQuotePromotions = createSelector(
  state => state.dataStore.get('quotePromotions'),
  (state, props) => props.partyId,
  (state, props) => props.party,
  (quotePromotions, partyId, party = {}) => {
    const pId = partyId || party.id;
    if (!pId) return new Immutable.Map();
    return quotePromotions.filter(p => p.partyId === pId);
  },
);

export const getActiveQuotePromotion = createSelector(
  getQuotePromotions,
  (state, props) => props.quote,
  (quotePromotions, quote) => {
    if (!quotePromotions) return undefined;
    const activePromotion = quotePromotions.find(promotion => isApplicationApprovable(promotion.promotionStatus));
    if (activePromotion) return activePromotion;
    return quote
      ? quotePromotions.find(promotion => promotion.promotionStatus === DALTypes.PromotionStatus.APPROVED && promotion.quoteId === quote.id)
      : quotePromotions.find(promotion => promotion.promotionStatus === DALTypes.PromotionStatus.APPROVED) || null;
  },
);

export const getPartyAppointments = createSelector(
  state => state.dataStore.get('tasks'),
  (state, props) => props.partyId,
  (appointments, partyId) => appointments.filter(p => p.category === DALTypes.TaskCategories.APPOINTMENT && p.partyId === partyId),
);

// CHECK: why taskList and LeaseStatusList use this selector
// instead of the getPersonsInParty.
export const personsInParty = createSelector(getPartyMembers, partyMembers =>
  partyMembers.reduce((acc, item) => {
    const { person } = item;
    acc = acc.set(person.id, person);
    return acc;
  }, new Immutable.Map()),
);

export const getPartyLeases = createSelector(
  s => s.dataStore.get('leases'),
  (s, props) => props.partyId,
  (leases, partyId) => leases.filter(item => item.partyId === partyId),
);

export const getFlagShouldReviewMatches = createSelector(
  getPersonsInPartyFlags,
  isDuplicatePersonNotificationEnabled,
  (commsFlags, duplicatePersonFlag) => commsFlags.partyHasMemberWithStrongMatch && duplicatePersonFlag,
);

export const isPartyNotInContactState = createSelector(getParty, party => !!(party && party.state !== DALTypes.PartyStateType.CONTACT));

export const getCommunications = createSelector(
  s => s.dataStore.get('communications'),
  (s, props) => props.partyId,
  (comms, partyId) => {
    if (!partyId) return new Immutable.Map();
    return comms.filter(c => c.parties.includes(partyId));
  },
);

export const getSalesPersonsInParty = createSelector(
  getParty,
  state => state.globalStore.get('users'),
  (party, users) => {
    if (!party) return [];
    const { collaborators, userId } = party;
    const collaboratorsIds = new Set([userId, ...collaborators]);
    return [...collaboratorsIds].map(id => users.get(id)).filter(u => u);
  },
);

export const getPartyOwnerAgent = createSelector(
  getParty,
  state => state.globalStore.get('users'),
  (party, users) => (!party ? {} : users.get(party.userId)),
);

export const getUsersLastActivity = createSelector(
  s => s.dataStore.get('usersLastActivity'),
  (s, props) => props.partyId,
  (lastActivities, partyId) =>
    lastActivities.filter(la => la.context.parties.includes(partyId)).sort((a, b) => toMoment(a.created_at).isBefore(toMoment(b.created_at))),
);

export const isChangePartyTypeDisabledForParty = createSelector(
  state => state.dataStore.get('quotePromotions'),
  (state, props) => props.partyId,
  (quotePromotions, partyId) => hasActiveQuotePromotion(quotePromotions, partyId),
);

export const getLeases = createSelector(
  s => s.dataStore.get('leases'),
  (s, props) => props.partyId,
  (leases, partyId) => leases.filter(item => item.partyId === partyId),
);

export const getActiveLeases = createSelector(getLeases, leases => leases.filter(l => l.status !== DALTypes.LeaseStatus.VOIDED));

export const isPublishedOrExecutedLease = createSelector(getLeases, partyLeases =>
  partyLeases.some(l => l.status === DALTypes.LeaseStatus.SUBMITTED || l.status === DALTypes.LeaseStatus.EXECUTED),
);

export const isDraftLease = createSelector(getLeases, partyLeases => partyLeases.some(l => l.status === DALTypes.LeaseStatus.DRAFT));

export const getPartyMembersThatCanApply = createSelector(getPartyMembers, partyMembers => partyMembers.filter(canMemberBeInvitedToApply));

// This probably will be better moved into quote selectors
export const getSelectedQuoteModel = createSelector(
  state => state.quotes.model,
  quoteModel => (quoteModel ? new QuoteModel({ quote: quoteModel }) : undefined),
);

export const getPromotedQuotes = createSelector(
  state => state.quotes.quotes,
  getQuotePromotions,
  (quotes, quotePromotions) => {
    const activePromotedQuotes = quotePromotions.filter(
      ({ promotionStatus }) => isApplicationApprovable(promotionStatus) || promotionStatus === DALTypes.PromotionStatus.APPROVED,
    );
    return quotes.filter(quote => activePromotedQuotes.some(promotedQuote => promotedQuote.quoteId === quote.id));
  },
);

export const hasPartyActivePromotionForQuote = createSelector(
  isCorporateParty,
  getQuotePromotions,
  (partyIsCorporate, quotePromotions) =>
    !partyIsCorporate &&
    quotePromotions &&
    quotePromotions.some(promotion => isApplicationApprovable(promotion.promotionStatus) || promotion.promotionStatus === DALTypes.PromotionStatus.APPROVED),
);

const canVoidExecutedLease = partyLeases => {
  const executedLease = partyLeases.find(l => l.status === DALTypes.LeaseStatus.EXECUTED);
  if (!executedLease) return true;
  const leaseStartDate = executedLease.baselineData && executedLease.baselineData.publishedLease && executedLease.baselineData.publishedLease.leaseStartDate;
  if (!leaseStartDate) return true;
  const { timezone } = executedLease.baselineData;
  const leaseStartDateMoment = toMoment(leaseStartDate, { timezone });

  return !leaseStartDateMoment.isBefore(now({ timezone }));
};

export const canCloseParty = createSelector(
  getParty,
  (state, props) => !isPartyClosed(state, props),
  state => state.auth.user,
  getLeases,
  (party, partyIsOpen, currentUser, leases) => party && partyIsOpen && allowedToModifyParty(currentUser, party) && canVoidExecutedLease(leases),
);

export const getPartyTimezone = createSelector(
  getParty,
  state => state.propertyStore.selectedPropertyId,
  state => state.globalStore.get('properties'),
  (party, defaultPropertyId, properties = []) => {
    const propertyId = (party || {}).assignedPropertyId || defaultPropertyId;

    if (!propertyId) {
      return undefined;
    }

    const property = properties.find(p => p.id === propertyId);

    if (!property) {
      return undefined;
    }

    return property.timezone;
  },
);

export const getSummaryQualificationAnswers = createSelector(getParty, party => setQualificationQuestionsAsSummary((party || {}).qualificationQuestions || {}));

export const getAssignedProperty = createSelector(
  getParty,
  (state, props) => props.properties || state.globalStore.get('properties'),
  (party, properties) => {
    const { assignedPropertyId } = party || {};
    if (!assignedPropertyId || !(properties || []).length) return {};
    return properties.find(property => property.id === assignedPropertyId) || {};
  },
);

export const getLeaseTermsForAssignedProperty = createSelector(getAssignedProperty, property => {
  const { leaseTerms } = property || {};
  return leaseTerms || [];
});

export const getPartyEnhancedAppointments = createSelector(
  getPartyAppointments,
  state => state.globalStore.get('users'),
  getPartyMembers,
  getEnhancedInactiveMembers,
  getPartyTimezone,
  (appointments, users, partyMembers, inactiveMembers, timezone) =>
    getEnhancedAppointments(appointments || [], { users, partyMembers, inactiveMembers, timezone }),
);

export const shouldShowInventoryStepper = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowRenewalLetterSection = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.RENEWAL);

export const shouldShowActiveLeaseSection = createSelector(getParty, party => party?.workflowName && party.workflowName !== DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowApplicationAndQuotes = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowApplicationProgress = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowQuoteList = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowLeaseListOnNewLeaseWorkflow = createSelector(
  getParty,
  party => party?.workflowName && party.workflowName !== DALTypes.WorkflowName.ACTIVE_LEASE && party.workflowName !== DALTypes.WorkflowName.RENEWAL,
);

export const shouldShowLeaseForm = createSelector(getParty, party => party?.workflowName && party.workflowName !== DALTypes.WorkflowName.ACTIVE_LEASE);

export const shouldShowTransactionList = createSelector(
  getParty,
  party => party?.workflowName && party.workflowName !== DALTypes.WorkflowName.ACTIVE_LEASE && party.workflowName !== DALTypes.WorkflowName.RENEWAL,
);

export const shouldShowRenewalLetter = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.RENEWAL);

export const shouldShowInventoryAndComms = createSelector(getParty, party => party?.workflowName && party.workflowName === DALTypes.WorkflowName.NEW_LEASE);

export const shouldShowPartySummarySection = createSelector(
  getParty,
  party => party?.workflowName && !(party.workflowName === DALTypes.WorkflowName.NEW_LEASE && party.leaseType === DALTypes.PartyTypes.CORPORATE),
);

export const getRenewalPartyId = createSelector(getParty, party => party && party.renewalPartyId);

export const hasRenewalPartyActivePromotionForQuote = createSelector(
  getParty,
  getQuotePromotions,
  (party, quotePromotions) =>
    party?.workflowName &&
    party.workflowName === DALTypes.WorkflowName.RENEWAL &&
    quotePromotions &&
    quotePromotions.some(promotion => isApplicationApprovable(promotion.promotionStatus) || promotion.promotionStatus === DALTypes.PromotionStatus.APPROVED),
);

export const getSeedPartyData = createSelector(
  getParty,
  state => state.dataStore.get('seedPartyData'),
  (party, seedPartyData) => {
    if (!party || !party.seedPartyId || !seedPartyData) return undefined;
    return seedPartyData.find(s => s.id === party.seedPartyId);
  },
);
