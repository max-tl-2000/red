/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { isCorporateParty } from '../../../../common/helpers/party-utils';
import { formatDateWithTimeZone, getUnitAddress, getUnitCode, getUnitTypeCode, mapDataToFields, formatPhoneNumberForExport } from './mapUtils';
import { getMoveInDate, getFirstAndLastName, getPropertyExternalId } from '../../common-export-utils';
import trim from '../../../../common/helpers/trim';
import { truncateField, getExportName } from '../helpers';
import { ALPHANUMERIC_PLUS_SPACE } from '../../../../common/regex';
import { RentappTypes } from '../../../../rentapp/common/enums/rentapp-types';
import { getGrossIncomeMonthly } from '../../../../rentapp/common/helpers/applicant-helpers';

export const ProspectStatus = {
  Applied: 1,
  Canceled: 3,
  Canceled_Guest: 4,
  Denied: 5,
  Prospect: 6,
  Resident: 7,
};

const getStatusForClosedParty = (promotedQuote, application) => {
  if (promotedQuote && promotedQuote.promotionStatus === DALTypes.PromotionStatus.CANCELED) {
    return ProspectStatus.Denied;
  }

  if (!application) return ProspectStatus.Canceled_Guest;

  return ProspectStatus.Canceled;
};

const getProspectStatus = (party, application, promotedQuote, lease, leaseIsSignedByAllPartyMembers, minProspectStatus = '') => {
  let status = ProspectStatus.Prospect;

  if (leaseIsSignedByAllPartyMembers) {
    status = ProspectStatus.Resident;
  } else if ([DALTypes.PartyStateType.FUTURERESIDENT, DALTypes.PartyStateType.RESIDENT, DALTypes.PartyStateType.PASTRESIDENT].includes(party.state)) {
    status = ProspectStatus.Resident;
  } else if (isCorporateParty(party) && lease && lease.status === DALTypes.LeaseStatus.EXECUTED) {
    status = ProspectStatus.Resident;
  } else if (party.endDate) {
    // Closed party
    status = getStatusForClosedParty(promotedQuote, application);
  } else if (application?.paymentCompleted) {
    // applications
    status = ProspectStatus.Applied;
  } else if (minProspectStatus) {
    // We can only upgrade the Prospect status -> usually to applicant to support the holdInventory
    status = minProspectStatus;
  }

  return status;
};

const getLeaseFromOrMoveIn = lease => {
  if (!lease) return now().toJSON();
  if (lease.status === DALTypes.LeaseStatus.VOIDED) {
    return null;
  }

  return lease.baselineData.quote.leaseStartDate;
};

const getLeaseToOrMoveOut = (lease, party, leaseTerm, timezone) => {
  if (!lease) {
    const months = leaseTerm ? leaseTerm.termLength : 12;
    return now({ timezone }).add(months, 'M');
  }

  if (lease.status === DALTypes.LeaseStatus.VOIDED) {
    return '';
  }

  return lease.baselineData.quote.leaseEndDate;
};

const getPreferredBedrooms = party => {
  const bedrooms = party.qualificationQuestions.numBedrooms;
  if (!bedrooms || !bedrooms.length) return 0;

  // minimum number of bedrooms from the qualification questions selection
  const minBedrooms = bedrooms[0];
  return DALTypes.QualificationQuestions.BedroomOptions[minBedrooms];
};

const getFirstContactDate = party => party.metadata.firstContactedDate || party.startDate;

const getFirstContactType = party => {
  const contactType = party.metadata.firstContactChannel || 'Other';
  switch (contactType) {
    case DALTypes.ContactEventTypes.SMS:
      return 'SMS';
    case DALTypes.ContactEventTypes.CALL:
      return 'Call';
    case DALTypes.ContactEventTypes.EMAIL:
      return 'Email';
    case DALTypes.ContactEventTypes.PHONE:
      return 'Phone';
    case DALTypes.ContactEventTypes.WALKIN:
      return 'Walk-In';
    default:
      return 'Other';
  }
};

const getDateApplied = invoice => (invoice || {}).updated_at;

const getDateApproved = quotePromotion =>
  quotePromotion && quotePromotion.promotionStatus === DALTypes.PromotionStatus.APPROVED ? quotePromotion.updated_at : '';

const getDateDenied = quotePromotion =>
  quotePromotion && quotePromotion.promotionStatus === DALTypes.PromotionStatus.CANCELED ? quotePromotion.updated_at : '';

