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
  'type',
  'description',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'startDate',
  'endDate',
  'floorCount',
  'surfaceArea',
  'amenities',
];

export const CSV_HEADERS = [
  'Property_Code',
  'Building_Code',
  'Building_Name',
  'Address_1',
  'Address_2',
  'Address_3',
  'Address_4',
  'City',
  'State',
  'Zip_Code',
  'Country',
  'Notes',
  'Ext_Ref_Building_Id',
  'Ref_Property_Id',
  'Lot',
  'UserDefined_1',
  'UserDefined_2',
  'UserDefined_3',
  'UserDefined_4',
  'UserDefined_5',
  'UserDefined_6',
];

const MAPPING = [
  { csv: 'Building_Code', excel: 'name' },
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Building_Name', excel: 'displayName' },
  { csv: 'Notes', excel: 'description' },
  { csv: 'Address_1', excel: 'addressLine1' },
  { csv: 'Address_2', excel: 'addressLine2' },
  { csv: 'City', excel: 'city' },
  { csv: 'State', excel: 'state' },
  { csv: 'Zip_Code', excel: 'postalCode' },
];

const SKIP_VALUES = ['CommBuildings', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const buildingsMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
