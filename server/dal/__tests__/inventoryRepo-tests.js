/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { LA_TIMEZONE } from '../../../common/date-constants';
import { toMoment } from '../../../common/helpers/moment-utils';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('dal/inventoryRepo', () => {
  let mocks;
  let saveInventory;

  describe('saveInventory', () => {
    const mockedNowMoment = toMoment('2018-07-12T07:00:00.000Z');
    describe('positive cases', () => {
      beforeEach(() => {
        mocks = {
          '../../database/factory': {
            insertOrUpdate: jest.fn(),
          },
          '../../../common/helpers/moment-utils': {
            now: () => mockedNowMoment,
          },
          '../../services/properties': {
            getPropertyTimezone: () => LA_TIMEZONE,
          },
          '../../../common/helpers/logger': {
            error: jest.fn(),
            warn: jest.fn(),
            child: jest.fn(),
          },
        };

        mockModules(mocks);

        jest.resetModules();

        saveInventory = require('../inventoryRepo').saveInventory;
      });

      it('if `stateStartDate` is not provided it should use `now` at startOf day for the property timezone', async () => {
        await saveInventory({ tenantId: 'mockTenantId' }, { name: '102', propertyId: '594eff40-5520-4b54-ac7e-75a38ae54497' });

        expect(mocks['../../database/factory'].insertOrUpdate).toHaveBeenCalledWith({ tenantId: 'mockTenantId' }, 'Inventory', {
          name: '102',
          propertyId: '594eff40-5520-4b54-ac7e-75a38ae54497',
          stateStartDate: mockedNowMoment.toJSON(),
        });
      });
    });

    describe('errors and warnigns', () => {
      beforeEach(() => {
        mocks = {
          '../../database/factory': {
            insertOrUpdate: jest.fn(),
          },
          '../../services/properties': {
            getPropertyTimezone: () => '',
          },
          '../../../common/helpers/logger': {
            error: jest.fn(),
            warn: jest.fn(),
            child: jest.fn(),
          },
        };

        mockModules(mocks);

        jest.resetModules();

        saveInventory = require('../inventoryRepo').saveInventory;
      });

      it('should throw a Service Error if we attempt to insert an inventory without an instance to save', async () => {
        try {
          await saveInventory({ tenantId: 'mockTenantId' }, null);
          expect(false).toBe(true); // this should never happen
        } catch (err) {
          expect(err.message).toEqual('inventory parameter is mandatory');
        }
      });

      it('should throw a Service Error if we attempt to insert an inventory without a propertyId', async () => {
        try {
          await saveInventory({ tenantId: 'mockTenantId' }, {});
          expect(false).toBe(true); // this should never happen
        } catch (err) {
          expect(err.message).toEqual('`propertyId` is not defined in the inventory to save');
        }
      });

      it('should log a warning if we attempt to insert an inventory an the property does not have a timezone configured', async () => {
        await saveInventory({ tenantId: 'mockTenantId' }, { propertyId: '594eff40-5520-4b54-ac7e-75a38ae54497', name: 'inventory 102' });

        expect(mocks['../../../common/helpers/logger'].warn).toHaveBeenCalledWith(
          { ctx: { tenantId: 'mockTenantId' }, propertyId: '594eff40-5520-4b54-ac7e-75a38ae54497' },
          '`timezone` is null or empty for the provided `propertyId`',
        );
      });
    });
  });
});
