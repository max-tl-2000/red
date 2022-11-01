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
  'building',
  'multipleItemTotal',
  'description',
  'type',
  'state',
  'parentInventory',
  'floor',
  'layout',
  'inventoryGroup',
  'amenities',
  'externalId',
];

export const CSV_HEADERS = [
  'Property_Code',
  'Ref_PropertyID',
  'RentableItemType_Code',
  'RentableItem_Code',
  'Description',
  'Rent',
  'Reserved_Until',
  'Reserved_Prospect_Code',
  'Reversed_Tenant_Code',
];

const MAPPING = [
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'RentableItemType_Code', excel: 'inventoryGroup' },
  { csv: 'RentableItem_Code', excel: 'name' },
  { csv: 'Description', excel: 'description' },
  { default: 'vacantReady', excel: 'state' },
  {
    excel: 'externalId',
    fn: row => `${row.RentableItemType_Code}-${row.RentableItem_Code}`,
  },
];

const SKIP_VALUES = ['ResRentableItems', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const inventoryRentableItemsMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
