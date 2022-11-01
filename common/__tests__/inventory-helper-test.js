/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('Inventory helper', () => {
  const quoteLabel = 'Quote';
  const renewalLabel = 'Renewal Quote';

  let getQuoteActionLabel;
  let formatName;
  let shouldEnableQuoteAction;

  beforeEach(() => {
    mockModules({
      i18next: {
        t: (...args) => {
          if (args.length > 1) return renewalLabel;
          return quoteLabel;
        },
      },
    });
  getQuoteActionLabel = require('../inventory-helper').getQuoteActionLabel; // eslint-disable-line
  formatName = require('../inventory-helper').formatName; // eslint-disable-line
  shouldEnableQuoteAction = require('../inventory-helper').shouldEnableQuoteAction; // eslint-disable-line
  });

  describe('Format building address with placeholders', () => {
    const baseInventory = {
      name: '1001',
      type: 'unit',
    };

    [
      {
        inventory: { ...baseInventory, building: { address: {} } },
        result: 'Unit 1001',
      },
      {
        inventory: {
          ...baseInventory,
          building: { address: { addressLine1: '', addressLine2: '' } },
        },
        result: 'Unit 1001',
      },
      {
        inventory: {
          ...baseInventory,
          building: {
            address: { addressLine1: '30 Barbaree way', addressLine2: '' },
          },
        },
        result: 'Unit 1001, 30 Barbaree way',
      },
      {
        inventory: {
          ...baseInventory,
          building: {
            address: {
              addressLine1: '30 Barbaree way',
              addressLine2: '%inventoryType%-%inventoryName%',
            },
          },
        },
        result: 'Unit 1001, 30 Barbaree way, unit-1001',
      },
      {
        inventory: {
          ...baseInventory,
          building: {
            address: {
              addressLine1: '30-%inventoryType%-%inventoryName% Barbaree way',
              addressLine2: '',
            },
          },
        },
        result: 'Unit 1001, 30-unit-1001 Barbaree way',
      },
    ].forEach(({ inventory, result: expectedResult }) => {
      const { addressLine1, addressLine2 } = inventory.building.address;
      it(`It should return a formatted address - addressLine1: '${addressLine1}' and addressLine2: '${addressLine2}'`, () => {
        const result = formatName(inventory);
        expect(result).toEqual(expectedResult);
      });
    });
  });

  describe('Enabling/disabling unit quote action and displaying quote label', () => {
    [
      {
        unit: { adjustedMarketRent: 2233, isRenewal: false },
        type: 'non renewal',
        action: 'enable',
        label: quoteLabel,
        leaseState: DALTypes.LeaseState.NEW,
        result: true,
      },
      {
        unit: { isRenewal: true },
        type: 'renewal',
        action: 'disable',
        label: quoteLabel,
        leaseState: DALTypes.LeaseState.RENEWAL,
        result: false,
      },
      {
        unit: { isRenewal: true, adjustedMarketRent: 2233 },
        type: 'renewal',
        action: 'enable',
        label: renewalLabel,
        leaseState: DALTypes.LeaseState.RENEWAL,
        result: true,
      },
      {
        unit: { isRenewal: true, adjustedMarketRent: 2233 },
        type: 'duplicate quote',
        action: 'disable',
        label: quoteLabel,
        leaseState: DALTypes.LeaseState.NEW,
        result: false,
      },
      {
        unit: { adjustedMarketRent: 2233 },
        type: 'duplicate quote',
        action: 'disable',
        label: quoteLabel,
        leaseState: DALTypes.LeaseState.RENEWAL,
        result: false,
      },
      {
        unit: {},
        isRenewalParty: false,
        type: 'non renewal',
        action: 'disable',
        label: quoteLabel,
        leaseState: DALTypes.LeaseState.RENEWAL,
        result: false,
      },
    ].forEach(({ unit, type, action, label, leaseState, result: expectedResult }, index) => {
      describe(`When it's a ${type} party and unit with price: ${unit.adjustedMarketRent}. Index ${index}`, () => {
        it(`It should ${action} the quote action and display the ${label} label`, () => {
          const result = shouldEnableQuoteAction(unit, { leaseState });
          expect(result).toEqual(expectedResult);
          expect(getQuoteActionLabel(unit, { leaseState })).toEqual(label);
        });
      });
    });
  });
});
