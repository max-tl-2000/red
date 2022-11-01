/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import last from 'lodash/last';
import initial from 'lodash/initial';
import { DALTypes } from '../enums/DALTypes';
import { getDisplayName } from './person-helper';
import trim from './trim';
import { isObject } from './type-of';
import { toMoment } from './moment-utils';

const isValidMemberType = (memberTypeOrMember, type) => {
  if (!memberTypeOrMember) return false;
  const memberType = isObject(memberTypeOrMember) ? memberTypeOrMember.memberType : memberTypeOrMember;
  return memberType === type;
};

export const isOccupant = memberTypeOrMember => isValidMemberType(memberTypeOrMember, DALTypes.MemberType.OCCUPANT);

export const isGuarantor = memberTypeOrMember => isValidMemberType(memberTypeOrMember, DALTypes.MemberType.GUARANTOR);

export const isResident = memberTypeOrMember => isValidMemberType(memberTypeOrMember, DALTypes.MemberType.RESIDENT);

const MemberType = DALTypes.MemberType;

const weights = {
  [MemberType.RESIDENT]: 0,
  [MemberType.OCCUPANT]: 1,
  [MemberType.GUARANTOR]: 2,
};

const allowedTasksOnLeasingParties = [
  DALTypes.TaskNames.INTRODUCE_YOURSELF,
  DALTypes.TaskNames.CALL_BACK,
  DALTypes.TaskNames.FOLLOWUP_PARTY,
  DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
  DALTypes.TaskNames.REVIEW_APPLICATION,
  DALTypes.TaskNames.PROMOTE_APPLICATION,
  DALTypes.TaskNames.APPOINTMENT,
  DALTypes.TaskNames.COUNTERSIGN_LEASE,
  DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL,
  DALTypes.TaskNames.SEND_CONTRACT,
  DALTypes.TaskNames.REQUIRE_ADDITIONAL_WORK,
  DALTypes.TaskNames.HOLD_INVENTORY,
  DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
  DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
  DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
  DALTypes.TaskNames.PRINT_DECLINE_LETTER,
];

const allowedTasksOnRenewalParties = [
  DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
  DALTypes.TaskNames.COUNTERSIGN_LEASE,
  DALTypes.TaskNames.SEND_CONTRACT,
  DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL,
  DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
  DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
];
const allowedTasksOnActiveLeaseParties = [];

const allowedTasksByWorkflow = {
  [DALTypes.WorkflowName.NEW_LEASE]: allowedTasksOnLeasingParties,
  [DALTypes.WorkflowName.RENEWAL]: allowedTasksOnRenewalParties,
  [DALTypes.WorkflowName.ACTIVE_LEASE]: allowedTasksOnActiveLeaseParties,
};

const personDataFromRaw = (guest = {}) => ({
  get anyName() {
    const { person = {} } = guest;
    return person.preferredName || person.fullName;
  },
  get safeTextName() {
    const { person = {} } = guest;
    return getDisplayName(person);
  },
  get corporateCompanyName() {
    return guest.displayName || guest?.company?.displayName;
  },
  get createdAt() {
    return guest.created_at ? toMoment(guest.created_at) : null;
  },
  get memberTypeValue() {
    return weights[guest.memberType];
  },
  get isResident() {
    return isResident(guest);
  },
  ...guest,
});

const personsFromRaw = (guests = []) => {
  const result = guests.map(guest => personDataFromRaw(guest));

  // if a Set was passed instead of an array (e.g: Inmmutable??)
  if (result.toArray) return result.toArray();

  return result;
};

const compareDate = (dateA, dateB) => {
  if (dateA) {
    if (dateB) {
      return dateA.isBefore(dateB) ? -1 : dateB.isBefore(dateA) ? 1 : 0; // eslint-disable-line no-nested-ternary
    }
    return -1;
  }

  return 0;
};

export const partyFromRaw = guests => {
  const guestsArr = personsFromRaw(guests);
  const instance = {
    guests: guestsArr,
    get defaultGuestFullName() {
      const guest = instance.orderedGuests[0] || {};
      const { person = {} } = guest;
      return guest.fullName || getDisplayName(person);
    },
    get defaultGuestName() {
      return (instance.orderedGuests[0] || {}).anyName;
    },
    get defaultGuest() {
      return (instance.orderedGuests[0] || {}).safeTextName;
    },
    get orderedGuests() {
      return guestsArr.sort((guestA, guestB) => {
        if (guestA.memberType === guestB.memberType) {
          const result = compareDate(guestA.createdAt, guestB.createdAt);

          if (result !== 0) {
            return result;
          }

          const nameA = (guestA.safeTextName || '').toLowerCase();
          const nameB = (guestB.safeTextName || '').toLowerCase();
          return nameA > nameB ? 1 : nameA < nameB ? -1 : 0; // eslint-disable-line no-nested-ternary
        }

        return guestA.memberTypeValue > guestB.memberTypeValue ? 1 : -1;
      });
    },
  };

  return instance;
};

