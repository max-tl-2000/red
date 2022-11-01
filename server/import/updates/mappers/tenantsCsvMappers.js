/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isWithinLastNDays } from '../../../../common/helpers/moment-utils';
import { getTenant } from '../../../services/tenantService';
import { getPropertiesToImport } from '../../../workers/importActiveLeases/importActiveLeasesHandler';

const SKIP_VALUES = ['ResTenants', 'Property_Code'];

/*
All status types:
    '0' -> Current
    '1' -> Past
    '2' -> Future
    '3' -> Eviction
    '4' -> Notice
    '5' -> Vacant
    '6' -> Applicant
    '7' -> Canceled
    '8' -> Waitlist
    '9' -> Denied
*/
const VALID_STATUS = [
  '0', // Current
  '2', // Future
  '3', // Eviction
  '4', // Notice
];

const hasValidUnitCode = unitCode => unitCode !== 'REVAAPP' && !unitCode.startsWith('NONRES');

const PARTY_STATUS_MAPPER = {
  0: DALTypes.PartyStateType.RESIDENT,
  1: DALTypes.PartyStateType.PASTRESIDENT,
  2: DALTypes.PartyStateType.FUTURERESIDENT,
  3: DALTypes.PartyStateType.RESIDENT,
  4: DALTypes.PartyStateType.RESIDENT,
};
const hasValidProperty = (row, propertiesToImport) => propertiesToImport.find(property => property.externalId === row.Property_Code);

// we'll bring the ones that are moved out within the last 7 days, in order to update the leases in Reva
const isMovedOutInThePastWeek = (row, propertiesToImport) => {
  const { timezone } = propertiesToImport.find(property => property.externalId === row.Property_Code);
  return parseInt(row.Status, 10) === 1 && isWithinLastNDays({ date: row.Move_Out_Date, days: -7, timezone });
};

const isValid = (row, propertiesToImport) =>
  !SKIP_VALUES.includes(row.Property_Code) &&
  hasValidProperty(row, propertiesToImport) &&
  (VALID_STATUS.includes(row.Status) || isMovedOutInThePastWeek(row, propertiesToImport)) &&
  hasValidUnitCode(row.Unit_Code);
// order based on populated fields count
const getPhoneNumer = row => row.Phone_Number_4 || row.Phone_Number_1 || row.Phone_Number_2 || row.Phone_Number_3;

const getLeaseTerm = row => (row.MTM === '0' ? parseInt(row.LeaseTerm, 10) : 'MTM');

const getLegalStipulationInEffectStatus = (row, residentLegalStipColumn) => {
  const fieldName = residentLegalStipColumn || 'General_Info_12';
  const field = row[fieldName];

  return !!(field && field.toLowerCase() === 'yes');
};

export const REQUIRED_HEADERS = ['Property_Code', 'Tenant_Code', 'Unit_Code', 'First_Name', 'Last_Name'];

