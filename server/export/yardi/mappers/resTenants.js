/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import { isCorporateParty } from '../../../../common/helpers/party-utils';
import { formatDateWithTimeZone, getUnitAddress, getInventoryAddress, getUnitCode, mapDataToFields, formatPhoneNumberForExport } from './mapUtils';
import { getMoveInDate, getFirstAndLastName, getPropertyExternalId } from '../../common-export-utils';
import { truncateField, getExportName } from '../helpers';

export const TenantStatus = {
  Current: 0,
  Past: 1,
  Future: 2,
  Eviction: 3,
  Notice: 4,
  Vacant: 5,
  Applicant: 6,
  Canceled: 7,
  Waitlist: 8,
  Denied: 9,
};

const LeaseType = {
  Traditional: 0,
  Corporate: 1,
  Employee: 2,
  Section8: 3,
  Students: 5,
  GoodSamaritan: 6,
};

const getStatusForClosedParty = (party, promotedQuote) => {
  if (promotedQuote && promotedQuote.promotionStatus === DALTypes.PromotionStatus.CANCELED) {
    return TenantStatus.Denied;
  }

  return TenantStatus.Canceled;
};

const getTenantStatus = (party, promotedQuote, lease, leaseIsSignedByAllPartyMembers, minTenantStatus = '') => {
  let status = TenantStatus.Current;
  if (party.endDate) {
    status = getStatusForClosedParty(party, promotedQuote);
  } else if (party.leaseType === DALTypes.PartyTypes.CORPORATE && lease && lease.status === DALTypes.LeaseStatus.EXECUTED) {
    status = party.state === DALTypes.PartyStateType.RESIDENT ? TenantStatus.Current : TenantStatus.Future;
  } else if (party.state === DALTypes.PartyStateType.APPLICANT) {
    status = TenantStatus.Applicant;
  } else if (party.state === DALTypes.PartyStateType.FUTURERESIDENT || leaseIsSignedByAllPartyMembers) {
    status = TenantStatus.Future;
  } else if (minTenantStatus) {
    // We can only upgrade the Current status -> usually to applicant to support the holdInventory
    status = minTenantStatus;
  }

  return status;
};

const getLeaseSignDate = (lease, signDate) => {
  if (!lease || !signDate) return '';

  if (lease.status === DALTypes.LeaseStatus.VOIDED) return '';

  return signDate;
};

const getLeaseType = party => {
  const { groupProfile } = party.qualificationQuestions;
  const { CORPORATE, EMPLOYEE, SECTION8, STUDENTS, GOOD_SAMARITAN } = DALTypes.QualificationQuestions.GroupProfile;

  switch (groupProfile) {
    case CORPORATE:
      return LeaseType.Corporate;
    case EMPLOYEE:
      return LeaseType.Employee;
    case SECTION8:
      return LeaseType.Section8;
    case STUDENTS:
      return LeaseType.Students;
    case GOOD_SAMARITAN:
      return LeaseType.GoodSamaritan;
    // Anything else is considered traditional
    default:
      return LeaseType.Traditional;
  }
};

const getLeaseFromDate = lease => {
  if (!lease || lease.status === DALTypes.LeaseStatus.VOIDED) return '';

  return lease.baselineData.quote.leaseStartDate;
};

const getLeaseToDate = lease => {
  if (!lease || lease.status === DALTypes.LeaseStatus.VOIDED) return '';

  return lease.baselineData.quote.leaseEndDate;
};

const resTenantsFields = {
  Property_Code: {
    fn: ({ inventory, property, propertyToExport }) => truncateField(getPropertyExternalId({ inventory, property, propertyToExport }), 8),
    isMandatory: true,
  },
  Tenant_Code: {
    fn: ({ externalInfo }) => externalInfo && truncateField(externalInfo.externalId, 8),
    isMandatory: true,
  },
  Ext_Ref_Tenant_Id: '', // if used should be limited to 250 chars
  Prospect_Code: {
    fn: ({ externalInfo }) => externalInfo && truncateField(externalInfo.externalProspectId, 8),
    isMandatory: true,
  },
  Ref_Prospect_Id: '', // if used should be limited to 250 chars
  Unit_Code: {
    fn: ({ inventory }) => truncateField(getUnitCode(inventory), 8),
    isMandatory: true,
  },
  First_Name: {
    fn: ({ party, partyMember, companyName }) =>
      isCorporateParty(party) ? getExportName(partyMember, companyName, 50) : truncateField(getFirstAndLastName(partyMember).firstName, 50),
    isMandatory: true,
  },
  Last_Name: {
    fn: ({ party, partyMember, companyName }) =>
      isCorporateParty(party) ? getExportName(partyMember, companyName, 100) : truncateField(getFirstAndLastName(partyMember).lastName, 100),
    isMandatory: true,
  },
  Move_In_Date: {
    fn: ({ lease, party, property }) => formatDateWithTimeZone(getMoveInDate(lease, party, property.timezone), property.timezone),
    isMandatory: true,
  },
  Lease_From_Date: {
    fn: ({ lease, property }) => formatDateWithTimeZone(getLeaseFromDate(lease), property.timezone),
  },
  Lease_To_Date: {
    fn: ({ lease, property }) => formatDateWithTimeZone(getLeaseToDate(lease), property.timezone),
  },
  Lease_Sign_Date: {
    fn: ({ lease, signDate, property }) => formatDateWithTimeZone(getLeaseSignDate(lease, signDate), property.timezone),
  },
  Email: {
    fn: ({ partyMember }) => truncateField(partyMember.contactInfo?.defaultEmail, 80),
  },
  Phone_Number_4: {
    fn: ({ partyMember }) => truncateField(formatPhoneNumberForExport(partyMember.contactInfo?.defaultPhone), 20),
  },
  Status: {
    fn: ({ party, promotedQuote, lease, leaseIsSignedByAllPartyMembers, minTenantStatus }) =>
      getTenantStatus(party, promotedQuote, lease, leaseIsSignedByAllPartyMembers, minTenantStatus),
    isMandatory: true,
  },
  Address1: {
    fn: ({ inventory }) => truncateField(getUnitAddress(inventory), 80),
  },
  City: {
    fn: ({ inventory }) => truncateField(getInventoryAddress(inventory).city, 40),
  },
  State: {
    fn: ({ inventory }) => truncateField(getInventoryAddress(inventory).state, 60),
  },
  Zipcode: {
    fn: ({ inventory }) => truncateField(getInventoryAddress(inventory).postalCode, 16),
  },
  Rent: {
    fn: ({ lease }) => (lease ? lease.baselineData.quote.unitRent : '0'),
    isMandatory: true,
  },
  Due_Day: '1',
  Security_Deposit_0: '',
  LeaseGrossSQFT: '0',
  MovedOut: '0',
  LeaseType: {
    fn: ({ party }) => truncateField(getLeaseType(party), 120),
    isMandatory: true,
  },
  Gets1099: 0,
  MTM: 0,
  LeaseTerm: {
    fn: ({ leaseTerm }) => (leaseTerm ? leaseTerm.termLength : 0),
  },
};

export const createResTenantsMapper = data => [mapDataToFields(data, resTenantsFields)];