export const getPartyMembersDisplayName = partyMembers => {
  const orderedPartyMembers = partyFromRaw(partyMembers).orderedGuests;
  const lastPerson = last(orderedPartyMembers);
  const firstPersons = initial(orderedPartyMembers);
  return partyMembers.length > 1 ? `${firstPersons.map(p => getDisplayName(p)).join(', ')} and ${getDisplayName(lastPerson)}` : getDisplayName(lastPerson);
};

export const cannotChangePartyTypeToken = 'CANNOT_CHANGE_PARTY_TYPE';

export const PARTY_TYPES_CANNOT_BE_CHANGED_REASON = {
  ACTIVE_QUOTE_PROMOTION: 'ACTIVE_QUOTE_PROMOTION',
  MULTIPLE_MEMBERS: 'MULTIPLE_MEMBERS',
};

export const getLeaseTypeForParty = (party, defaultLeaseType = DALTypes.PartyTypes.TRADITIONAL) => {
  if (!{}.hasOwnProperty.call(party, 'qualificationQuestions')) return defaultLeaseType;
  const { groupProfile } = party.qualificationQuestions || {};
  return groupProfile === DALTypes.QualificationQuestions.GroupProfile.CORPORATE ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL;
};

export const isCorporateParty = ({ leaseType } = {}) => leaseType === DALTypes.PartyTypes.CORPORATE;

export const isRenewalWorkflow = ({ workflowName } = {}) => workflowName === DALTypes.WorkflowName.RENEWAL;

export const isActiveLeaseWorkflow = ({ workflowName } = {}) => workflowName === DALTypes.WorkflowName.ACTIVE_LEASE;

export const isCorporateGroupProfile = ({ groupProfile } = {}) => groupProfile === DALTypes.QualificationQuestions.GroupProfile.CORPORATE;

export const hasActiveQuotePromotion = (quotePromotions, partyId, excludeApprovedState = true) => {
  const excludedStates = [DALTypes.PromotionStatus.CANCELED, ...(excludeApprovedState ? [] : [DALTypes.PromotionStatus.APPROVED])];
  return quotePromotions.some(promotion => promotion.partyId === partyId && !excludedStates.includes(promotion.promotionStatus));
};

export const getMissingNamesOnPartyMember = ({ companyName, fullName, memberType } = {}, partyIsCorporate = false) => {
  const missingNames = !trim(fullName) ? ['fullName'] : [];
  if (!partyIsCorporate) return missingNames;

  return !trim(companyName) && isResident(memberType) ? [...missingNames, 'companyName'] : missingNames;
};

export const isMissingLegalNameOnPartyMember = ({ fullName } = {}) => !trim(fullName);

export const getDisplayNameOfPartyMemberMissingLegalName = (partyMember = {}) => {
  if (!isMissingLegalNameOnPartyMember(partyMember)) return '';

  const { defaultEmail, defaultPhone } = partyMember.contactInfo || {};
  return defaultEmail || defaultPhone;
};

export const isTaskAllowedOnCorporateParties = (taskName, taskCategory = '') => {
  const isTaskAllowed = [
    DALTypes.TaskNames.CALL_BACK,
    DALTypes.TaskNames.SEND_CONTRACT,
    DALTypes.TaskNames.COUNTERSIGN_LEASE,
    DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
    DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
    DALTypes.TaskNames.COLLECT_SERVICE_ANIMAL_DOC,
  ].includes(taskName);
  if (isTaskAllowed) return true;

  return !isTaskAllowed && taskCategory && [DALTypes.TaskCategories.MANUAL, DALTypes.TaskCategories.MANUAL_REMINDER].includes(taskCategory);
};

export const isTaskAllowedOnPartyWorkflow = ({ taskName, taskCategory = '', partyWorkflowName, partyWorkflowState }) => {
  if (taskCategory) return taskCategory === DALTypes.TaskCategories.MANUAL;
  return partyWorkflowState === DALTypes.WorkflowState.ACTIVE && (allowedTasksByWorkflow[partyWorkflowName] || []).includes(taskName);
};

export const hasAnsweredRequiredQualificationQuestions = qualificationQuestions => {
  if (!qualificationQuestions) return false;

  const { groupProfile, numBedrooms = [], numberOfUnits, moveInTime, cashAvailable } = qualificationQuestions;

  const isCorporate = groupProfile === DALTypes.QualificationQuestions.GroupProfile.CORPORATE;
  if (isCorporate) return numBedrooms.length && numberOfUnits && moveInTime;

  return !!(numBedrooms.length && cashAvailable);
};

export const getGuarantor = (guaranteedBy, partyMembers) => {
  const guarantorPartyMember = partyMembers.find(partyMember => guaranteedBy === partyMember.id) || { person: {} };
  return {
    guarantor: getDisplayName(guarantorPartyMember.person),
    guaranteedBy: guarantorPartyMember.id,
  };
};

