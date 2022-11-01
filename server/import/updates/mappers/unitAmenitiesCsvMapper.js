/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';

const SKIP_VALUES = ['ResUnitAmenities', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code) && row.Current_Charge_Date.trim();

export const CSV_HEADERS = [
  'Property_Code',
  'Unit_Code',
  'Amenity_Code',
  'Amenity_Name',
  'Amenity_Description',
  'Prior_Charge',
  'Prior_Charge_Date',
  'Current_Charge',
  'Current_Charge_Date',
  'Proposed_Charge',
  'Proposed_Charge_Date',
  'Notes',
  'Ref_Property_ID',
  'Ref_Unit_Id',
];

export const NEW_CSV_HEADERS = ['property', 'unitCode', 'amenityName', 'currentChargeDate', 'currentCharge', 'externalId'];

const MAPPING = [
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Unit_Code', excel: 'unitCode' },
  { csv: 'Amenity_Name', excel: 'amenityName' },
  { csv: 'Current_Charge_Date', excel: 'currentChargeDate' },
  { csv: 'Current_Charge', excel: 'currentCharge' },
  { csv: 'Unit_Code', excel: 'externalId' },
];

export const REQUIRED_HEADERS = ['Property_Code', 'Unit_Code', 'Amenity_Name', 'Current_Charge_Date', 'Current_Charge'];

export const unitAmenitiesCsvMapper = row => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
