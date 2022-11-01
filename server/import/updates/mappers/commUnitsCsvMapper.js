/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { getTenant } from '../../../services/tenantService';

export const REQUIRED_HEADERS = ['Unit_Code', 'Attributes_4'];

export const NEW_CSV_HEADERS = ['externalId', 'lossLeaderUnitFlag'];

export const CSV_HEADERS = [
  'Property_Code',
  'Bldg_Code',
  'Floor_Code',
  'Unit_Code',
  'Rental_Type',
  'Country',
  'Ext_Ref_Unit_Id',
  'Ref_Property_Id',
  'Ref_Building_Id',
  'Ref_Floor_Id',
  'Available_Date',
  'Date_Ready',
  'Address_1',
  'Address_2',
  'Address_3',
  'Address_4',
  'City',
  'State',
  'Zip_Code',
  'Rent',
  'SQFT',
  'Rent_Ready',
  'Exclude',
  'Unit_Type',
  'Location',
  'BedRooms',
  'Attributes_1',
  'Attributes_2',
  'Attributes_3',
  'Attributes_4',
  'Attributes_5',
  'Attributes_6',
  'Attributes_7',
  'Attributes_8',
  'Attributes_9',
  'Attributes_10',
  'MLA',
  'Lease_Type',
  'Userdefined_1',
  'Userdefined_2',
  'Userdefined_3',
  'Userdefined_4',
  'Userdefined_5',
  'Userdefined_6',
  'Userdefined_7',
  'Userdefined_8',
  'Userdefined_9',
  'Userdefined_10',
  'Notes',
];

export const preComputeRequiredData = async ctx => {
  const tenant = await getTenant(ctx);
  return {
    lossLeaderUnitColumn: tenant?.settings?.customImport?.lossLeaderUnitColumn,
  };
};

const getLossLeaderUnitFlag = (row, lossLeaderUnitColumn) => {
  const fieldName = lossLeaderUnitColumn || 'Attributes_4';
  const field = row[fieldName];
  return (!!(field && field.toLowerCase() === 'yes')).toString();
};

const getMapping = requiredData => [
  { csv: 'Unit_Code', excel: 'externalId' },
  { excel: 'lossLeaderUnitFlag', fn: row => getLossLeaderUnitFlag(row, requiredData.lossLeaderUnitColumn) },
];

const SKIP_VALUES = ['CommUnits', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const commUnitCsvMapper = (row, requiredData) => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, getMapping(requiredData)),
});