const getPartyMemberByType = (partyMembers, memberType, additionalFilterFunc) =>
  partyMembers
    .reduce((acc, value) => {
      acc.push(value);
      return acc;
    }, [])
    .filter(member => member.memberType === memberType && (additionalFilterFunc ? additionalFilterFunc(member) : true));

const mapMembersByType = (partyMembers, memberType, additionalMapFunc, additionalFilterFunc, { enhance = true }) => {
  const membersByType = getPartyMemberByType(partyMembers, memberType, additionalFilterFunc);
  if (!enhance) return membersByType;

  return membersByType.map(({ person, ...rest }) => ({
    ...rest,
    person: {
      ...person,
      ...(additionalMapFunc ? additionalMapFunc(rest) : {}),
    },
  }));
};

export const getPartyMembersGroupedByType = (partyMembers, additionalFilterFunc, options = { enhance: true }) => {
  const residents = mapMembersByType(
    partyMembers,
    DALTypes.MemberType.RESIDENT,
    ({ guaranteedBy }) => getGuarantor(guaranteedBy, partyMembers),
    additionalFilterFunc,
    options,
  );

  const occupants = mapMembersByType(partyMembers, DALTypes.MemberType.OCCUPANT, null, additionalFilterFunc, options);

  const guarantors = mapMembersByType(
    partyMembers,
    DALTypes.MemberType.GUARANTOR,
    ({ id }) => ({
      hasGuarantees: residents.some(resident => resident.guaranteedBy === id),
    }),
    additionalFilterFunc,
    options,
  );

  return { residents, occupants, guarantors };
};

export const shouldCloseAfterMemberRemoval = (partyMembers, member) => {
  if (!(partyMembers || []).length || !member) return false;

  const { residents, occupants } = getPartyMembersGroupedByType(partyMembers, pm => pm.id !== member.id, { enhance: false });
  return [].concat(residents, occupants).length === 0;
};

export const areOccupantsAllowedOnParty = (party, partySettings = {}) => {
  const { leaseType = DALTypes.PartyTypes.TRADITIONAL } = party || {};
  return get(partySettings, `${leaseType}.showOccupantMember`) || false;
};

export const isEmergencyTaskAllowedOnParty = (party, partySettings = {}) => {
  const { leaseType = DALTypes.PartyTypes.TRADITIONAL } = party || {};
  return get(partySettings, `${leaseType}.showEmergencyContactTask`) || false;
};

export const isPartyLevelGuarantor = guarantorLevel => guarantorLevel === DALTypes.GuarantorLevel.PARTY;

export const isPartyLevelGuarantorOnTraditionalParty = (partySettings = {}) => {
  const leaseType = DALTypes.PartyTypes.TRADITIONAL;
  const guarantorLevel = get(partySettings, `${leaseType}.residentOrPartyLevelGuarantor`);
  return isPartyLevelGuarantor(guarantorLevel);
};

export const getNumberOfMembersOnCorporateParties = (partyMembers = [], allowOccupants = false) => {
  const { residents, occupants, guarantors } = getPartyMembersGroupedByType(partyMembers, null, { enhance: false });
  return [].concat(residents, guarantors, allowOccupants ? [] : occupants).length;
};

export const getPartyTypeDisabledReason = ({ id: partyId, partyMembers = [] }, newLeaseType, quotePromotions = [], allowOccupants = false) => {
  if (isCorporateParty({ leaseType: newLeaseType }) && getNumberOfMembersOnCorporateParties(partyMembers, allowOccupants) > 1) {
    return PARTY_TYPES_CANNOT_BE_CHANGED_REASON.MULTIPLE_MEMBERS;
  }
  if (!allowOccupants && partyMembers.filter(isOccupant).length) {
    return PARTY_TYPES_CANNOT_BE_CHANGED_REASON.MULTIPLE_MEMBERS;
  }

  if (hasActiveQuotePromotion(quotePromotions, partyId)) {
    return PARTY_TYPES_CANNOT_BE_CHANGED_REASON.ACTIVE_QUOTE_PROMOTION;
  }

  return '';
};

export const isScreeningRequired = (isCorporate, partyWorkflow) => !isCorporate && partyWorkflow !== DALTypes.WorkflowName.RENEWAL;

export const isCurrentParty = ({ state, workflowName, workflowState }) =>
  (workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && workflowState === DALTypes.WorkflowState.ACTIVE) ||
  (workflowName === DALTypes.WorkflowName.NEW_LEASE && state === DALTypes.PartyStateType.RESIDENT);

export const isFutureParty = ({ state }) => state === DALTypes.PartyStateType.FUTURERESIDENT || state === DALTypes.PartyStateType.LEASE;

export const isPastParty = ({ workflowName, workflowState }) =>
  workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && workflowState === DALTypes.WorkflowState.ARCHIVED;

export const BouncedCommunicationStatuses = [
  DALTypes.CommunicationStatus.BOUNCED,
  DALTypes.CommunicationStatus.FAILED,
  DALTypes.CommunicationStatus.UNDELIVERED,
];

export const COMPANY_FAKE_ID = 'company-fake-id';
