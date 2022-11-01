/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export { FADV_RESPONSE_STATUS } from '../../rentapp/common/screening-constants';

export const ScreeningDecision = {
  APPROVED: 'approved',
  GUARANTOR_REQUIRED: 'Guarantor Required',
  DECLINED: 'declined',
  FURTHER_REVIEW: 'further_review',
  DISPUTED: 'disputed',
  INCOMPLETE: 'incomplete',
  APPROVED_WITH_COND: 'approved_with_cond',
  NO_SCREENING_REQUEST: 'no_screening_request',
  NO_SCREENING_RESPONSE: 'no_screening_response',
  NO_SCREENING_RESPONSE_INTERNATIONAL_ADDRESS: 'no_screening_response_international_address',
  ERROR_ADDRESS_UNPARSABLE: 'error_address_unparsable',
  ERROR_RESPONSE_UNPARSABLE: 'error_response_unparsable',
  ERROR_OTHER: 'error_other',
  SCREENING_IN_PROGRESS: 'screening_in_progress',
  GUARANTOR_DENIED: 'Guarantor Denied',
  COMPILING: 'compiling',
  COMPILING_DELAYED: 'compiling_delayed',
  RESULTS_DELAYED: 'results_delayed',
  ON_HOLD: 'on_hold',
  EXPIRED: 'expired',
  PENDING: 'pending',
  DRAFT: 'draft',
};

export const REVA_SERVICE_STATUS = {
  COMPLETE: 'COMPLETE',
  BLOCKED: 'BLOCKED',
  IN_PROCESS: 'IN_PROCESS',
  INCOMPLETE: 'INCOMPLETE',
};

export const ServiceNames = {
  SSN: 'SSN',
  CREDIT: 'Credit',
  EVICTION: 'Eviction',
  SKIPWATCH: 'SkipWatch',
  CRIMINAL: 'Criminal',
  SEXOFFENDER: 'SexOffender',
  COLLECTIONS: 'Collections',
  CRIMINAL_OFFLINE: 'Criminal Offline',
  SEX_OFFENDER_OFFLINE: 'Sex Offender Offline',
  GLOBAL_SANCTIONS_OFFLINE: 'Global Sanctions Offline',
  NEAR_INSTANT: 'NearInstant',
};

export const GroupServiceNames = {
  CREDIT: 'credit',
  CRIMINAL: 'criminal',
};

export const ApplicationSections = {
  incomeSourcesSection: 'incomeSourcesSection',
  addressHistorySection: 'addressHistorySection',
  childrenSection: 'childrenSection',
  disclosuresSection: 'disclosuresSection',
  petsSection: 'petsSection',
  privateDocumentsSection: 'privateDocumentsSection',
  rentersInsuranceSection: 'rentersInsuranceSection',
  sharedDocumentsSection: 'sharedDocumentsSection',
  vehiclesSection: 'vehiclesSection',
};

export const ApplicationSettingsTypes = {
  holdDepositWithoutUnit: 'holdDepositWithoutUnit',
};

export const HoldDepositApplicationSettingsValues = {
  REQUIRED_BY_FIRST_RESIDENT_APPLICANT: 'requiredByFirstResidentApplicant',
  OPTIONAL: 'optional',
  HIDDEN: 'hidden',
};

export const ApplicationSettingsValues = {
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  HIDDEN: 'hidden',
};

export const SharedSections = [
  ApplicationSections.petsSection,
  ApplicationSections.childrenSection,
  ApplicationSections.vehiclesSection,
  ApplicationSections.sharedDocumentsSection,
];

export const BlockedReasons = {
  DISPUTE: 'dispute',
  ADDRESS: 'address',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
  CREDIT_FREEZE: 'creditFreeze',
};

export const approvedScreening = ['approved'];
export const conditionalScreening = ['approved_with_cond', 'further_review', 'disputed', 'guarantor required'];
export const deniedScreening = ['declined'];
