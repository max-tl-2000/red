/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from './converter';

export const EXCEL_HEADERS = [
  'name',
  'property',
  'category',
  'subCategory',
  'displayName',
  'description',
  'highValueFlag',
  'relativePrice (%)',
  'absolutePrice ($)',
  'targetUnitFlag (applicable to building and property categories)',
  'hiddenFlag',
];

export const CSV_HEADERS = [
  'Property_Code',
  'Amenity_Code',
  'Amenity_Description',
  'Amenity_Name',
  'Prior_Charge',
  'Prior_Charge_Date',
  'Current_Charge',
  'Current_Charge_Date',
  'Proposed_Charge',
  'Proposed_Charge_Date',
  'Notes',
];

const MAPPING = [
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Amenity_Code', excel: 'name' },
  { csv: 'Amenity_Description', excel: 'description' },
  { csv: 'Amenity_Name', excel: 'displayName' },
  { csv: 'Current_Charge', excel: 'absolutePrice ($)' },
  { default: 'inventory', excel: 'category' },
];

const SKIP_VALUES = ['ResPropertyAmenities', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const amenityMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
