/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import allApplicantReportsRequired from '../../property/settings/all-applicant-reports-required.json';
import onlyCreditReportsRequired from '../../property/settings/only-credit-reports-required.json';
import onlyCriminalApplicantReportsRequired from '../../property/settings/only-criminal-reports-required.json';
import { getParties as getTraditionalParties } from './traditional-party-data';
import { getParties as getCorporateParties } from './corporate-party-data';
import {
  standardTraditionalCriteria,
  standardCorporateCriteria,
  specialTraditionalCriteria,
  specialCorporateCriteria,
} from '../../property/settings/screening-criteria';

export const ScreeningCriteriaType = {
  STANDARD_TRADITIONAL: 'standard-traditional',
  SPECIAL_TRADITIONAL: 'special-traditional',
  STANDARD_CORPORATE: 'standard-corporate',
  SPECIAL_CORPORATE: 'special-corporate',
};

const standardScreeningCriterias = [
  { name: ScreeningCriteriaType.STANDARD_TRADITIONAL, screeningCriteria: standardTraditionalCriteria },
  { name: ScreeningCriteriaType.STANDARD_CORPORATE, screeningCriteria: standardCorporateCriteria },
];

const specialScreeningCriterias = [
  { name: ScreeningCriteriaType.SPECIAL_TRADITIONAL, screeningCriteria: specialTraditionalCriteria },
  { name: ScreeningCriteriaType.SPECIAL_CORPORATE, screeningCriteria: specialCorporateCriteria },
];

export const PROPERTY_SCENARIOS = {
  ALL_APPLICANT_REPORTS_REQUIRED: { ID: 0, settings: allApplicantReportsRequired, screeningCriterias: standardScreeningCriterias },
  ONLY_CREDIT_REPORT_REQUIRED: { ID: 1, settings: onlyCreditReportsRequired, screeningCriterias: specialScreeningCriterias },
  ONLY_CRIMINAL_REPORT_REQUIRED: { ID: 2, settings: onlyCriminalApplicantReportsRequired, screeningCriterias: specialScreeningCriterias },
};

export const PARTY_TYPE = {
  TRADITIONAL: 'TRADITIONAL',
  CORPORATE: 'CORPORATE',
};

export const getPartyData = (properties, partyType = PARTY_TYPE.TRADITIONAL) =>
  partyType === PARTY_TYPE.TRADITIONAL ? getTraditionalParties(properties) : getCorporateParties(properties);