const getVehicleLicensePlate = vehicles => {
  const [firstVehicle] = vehicles || [];

  if (!firstVehicle) return '';

  const licensePlateWithoutSpecialCharacters = firstVehicle.info.tagNumber.replace(ALPHANUMERIC_PLUS_SPACE, '');

  return trim(licensePlateWithoutSpecialCharacters);
};

const getDateOfBirth = application => {
  if (!application) return '';

  return formatDateWithTimeZone(application?.applicationData.dateOfBirth);
};

const getCompanyAndPositionData = application => {
  let company = DALTypes.EMPLOYMENT_TYPE.NO_INCOME_SOURCE;
  let jobTitle = DALTypes.EMPLOYMENT_TYPE.NO_INCOME_SOURCE;

  const normalizedIncomes = application?.additionalData?.incomeSourceHistory?.map(income => ({ ...income, grossIncome: getGrossIncomeMonthly(income) }));
  const sortedIncomes = normalizedIncomes?.sort((a, b) => b.grossIncome - a.grossIncome);
  const [highestIncome, ...additionalIncomes] = sortedIncomes || [];

  const income = highestIncome?.grossIncome ? Number(truncateField(Math.floor(highestIncome.grossIncome), 9)) : 0;
  const additionalIncome = Number(truncateField(Math.floor(additionalIncomes.reduce((a, b) => a + b.grossIncome, 0)), 9));

  if (highestIncome) {
    switch (highestIncome.incomeSourceType) {
      case RentappTypes.IncomeSourceType.EMPLOYMENT:
        company = highestIncome.employerName || DALTypes.EMPLOYMENT_TYPE.NOT_PROVIDED;
        jobTitle = highestIncome.jobTitle || DALTypes.EMPLOYMENT_TYPE.NOT_PROVIDED;
        break;
      case RentappTypes.IncomeSourceType.SELF_EMPLOYMENT:
        company = DALTypes.EMPLOYMENT_TYPE.SELF_EMPLOYED;
        jobTitle = DALTypes.EMPLOYMENT_TYPE.SELF_EMPLOYED;
        break;
      case RentappTypes.IncomeSourceType.OTHER_SOURCE:
        company = DALTypes.EMPLOYMENT_TYPE.OTHER_SOURCES;
        jobTitle = DALTypes.EMPLOYMENT_TYPE.OTHER_SOURCES;
        break;
      default:
        break;
    }
  }

  return { company: truncateField(company, 60), jobTitle: truncateField(jobTitle, 30), income, additionalIncome };
};

