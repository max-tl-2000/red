/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from './converter';

export const EXCEL_HEADERS = ['name', 'amenity_name'];

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

const MAPPING = [
  { csv: 'Unit_Code', excel: 'name' },
  { csv: 'Amenity_Code', excel: 'amenity_name' },
];

const SKIP_VALUES = ['ResUnitAmenities', 'Property_Code'];
const SKIP_AMENITIES_CODE = ['rent'];
const isValid = row => !(SKIP_VALUES.includes(row.Property_Code) || SKIP_AMENITIES_CODE.includes(row.Amenity_Code.toLowerCase()));

export const inventoryUnitAmenitiesMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
