/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { now, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
import { getActiveProperties } from '../../../dal/propertyRepo';

const SKIP_VALUES = ['ResManageRentableItems', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const CSV_HEADERS = [
  'Property_Code',
  'Ref_Property_ID',
  'Tenant_Code',
  'Ext_Ref_Resident_Id',
  'RentableItemType_Code',
  'RentableItem_Code',
  'Lease_From',
  'Lease_To',
];

export const NEW_CSV_HEADERS = ['externalId', 'property', 'unitCode', 'state', 'startDate', 'availabilityDate'];

const leaseFromValue = (row, timezone) => (row.Lease_From === '' ? now({ timezone }) : parseAsInTimezone(row.Lease_From, { format: DATE_US_FORMAT, timezone }));

const getMapping = timezone => [
  { csv: 'Property_Code', excel: 'property' },
  {
    excel: 'unitCode',
    fn: row => `${row.RentableItemType_Code}-${row.RentableItem_Code}`,
  },
  {
    excel: 'state',
    // TODO: Ask avantica if we need the property.timezone here
    fn: row =>
      row.Lease_From !== '' && (row.Lease_To === '' || parseAsInTimezone(row.Lease_To, { format: DATE_US_FORMAT, timezone }) <= now({ timezone }))
        ? 'occupied'
        : 'vacantReady',
  },
  {
    excel: 'startDate',
    fn: row =>
      (row.Lease_To === '' ? leaseFromValue(row, timezone) : parseAsInTimezone(row.Lease_To, { format: DATE_US_FORMAT, timezone })).format(DATE_US_FORMAT),
  },
  {
    excel: 'externalId',
    fn: row => `${row.RentableItemType_Code}-${row.RentableItem_Code}`,
  },
  {
    excel: 'availabilityDate',
    fn: () => '', // is not defined in ResManageRentableItems file
  },
];

export const REQUIRED_HEADERS = ['Property_Code', 'RentableItemType_Code', 'RentableItem_Code', 'Lease_From', 'Lease_To'];

export const preComputeRequiredData = async ctx => {
  const properties = await getActiveProperties(ctx);

  return {
    properties,
  };
};

export const manageRentableItemsCsvMapper = (row, requiredData) => {
  const isValidRow = isValid(row);

  const property = isValidRow ? requiredData.properties.find(prop => prop.name === row.Property_Code) : undefined;
  const timezone = property ? property.timezone : '';

  return {
    valid: isValidRow,
    data: converter(row, NEW_CSV_HEADERS, getMapping(timezone)),
  };
};
