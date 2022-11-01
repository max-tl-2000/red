/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from './converter';

export const EXCEL_HEADERS = [
  'name (see note)',
  'property',
  'displayName',
  'description',
  'inventoryType',
  'numBedrooms',
  'numBathrooms',
  'surfaceArea',
  'floorCount',
  'amenities',
];

export const CSV_HEADERS = [
  'UnitType_Code',
  'Ref_Property_ID',
  'Property_Code',
  'Description',
  'Rent',
  'SQFT',
  'Beds',
  'Baths',
  'Deposit',
  'MinimumRent',
  'Maximim_Rent',
  'UserDefined_1',
  'UserDefined_2',
  'UserDefined_3',
  'UserDefined_4',
];

const MAPPING = [
  {
    excel: 'name (see note)',
    fn: row => `${row.UnitType_Code}Layout`,
  },
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Description', excel: 'displayName' },
  { csv: 'SQFT', excel: 'surfaceArea' },
  { csv: 'Beds', excel: 'numBedrooms' },
  { csv: 'Baths', excel: 'numBathrooms' },
  { default: 'unit', excel: 'inventoryType' },
];

const SKIP_VALUES = ['ResUnitTypes', 'UnitType_Code'];
const isValid = row => !SKIP_VALUES.includes(row.UnitType_Code);

export const layoutMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
