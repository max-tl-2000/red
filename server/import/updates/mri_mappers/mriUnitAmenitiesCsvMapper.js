/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';

const SKIP_VALUES = ['MRI-UnitAmenities', 'PropertyID'];
const isValid = row => !SKIP_VALUES.includes(row.PropertyID) && row.ChangeDate.trim();

export const CSV_HEADERS = ['PropertyID', 'Building', 'UnitID', 'AmenityCode', 'Description', 'Amount', 'ChangeDate', 'UnitIdentifier', 'ID'];

export const NEW_CSV_HEADERS = [
  'propertyExternalId',
  'building',
  'unitId',
  'amenityName',
  'description',
  'amount',
  'changeDate',
  'externalId',
  'amenityExternalId',
];

const MAPPING = [
  { csv: 'PropertyID', excel: 'propertyExternalId' },
  { csv: 'Building', excel: 'building' },
  { csv: 'UnitID', excel: 'unitId' },
  { csv: 'AmenityCode', excel: 'amenityName' },
  { csv: 'Description', excel: 'description' },
  { csv: 'Amount', excel: 'amount' },
  { csv: 'ChangeDate', excel: 'changeDate' },
  { csv: 'UnitIdentifier', excel: 'externalId' },
  { csv: 'ID', excel: 'amenityExternalId' },
];

export const MAPPING_AMENITIES = {
  propertyExternalId: 'propertyId',
  amenityName: 'name',
  description: 'displayName',
  amenityExternalId: 'externalId',
  amount: 'absolutePrice',
};

export const MAPPING_INVENTORY_AMENITY = {
  inventoryId: 'inventoryId',
  amenityId: 'amenityId',
  endDate: 'endDate',
};

export const DEFAULT_AMENITY_VALUES = {
  category: 'inventory',
  description: '',
  hidden: true,
  highValue: false,
  infographicName: null,
  order: 0,
  relativePrice: null,
  subCategory: 'import',
  targetUnit: false,
};

export const EXCLUDE_AMENITY_COLUMNS = {
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  NAME: 'name',
  CATEGORY: 'category',
  SUBCATEGORY: 'subCategory',
  DESCRIPTION: 'description',
  HIDDEN: 'hidden',
  PROPERTYID: 'propertyId',
  HIGHVALUE: 'highValue',
  RELATIVEPRICE: 'relativePrice',
  TARGETUNIT: 'targetUnit',
  INFOGRAPHICNAME: 'infographicName',
  ORDER: 'order',
  EXTERNALID: 'externalId',
  ENDDATE: 'endDate',
};

export const REQUIRED_HEADERS = ['PropertyID', 'Building', 'UnitID', 'AmenityCode', 'Description', 'Amount', 'ChangeDate', 'UnitIdentifier', 'ID'];

export const mriUnitAmenitiesCsvMapper = row => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
