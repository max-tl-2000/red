/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { formatPropertyAddress } from '../../../common/helpers/addressUtils';
import { getLeaseSettingsForProperty } from '../leases/propertySetting';

const inventoryAddress = '370 Channing Way';
const generateTestData = (propertyName, hasInventoryAddress = false) => ({
  type: 'Unit',
  name: '164',
  address: hasInventoryAddress ? inventoryAddress : '',
  building: {
    address: {
      addressLine1: '2300 Lincoln village circle',
      city: 'Tiburon',
      state: 'CA',
      postalCode: '94920',
    },
  },
});

describe('services/leaseFormatters', () => {
  describe('When formatting a unit address using formatUnitAddress', () => {
    it('should return empty if no building prop found', () => {
      const propertySettings = getLeaseSettingsForProperty();
      const unitAddress = propertySettings.unitAddress({});
      expect(unitAddress).toEqual('');
    });

    it('should return empty if undefined is provided', () => {
      const propertySettings = getLeaseSettingsForProperty();
      const unitAddress = propertySettings.unitAddress(undefined);
      expect(unitAddress).toEqual('');
    });

    it('should use the inventory address when the inventory has one set', () => {
      const coveInvetory = generateTestData('cove', true);
      const propertySettings = getLeaseSettingsForProperty('cove');
      const unitAddress = propertySettings.unitAddress(coveInvetory);
      expect(unitAddress).toMatchSnapshot();
    });

    it('should use the building address when the inventory address is not set', () => {
      const larkInvetory = generateTestData('lark', false);
      const propertySettings = getLeaseSettingsForProperty('lark');
      const unitAddress = propertySettings.unitAddress(larkInvetory);
      expect(unitAddress).toMatchSnapshot();
    });
  });

  describe('when formatting an address using formatPropertyAddress', () => {
    it('should construct an address string from the provided data omitting blanks', () => {
      const address = formatPropertyAddress({
        addressLine1: '373 E El Camino Real',
        city: 'Sunnyvale',
        state: 'CA',
        postalCode: '95041',
      });
      expect(address).toMatchSnapshot();

      const address2 = formatPropertyAddress({
        addressLine1: '373 E El Camino Real',
        addressLine2: 'Apt 1207',
        city: 'Sunnyvale',
        state: 'CA',
        postalCode: '95041',
      });
      expect(address2).toMatchSnapshot();
    });
  });
});
