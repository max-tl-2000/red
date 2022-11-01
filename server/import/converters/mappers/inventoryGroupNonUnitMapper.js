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

export const CSV_HEADERS = ['Property_Code', 'Ref_Property_ID', 'Charge_Code', 'RentableItemType_Code', 'Description', 'Rent', 'Taxable', 'Service_Charge'];

const MAPPING = [
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'RentableItemType_Code', excel: 'name' },
  { csv: 'Description', excel: 'displayName' },
  { csv: 'Rent', excel: 'basePriceMonthly' },
  { default: 'residential', excel: 'economicStatus (rental type)' },
];

const SKIP_VALUES = ['ResRentableItemsTypes', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const inventoryGroupNonUnitMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
