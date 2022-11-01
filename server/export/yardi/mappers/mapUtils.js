/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fromPairs from 'lodash/fromPairs';
import { toMoment } from '../../../../common/helpers/moment-utils';

export const SECDEP_CHARGE_CODE = 'secdep';
export { mapDataToFields } from '../../helpers';

export const mapDataToFieldsForOneToManys = (data, fields) => {
  const keys = Object.keys(fields);
  const pairs = keys.map(key => [key, data[key]]);

  return fromPairs(pairs);
};

export const formatDateWithTimeZone = (date, timezone) => {
  if (!date) return '';
  return toMoment(date, { timezone }).format('M/D/YYYY');
};

export const getInventoryAddress = inventory =>
  (inventory && ((inventory.building && inventory.building.address) || (inventory.property && inventory.property.address))) || {};

export const getUnitAddress = inventory => {
  if (!inventory) return '';
  if (inventory.address) return inventory.address;

  const { addressLine1, addressLine2 } = getInventoryAddress(inventory);

  return [addressLine1, addressLine2].filter(a => a).join(' ');
};

export const getUnitCode = inventory => {
  if (!inventory) return 'RevaApp';
  return inventory.externalId;
};

export const getUnitTypeCode = inventory => {
  if (!inventory) return 'RevaApp';
  const { inventorygroup = {} } = inventory;
  return inventorygroup.externalId || inventorygroup.name; // TODO: fix casing // or is it inventory.name?
};

export const formatPhoneNumberForExport = phoneNo => {
  if (!phoneNo) return '';
  // remove first character (country code = '1')
  return phoneNo[0] === '1' ? phoneNo.slice(1) : phoneNo;
};