export const resProspectsFields = {
  Prospect_Code: {
    fn: ({ externalInfo }) => externalInfo && truncateField(externalInfo.externalProspectId, 8),
    isMandatory: true,
  },
  Ref_Prospect_Id: '', // if this changes it should be limited to 250 chars
  Tenant_Code: {
    fn: ({ externalInfo }) => externalInfo && truncateField(externalInfo.externalId, 8),
    isMandatory: true,
  },
  Ext_Ref_Tenant_Id: '', // if this changes it should be limited to 250 chars
  FirstName: {
    fn: ({ party, partyMember, companyName }) => {
      const firstName = isCorporateParty(party) ? getExportName(partyMember, companyName, 40) : getFirstAndLastName(partyMember).firstName;
      return truncateField(firstName, 40);
    },
    isMandatory: true,
  },
  MiddleName: '', // if this changes it should be limited to 40 chars
  LastName: {
    fn: ({ party, partyMember, companyName }) => {
      const lastName = isCorporateParty(party) ? getExportName(partyMember, companyName, 40) : getFirstAndLastName(partyMember).lastName;
      return truncateField(lastName, 40);
    },
    isMandatory: true,
  },
  Address1: {
    fn: ({ inventory }) => truncateField(getUnitAddress(inventory), 40),
  },
  City: {
    fn: ({ inventory }) => inventory && truncateField(inventory.building.address.city, 30),
  },
  State: {
    fn: ({ inventory }) => inventory && truncateField(inventory.building.address.state, 4),
  },
  Zipcode: {
    fn: ({ inventory }) => inventory && truncateField(inventory.building.address.postalCode, 12),
  },
  HowLong: {
    fn: ({ leaseTerm }) => (leaseTerm && leaseTerm.termLength !== 0 ? leaseTerm.termLength : ''),
  },
  CellPhone: {
    fn: ({ partyMember }) => truncateField(formatPhoneNumberForExport(partyMember.contactInfo?.defaultPhone), 14),
  },
  Email: {
    fn: ({ partyMember }) => truncateField(trim(partyMember.contactInfo?.defaultEmail), 80),
  },
  // Values range from 10 to 90 in increments of 10 and represent various stages in the Yardi leasing workflow.
  // For our purposes we will always set this to 90 until we hear otherwise from a client.
  LeaseStep: 90,
  Status: {
    fn: ({ party, application, promotedQuote, lease, minProspectStatus, leaseIsSignedByAllPartyMembers }) =>
      getProspectStatus(party, application, promotedQuote, lease, leaseIsSignedByAllPartyMembers, minProspectStatus),
    isMandatory: true,
  },
  Preferred_Rent: '',
  Preferred_Bedrooms: {
    fn: ({ party }) => getPreferredBedrooms(party),
  },
  Preferred_Bath: '',
  Preferred_MoveIn: {
    fn: ({ lease, party, property }) => formatDateWithTimeZone(getMoveInDate(lease, party, property.timezone), property.timezone),
    isMandatory: true,
  },
  Property_Code: {
    fn: ({ inventory, property, propertyToExport }) => truncateField(getPropertyExternalId({ inventory, property, propertyToExport }), 8),
    isMandatory: true,
  },
  UnitType_Code: {
    fn: ({ inventory }) => truncateField(getUnitTypeCode(inventory), 8),
    isMandatory: true,
  },
  Unit_Code: {
    fn: ({ inventory }) => truncateField(getUnitCode(inventory), 8),
    isMandatory: true,
  },
  LeaseFrom: {
    fn: ({ lease, property }) => formatDateWithTimeZone(getLeaseFromOrMoveIn(lease), property.timezone),
  },
  LeaseTo: {
    fn: ({ lease, party, leaseTerm, property }) => formatDateWithTimeZone(getLeaseToOrMoveOut(lease, party, leaseTerm, property.timezone), property.timezone),
  },
  Source: {
    fn: ({ sourceName }) => truncateField(sourceName || 'Reva', 30),
  },
  Agent: {
    fn: ({ user }) => truncateField(user.fullName, 30),
    isMandatory: true,
  },
  First_Contacted_On: {
    fn: ({ party, property }) => formatDateWithTimeZone(getFirstContactDate(party), property.timezone),
    isMandatory: true,
  },
  Date_Show: {
    fn: ({ firstShowDate, property }) => formatDateWithTimeZone(firstShowDate, property.timezone),
  },
  Date_Applied: {
    fn: ({ invoice, property }) => formatDateWithTimeZone(getDateApplied(invoice), property.timezone),
  },
  Date_Approved: {
    fn: ({ quotePromotion, property }) => formatDateWithTimeZone(getDateApproved(quotePromotion), property.timezone),
  },
  Date_Canceled: {
    fn: ({ partyCloseDate, property }) => formatDateWithTimeZone(partyCloseDate, property.timezone),
  },
  Date_Denied: {
    fn: ({ quotePromotion, property }) => formatDateWithTimeZone(getDateDenied(quotePromotion), property.timezone),
  },
  Notes: ':Reva', // if this changes it should be limited to 256 chars
  LeaseTerm: {
    fn: ({ leaseTerm }) => (leaseTerm ? leaseTerm.termLength : 0),
  },
  FirstContactType: {
    fn: ({ party }) => truncateField(getFirstContactType(party), 20),
    isMandatory: true,
  },
  sAutoLicense1: {
    fn: ({ vehicles }) => getVehicleLicensePlate(vehicles),
  },
  // eslint-disable-next-line camelcase
  Date_Of_Birth: {
    fn: ({ application }) => getDateOfBirth(application),
  },
  FedId: '999-99-9999', // this should be the SSN, but for now we will push 999-99-9999, as described in CPM-20128
  Company: {
    fn: ({ incomeData }) => incomeData.company,
  },
  Position: {
    fn: ({ incomeData }) => incomeData.jobTitle,
  },
  Income: {
    fn: ({ incomeData }) => incomeData.income,
  },
  // eslint-disable-next-line camelcase
  CurrentEmployment_AdditionalIncome: {
    fn: ({ incomeData }) => incomeData.additionalIncome,
  },
};

export const createResProspectsMapper = data => {
  const incomeData = getCompanyAndPositionData(data?.application);
  return [mapDataToFields({ ...data, incomeData }, resProspectsFields)];
};
