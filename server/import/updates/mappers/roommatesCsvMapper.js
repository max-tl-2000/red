/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { DALTypes } from '../../../../common/enums/DALTypes';

const SKIP_VALUES = ['ResRoommates', 'Tenant_Code'];
const hasNameOrEmail = row => row.Roommate_FirstName || row.Roommate_LastName || row.Roommate_Email;

const isLessee = row => parseInt(row.Roommate_Occupant, 10) === 0;
const isChild = row => parseInt(row.Occupant_Type, 10) === 2;
const isGuarantorRelationship = row => row.Roommate_Relationship === 'Guarantor';

const isOccupant = row => !isLessee(row) && !isGuarantorRelationship(row) && !isChild(row);

const getMemberType = row => {
  if (isChild(row) && !isLessee(row)) return DALTypes.ExternalMemberType.CHILD;
  if (isGuarantorRelationship(row)) return DALTypes.ExternalMemberType.GUARANTOR;
  return DALTypes.ExternalMemberType.RESIDENT;
};

const hasValidTenantCode = (tenantCode, validTenantCodes) => {
  if (!validTenantCodes.length) return true;
  return validTenantCodes.some(code => code === tenantCode);
};

const isValid = (row, validTenantCodes) =>
  !SKIP_VALUES.includes(row.Tenant_Code) && !isOccupant(row) && hasNameOrEmail(row) && hasValidTenantCode(row.Tenant_Code, validTenantCodes);

const getEmail = row => row.Roommate_Email.trim() || row.Roommate_ALTEmail.trim();

// order based on populated fields count
const getPhoneNumber = row =>
  row.Roommate_PhoneNumber1.trim() || row.Roommate_PhoneNumber4.trim() || row.Roommate_PhoneNumber2.trim() || row.Roommate_PhoneNumber3.trim();

export const REQUIRED_HEADERS = ['Property_Code', 'Tenant_Code', 'Unit_Code', 'Roommate_Code'];

export const CSV_HEADERS = [
  'Tenant_Code',
  'Ext_Ref_Tenant_Id',
  'Roommate_PhoneNumber1',
  'Roommate_PhoneNumber2',
  'Roommate_PhoneNumber3',
  'Roommate_PhoneNumber4',
  'Roommate_UserDefined0',
  'Roommate_UserDefined1',
  'Roommate_UserDefined2',
  'Roommate_UserDefined3',
  'Roommate_UserDefined4',
  'Roommate_UserDefined5',
  'Roommate_UserDefined6',
  'Roommate_UserDefined7',
  'Roommate_UserDefined8',
  'Roommate_UserDefined9',
  'Roommate_SSN',
  'Property_Code',
  'Ref_Property_ID',
  'Unit_Code',
  'Ref_Unit_Id',
  'Ext_Ref_Roommate_Id',
  'Roommate_Salutation',
  'Roommate_LastName',
  'Roommate_FirstName',
  'Roommate_Email',
  'Roommate_ALTEmail',
  'Roommate_MoveIn',
  'Roommate_MoveOut',
  'Occupant_Type',
  'Roommate_Occupant',
  'Roommate_ACHOptOut',
  'Roommate_Relationship',
  'Roommate_Notes',
  'Roommate_Code',
];

export const NEW_CSV_HEADERS = [
  'externalId',
  'primaryExternalId',
  'propertyExternalId',
  'unitId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'moveInDate',
  'vacateDate',
  'type',
];

const MAPPING = [
  { csv: 'Roommate_Code', excel: 'externalId' },
  { csv: 'Tenant_Code', excel: 'primaryExternalId' },
  { csv: 'Property_Code', excel: 'propertyExternalId' },
  { csv: 'Unit_Code', excel: 'unitId' },
  { csv: 'Roommate_FirstName', excel: 'firstName' },
  { csv: 'Roommate_LastName', excel: 'lastName' },
  { excel: 'email', fn: row => getEmail(row) },
  {
    excel: 'phone',
    fn: row => getPhoneNumber(row),
  },
  { csv: 'Roommate_MoveIn', excel: 'moveInDate' },
  { csv: 'Roommate_MoveOut', excel: 'vacateDate' },
  { excel: 'type', fn: row => getMemberType(row) },
];

export const roommatesCsvMapper = (row, requiredData) => ({
  valid: isValid(row, requiredData.validTenantCodes),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
