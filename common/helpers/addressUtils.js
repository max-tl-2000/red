/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { formatInventoryName } from '../inventory-helper';
import { isString } from './type-of';
const ZIP_CODE_SEPARATOR = ' ';

export const formatSimpleAddress = ({ addressLine1, addressLine2, city, state, zip, postalCode }) =>
  [addressLine1, addressLine2, city, state, zip || postalCode].filter(item => item).join(' ');

const toReadableString = (values, connector = ', ') => values.filter(item => item).join(connector);
export const formatShortAddress = ({ addressLine1, city }) => [addressLine1, city].filter(item => item).join(', ');

export const formatLongAddress = ({ addressLine1, city, state, zip, postalCode }) =>
  `${[addressLine1, city, state].filter(item => item).join(', ')}${ZIP_CODE_SEPARATOR}${zip || postalCode}`;

export const formatFullAddress = ({ addressLine1, addressLine2, city, state, zip, postalCode }) => ({
  fullAddressLine1: addressLine1,
  fullAddressLine2: addressLine2,
  fullAddressLine3: `${[city, state].filter(item => item).join(', ')}${ZIP_CODE_SEPARATOR}${zip || postalCode}`,
});
export const formatStateAndPostalCode = (state, postalCode) => toReadableString([state, postalCode], ' ');

const hasValidAddress = address => !!Object.keys(address || {}).length;

export const hasValidBuildingAddress = (building = {}) => hasValidAddress(building.address);

export const getUnitAddress = propertyName => (inventory = {}) => {
  if (!hasValidBuildingAddress(inventory.building)) return {};
  const COVE = 'cove';
  const SWPARKME = 'swparkme';
  const SHARON = 'sharon';
  const { city, state, postalCode } = inventory.building.address;
  let addressLine1 = inventory.building.address.addressLine1;
  let addressLine2 = inventory.building.address.addressLine2;

  if (propertyName === SHARON) {
    // sharon = <building.addressLine1>, <building.addressLine2>, <inventory.type> <building.name>-<inventory.name>, <building.city>, <building.state> <building.postalCode>""
    // For example - 350 Sharon Park Drive, Unit G-005, Menlo Park, CA 94025"
    addressLine2 = toReadableString([addressLine2, formatInventoryName(inventory, true)]);
  } else if (propertyName === COVE || propertyName === SWPARKME) {
    // <inventory.address>, <building.city>, <building.state> <building.postalCode>
    // For example -  111 Barbaree Way, Belvedere Tiburon, CA 94920
    addressLine1 = inventory.address;
    addressLine2 = '';
  } else {
    // lark, wood, shore = <building.addressLine1>, <building.addressLine2>, <inventory.type> <inventory.name>, <building.city>, <building.state> <building.postalCode>
    // For example - 2300 Lincoln village circle, Unit 164, Larkspur, CA 94536
    addressLine2 = toReadableString([addressLine2, formatInventoryName(inventory)]);
  }
  return {
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
  };
};

export const formatUnitAddress = (inventory = {}) => {
  const { addressLine1: buildingAddressLine1, addressLine2: buildingAddressLine2, city: buildingCity, state: buildingState, postalCode: buildingPostalCode } =
    (inventory.building || {}).address || {};

  const { addressLine1: propertyAddressLine1, addressLine2: propertyAddressLine2, city: propertyCity, state: propertyState, postalCode: propertyPostalCode } =
    (inventory.property || {}).address || {};

  let address;
  if (inventory.inventoryAddress || (inventory.address && isString(inventory.address))) {
    // <inventory.address>, <building.city>, <building.state>, <building.postalCode>
    // eg. 111 Barbaree Way, Belvedere Tiburon, CA 94920
    const inventoryCity = buildingCity || propertyCity;
    const inventoryState = buildingState || propertyState;
    const inventoryPostalCode = buildingPostalCode || propertyPostalCode;

    address = [inventory.inventoryAddress || inventory.address, inventoryCity, formatStateAndPostalCode(inventoryState, inventoryPostalCode)];
  } else if (hasValidBuildingAddress(inventory.building)) {
    // <building.addressLine1>, <building.addressLine2>, <inventory.type> <inventory.name>, <building.city>, <building.state> <building.postalCode>
    // eg. 2300 Lincoln village circle, Unit 164, Larkspur, CA 94536
    address = [
      buildingAddressLine1,
      buildingAddressLine2,
      formatInventoryName(inventory),
      buildingCity,
      formatStateAndPostalCode(buildingState, buildingPostalCode),
    ];
  }

  // <property.addressLine1>, <property.addressLine2>, <inventory.type> <inventory.name>, <property.city>, <property.state> <property.postalCode>
  // eg. 2300 Lincoln village circle, Unit 164, Larkspur, CA 94536
  if (!address) {
    address = [
      propertyAddressLine1,
      propertyAddressLine2,
      formatInventoryName(inventory),
      propertyCity,
      formatStateAndPostalCode(propertyState, propertyPostalCode),
    ];
  }

  return toReadableString(address);
};

export const formatPropertyAddress = ({ addressLine1, addressLine2, city, state, postalCode }) =>
  toReadableString([addressLine1, addressLine2, city, formatStateAndPostalCode(state, postalCode)]);

export const formatBuildingAddress = inventory => {
  const buildingAddress = inventory.building.address;
  const propertyAddress = inventory.property.address;

  if (!hasValidBuildingAddress(inventory.building)) return formatPropertyAddress(propertyAddress);

  const { addressLine1, addressLine2 } = buildingAddress;
  const city = buildingAddress.city || propertyAddress.city;
  const state = buildingAddress.state || propertyAddress.state;
  const postalCode = buildingAddress.postalCode || propertyAddress.postalCode;

  return toReadableString([addressLine1, addressLine2, city, formatStateAndPostalCode(state, postalCode)]);
};
