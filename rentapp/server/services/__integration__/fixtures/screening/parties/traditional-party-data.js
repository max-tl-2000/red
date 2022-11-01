/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../../../../common/enums/DALTypes';
import { PROPERTY_SCENARIOS } from './screening-party-data';
import { ApplicantReportStatus } from '../../../../../../../common/enums/screeningReportTypes';
import { ServiceNames } from '../../../../../../../common/enums/applicationTypes';
import { BlockedServiceErrors } from '../../../../helpers/party-application-helper';
import { unknownBlockedMessage } from '../../../../../test-utils/party-screening-test-helper';

const { MemberType, PartyTypes } = DALTypes;
const { COMPILING, ERROR } = ApplicantReportStatus;

export const getParties = properties => {
  const parties = {
    ALL_REPORTS_REQUIRED: {
      COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES: {
        ID: 0,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [],
      },
      COMPLETE_HAS_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 1,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 2,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 3,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },

      COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS: {
        ID: 4,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_NO_QUOTES: {
        ID: 5,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [],
      },
      COMPLETE_NO_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 6,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 7,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 8,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_NO_QUOTES: {
        ID: 9,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 10,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 11,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 12,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_NO_QUOTES: {
        ID: 13,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 14,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 15,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 16,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_WITH_SERVICE_BLOCKED_ERROR: {
        ID: 17,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
        blockedServiceStatus: { service: ServiceNames.CRIMINAL, serviceBlockedStatus: BlockedServiceErrors.CRIMINAL },
      },
      COMPLETE_HAS_APPLICANT_DATA_WITH_UNKNOWN_SERVICE_BLOCKED_ERROR: {
        ID: 18,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID] },
        partyMembers: [{ memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: true }],
        quotes: [properties[PROPERTY_SCENARIOS.ALL_APPLICANT_REPORTS_REQUIRED.ID]],
        blockedServiceStatus: { service: ServiceNames.CREDIT, serviceBlockedStatus: unknownBlockedMessage },
      },
    },
    SINGLE_REPORT_REQUIRED: {
      COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES: {
        ID: 0,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [],
      },
      COMPLETE_HAS_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 1,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 2,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 3,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS: {
        ID: 4,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: ERROR, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: ERROR, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, activeReportStatus: ERROR, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_NO_QUOTES: {
        ID: 5,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [],
      },
      COMPLETE_NO_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 6,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 7,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 8,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: true },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_NO_QUOTES: {
        ID: 9,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 10,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 11,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 12,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: true, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: true, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_NO_QUOTES: {
        ID: 13,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_SINGLE_QUOTE: {
        ID: 14,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES: {
        ID: 15,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
      },
      NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES: {
        ID: 16,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.RESIDENT, hasApplicantData: false, guarantorAssigned: false },
          { memberType: MemberType.OCCUPANT, hasApplicantData: false, guarantorAssigned: false },
        ],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID], properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
      },
      COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS_WITH_SERVICE_BLOCKED_ERROR: {
        ID: 17,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID] },
        partyMembers: [{ memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: false }],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CREDIT_REPORT_REQUIRED.ID]],
        blockedServiceStatus: { service: ServiceNames.CREDIT, serviceBlockedStatus: BlockedServiceErrors.CREDIT_BUREAU },
      },
      COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS_WITH_UNKNOWN_SERVICE_BLOCKED_ERROR: {
        ID: 18,
        partyData: { partyType: PartyTypes.TRADITIONAL, assignedProperty: properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID] },
        partyMembers: [{ memberType: MemberType.RESIDENT, hasApplicantData: true, activeReportStatus: COMPILING, guarantorAssigned: true }],
        quotes: [properties[PROPERTY_SCENARIOS.ONLY_CRIMINAL_REPORT_REQUIRED.ID]],
        blockedServiceStatus: { service: ServiceNames.CRIMINAL, serviceBlockedStatus: unknownBlockedMessage },
      },
    },
  };

  return parties;
};
