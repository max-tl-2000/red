/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { formatSimpleAddress, formatUnitAddress } from '../addressUtils';

describe('format simple address', () => {
  it('should return a formatted simple address when valid address values are provided', () => {
    const validAddressObject = {
      addressLine1: 'address',
      city: 'city',
      state: 'state',
      zip: '12345',
    };
    const simpleAddress = formatSimpleAddress(validAddressObject);
    const expectedSimpleAddress = 'address city state 12345';
    expect(simpleAddress).to.equal(expectedSimpleAddress);
  });

  it('should return empty when no valid address values are provided', () => {
    const invalidAddressObject = {
      address: 'address',
    };
    const simpleAddress = formatSimpleAddress(invalidAddressObject);
    expect(simpleAddress).to.be.empty;
  });
});

describe('format unit address', () => {
  const baseInventoryObj = {
    type: 'unit',
    name: '001SALT',
  };

  const coloradoAddress = {
    addressLine1: '3201 Brighton Blvd',
    addressLine2: '',
    city: 'Denver',
    state: 'CO',
    postalCode: '80216',
  };

  const michiganAddress = {
    addressLine1: '4 Warrior Park',
    addressLine2: '',
    city: 'Garden Grove',
    state: 'MI',
    postalCode: '92844',
  };

  describe('when the unit has no inventory address and is linked to a building (default format)', () => {
    it('should return a formatted address using the inventory building address ', () => {
      const inventory = {
        ...baseInventoryObj,
        building: {
          address: coloradoAddress,
        },
      };
      const formattedAddress = formatUnitAddress(inventory);
      const expectedFormattedAddress = '3201 Brighton Blvd, Unit 001SALT, Denver, CO 80216';
      expect(formattedAddress).to.equal(expectedFormattedAddress);
    });
  });
  describe('when the unit has an inventory address (highest precedence)', () => {
    describe('and the unit is linked to a building', () => {
      it('should return a formatted address using the inventory building address ', () => {
        const inventory = {
          ...baseInventoryObj,
          address: '1 Salt Landing',
          building: {
            address: coloradoAddress,
          },
        };
        let formattedAddress = formatUnitAddress(inventory);
        let expectedFormattedAddress = '1 Salt Landing, Denver, CO 80216';
        expect(formattedAddress).to.equal(expectedFormattedAddress);

        delete inventory.address;
        inventory.inventoryAddress = '2 Salt Landing';
        formattedAddress = formatUnitAddress(inventory);
        expectedFormattedAddress = '2 Salt Landing, Denver, CO 80216';
        expect(formattedAddress).to.equal(expectedFormattedAddress);

        inventory.address = michiganAddress;
        formattedAddress = formatUnitAddress(inventory);
        expect(formattedAddress).to.equal(expectedFormattedAddress);
      });
    });
    describe('and the unit is not linked to a building', () => {
      it('should return a formatted address using the inventory property address', () => {
        const inventory = {
          ...baseInventoryObj,
          address: '1 Salt Landing',
          property: {
            address: michiganAddress,
          },
        };
        const formattedAddress = formatUnitAddress(inventory);
        const expectedFormattedAddress = '1 Salt Landing, Garden Grove, MI 92844';
        expect(formattedAddress).to.equal(expectedFormattedAddress);
      });
    });
    describe('and the unit has incomplete building and property address', () => {
      it('should return a formatted address by trying to form the address using available building and property address', () => {
        const inventory = {
          ...baseInventoryObj,
          address: '1 Salt Landing',
          building: {
            address: {
              addressLine1: '3201 Brighton Blvd',
              addressLine2: '',
              state: 'CO',
            },
          },
          property: {
            address: michiganAddress,
          },
        };
        const formattedAddress = formatUnitAddress(inventory);
        const expectedFormattedAddress = '1 Salt Landing, Garden Grove, CO 92844';
        expect(formattedAddress).to.equal(expectedFormattedAddress);
      });
    });
  });
  describe('when the unit has no inventory address and is not linked to a building (fallback format)', () => {
    it('should return a formatted address using the inventory property address', () => {
      const inventory = {
        ...baseInventoryObj,
        property: {
          address: {
            ...michiganAddress,
            addressLine2: 'US',
          },
        },
      };
      const formattedAddress = formatUnitAddress(inventory);
      const expectedFormattedAddress = '4 Warrior Park, US, Unit 001SALT, Garden Grove, MI 92844';
      expect(formattedAddress).to.equal(expectedFormattedAddress);
    });
  });
  describe('when the unit is not linked to a building and has no property address', () => {
    it('should return a formatted address', () => {
      const inventory = {
        ...baseInventoryObj,
      };
      let formattedAddress = formatUnitAddress(inventory);
      let expectedFormattedAddress = 'Unit 001SALT';
      expect(formattedAddress).to.equal(expectedFormattedAddress);

      inventory.address = michiganAddress.addressLine1;
      formattedAddress = formatUnitAddress(inventory);
      expectedFormattedAddress = inventory.address;
      expect(formattedAddress).to.equal(expectedFormattedAddress);
    });
  });
});
