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
  'displayName',
  'description',
  'inventoryType',
  'leaseName',
  'basePriceMonthly',
  'basePriceWeekly',
  'basePriceDaily',
  'basePriceHourly',
  'feeName',
  'primaryRentableFlag',
  'amenities',
  'economicStatus (rental type)',
  'rentControlFlag',
  'affordableFlag',
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
  { csv: 'UnitType_Code', excel: 'name' },
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Description', excel: 'displayName' },
  { csv: 'Rent', excel: 'basePriceMonthly' },
  { default: 'unit', excel: 'inventoryType' },
  { default: 'residential', excel: 'economicStatus (rental type)' },
];

const SKIP_VALUES = ['ResUnitTypes', 'UnitType_Code'];
const isValid = row => !SKIP_VALUES.includes(row.UnitType_Code);

export const inventoryGroupMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
