/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';

export const MemberExceptionReportRules = {
  CORPORATE_EMAIL_AND_NAME_UPDATED: {
    ruleId: 'R2',
    description: 'Email and/or company name are different for a corporate point of contact',
    excludePartyData: true,
    exceptionType: DALTypes.ExceptionTypes.MEMBER,
  },
  NAME_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R6',
    description: 'Name was updated for existing person after the start of a renewal cycle',
    exceptionType: DALTypes.ExceptionTypes.MEMBER,
  },
  RESIDENT_UPDATE_WITH_EXISTING_NAME_AND_PHONE: {
    ruleId: 'R7',
    description: 'Updated name and phone for resident to existing values after renewal start',
    exceptionType: DALTypes.ExceptionTypes.MEMBER,
  },
  OCCUPANT_VACATE_DATE_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R8',
    description: 'Member vacate date updated after the start of a renewal cycle',
    exceptionType: DALTypes.ExceptionTypes.MEMBER,
  },
};

export const PartyExceptionReportRules = {
  NEW_RESIDENT_ADDED_AFTER_RENEWAL_START: {
    ruleId: 'R10',
    description: 'New resident was added after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  LEASE_END_DATE_UPDATE_AFTER_RENEWAL_START: {
    ruleId: 'R12',
    description: 'Lease end date was updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  RECURRING_CHARGES_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R13',
    description: 'Recurring charges were updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  CONCESSIONS_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R14',
    description: 'Concessions were updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  LEASE_TERM_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R15',
    description: 'Lease term was updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  PETS_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R16',
    description: 'Pets were updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
  VEHICLES_UPDATED_AFTER_RENEWAL_START: {
    ruleId: 'R17',
    description: 'Vehicles were updated after the start of a renewal cycle',
    excludePersonData: true,
    exceptionType: DALTypes.ExceptionTypes.PARTY,
  },
};

export const OtherExceptionReportRules = {
  DELETED_MEMBERS_AFTER_RENEWAL_START: {
    ruleId: 'R18',
    description: 'Members were deleted after the start of a renewal cycle',
    exceptionType: DALTypes.ExceptionTypes.OTHER,
  },
  RENEWAL_LETTER_PUBLISHED_WITHOUT_ONE_MONTH_LEASE_TERM: {
    ruleId: 'R20',
    description: 'Renewal letter published without prices for one month lease term',
    exceptionType: DALTypes.ExceptionTypes.OTHER,
  },
  NO_ONE_MONTH_LEASE_TERM: {
    ruleId: 'R22',
    description: 'No one month lease term was found for the property',
    exceptionType: DALTypes.ExceptionTypes.OTHER,
  },
  ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY: {
    ruleId: 'R23',
    description: 'Another active lease already exists for this unit',
    exceptionType: DALTypes.ExceptionTypes.OTHER,
  },
};

export const ExceptionReportIgnoreReasons = {
  PERSON_ALREADY_REMOVED_FROM_RENEWAL: {
    ruleId: 'R8',
    description: 'Person already removed from renewal',
  },
  PERSON_ALREADY_ADDED_IN_RENEWAL: {
    ruleId: 'R10',
    description: 'Person already added in renewal',
  },
};

export const ExceptionReportMetadataReplacement = {
  PHONE_CLEARED: {
    ruleId: 'R4',
    description: 'Phone was removed from EPS',
  },
  EMAIL_CLEARED: {
    ruleId: 'R5',
    description: 'Email was removed from EPS',
  },
  MEMBER_TYPE_CHANGED_AFTER_RENEWAL_START: {
    ruleId: 'R9',
    description: 'Member type is different in EPS',
  },
};