export const CSV_HEADERS = [
  'Property_Code',
  'Ref_Property_ID',
  'Tenant_Code',
  'Ext_Ref_Tenant_Id',
  'Prospect_Code',
  'Ref_Prospect_Id',
  'Unit_Code',
  'First_Name',
  'Last_Name',
  'Social_Security_Number',
  'Move_In_Date',
  'Move_Out_Date',
  'Notice_Date',
  'Lease_From_Date',
  'Lease_To_Date',
  'Lease_Sign_Date',
  'Email',
  'Phone_Number_1',
  'Phone_Number_2',
  'Phone_Number_3',
  'Phone_Number_4',
  'Status',
  'General_Info_1',
  'General_Info_2',
  'General_Info_3',
  'General_Info_4',
  'General_Info_5',
  'General_Info_6',
  'General_Info_7',
  'General_Info_8',
  'General_Info_9',
  'General_Info_10',
  'General_Info_11',
  'General_Info_12',
  'General_Info_13',
  'General_Info_14',
  'Address1',
  'Address2',
  'City',
  'State',
  'Zipcode',
  'Rent',
  'Due_Day',
  'Last_Month_Rent_Deposit',
  'Paid_To_Date',
  'Salutation',
  'Renew_Date',
  'Security_Deposit_0',
  'Security_Deposit_1',
  'Security_Deposit_2',
  'Security_Deposit_3',
  'Security_Deposit_4',
  'Security_Deposit_5',
  'Security_Deposit_6',
  'Security_Deposit_7',
  'Security_Deposit_8',
  'Security_Deposit_9',
  'Non_Sufficient_Fund_Count',
  'Late_Fee_Count',
  'Middle_Name',
  'LateMin',
  'LatePerDay',
  'LateType',
  'LateGrace',
  'LatePercent',
  'LateGrace2',
  'LateAmount2',
  'LatePercent2',
  'LateAmountMax',
  'LatePercentMax',
  'LateDaysMax',
  'LateTypeMax',
  'LateType2',
  'LateMinDueAmount',
  'LeaseGrossSQFT',
  'MovedOut',
  'MaintenanceNotes',
  'LeaseType',
  'BillToCustomer',
  'ExtraAddressLine',
  'Gets1099',
  'Payment_Type',
  'Payable_Type',
  'ACHOptOut',
  'MTM',
  'LeaseTerm',
  'NoticeType',
  'Affordable_Type',
  'Ref_Unit_Id',
  'RGI_Type',
];

export const NEW_CSV_HEADERS = [
  'propertyExternalId',
  'externalId',
  'unitId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'status',
  'externalProspectId',
  'leaseMoveIn',
  'leaseVacateDate',
  'leaseVacateNotificationDate',
  'leaseStartDate',
  'leaseEndDate',
  'middleInitial',
  'leaseTerm',
  'renewalDate',
  'type',
  'unitRent',
  'isUnderEviction',
  'legalStipulationInEffect',
];

export const preComputeRequiredData = async ctx => {
  const tenant = await getTenant(ctx);
  const propertiesToImport = await getPropertiesToImport(ctx);

  return {
    residentLegalStipColumn: tenant?.settings?.customImport?.residentLegalStipColumn,
    propertiesToImport,
  };
};

const getMapping = residentLegalStipColumn => [
  { csv: 'Property_Code', excel: 'propertyExternalId' },
  { csv: 'Tenant_Code', excel: 'externalId' },
  { csv: 'Unit_Code', excel: 'unitId' },
  { csv: 'First_Name', excel: 'firstName' },
  { csv: 'Last_Name', excel: 'lastName' },
  { csv: 'Email', excel: 'email' },
  {
    excel: 'phone',
    fn: row => getPhoneNumer(row),
  },
  {
    default: DALTypes.ExternalMemberType.RESIDENT,
    excel: 'type',
  },
  {
    excel: 'status',
    fn: row => PARTY_STATUS_MAPPER[row.Status] || row.Status,
  },
  { csv: 'Prospect_Code', excel: 'externalProspectId' },
  { csv: 'Move_In_Date', excel: 'leaseMoveIn' },
  { csv: 'Move_Out_Date', excel: 'leaseVacateDate' },
  { csv: 'Notice_Date', excel: 'leaseVacateNotificationDate' },
  { csv: 'Lease_From_Date', excel: 'leaseStartDate' },
  { csv: 'Lease_To_Date', excel: 'leaseEndDate' },
  { csv: 'Middle_Name', excel: 'middleInitial' },
  { excel: 'leaseTerm', fn: row => getLeaseTerm(row) },
  { csv: 'Renew_Date', excel: 'renewalDate' },
  { csv: 'Rent', excel: 'unitRent' },
  { excel: 'isUnderEviction', fn: row => parseInt(row.Status, 10) === 3 },
  { excel: 'legalStipulationInEffect', fn: row => getLegalStipulationInEffectStatus(row, residentLegalStipColumn) },
];

export const tenantsCsvMapper = (row, requiredData) => ({
  valid: isValid(row, requiredData.propertiesToImport),
  data: converter(row, NEW_CSV_HEADERS, getMapping(requiredData.residentLegalStipColumn)),
});
