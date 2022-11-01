/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cloneDeep from 'lodash/cloneDeep';
import v4 from 'uuid/v4';
import { testCtx } from '../../testUtils/repoHelper';
const { mockModules } = require('test-helpers/mocker').default(jest);

const enhanceTestCtxWithTenantsCache = ctx => {
  const testCtxClone = cloneDeep(ctx);

  const { tenantId, ...tenant } = testCtxClone;

  const tenantsDalCache = { getTenantByName: { [tenant.name]: tenant }, getTenantData: { [tenant.id]: tenant } };

  testCtxClone.cache = { [tenant.id]: {} };
  testCtxClone.cache[tenant.id].dal = {
    tenants: tenantsDalCache,
  };

  return testCtxClone;
};

const newTenantName = 'new_integration_test_tenant';
const newTenantId = v4();

describe('dal/tenantsRepo', () => {
  let mocks;

  describe('When call getTenantByName', () => {
    let getTenantByName;
    let ctx;
    let tenantData;

    beforeEach(() => {
      ctx = cloneDeep({ ...testCtx, tenantId: newTenantId, id: newTenantId, name: newTenantName });
      const { tenantId, ...tenant } = ctx;
      tenantData = tenant;

      mocks = {
        '../../database/factory': {
          rawStatement: jest.fn(() => ({ rows: [tenant] })),
        },
      };

      mockModules(mocks);

      jest.resetModules();

      getTenantByName = require('../tenantsRepo').getTenantByName;
    });

    it('and ctx tenants cache is not available should retrieve the tenant data from the database and add the tenant to ctx cache', async () => {
      const tenant = await getTenantByName(ctx, ctx.name);
      expect(mocks['../../database/factory'].rawStatement).toHaveBeenCalledTimes(1);

      expect(tenant).toMatchObject(tenantData);

      expect(ctx).toMatchObject({
        ...tenantData,
        cache: {
          [ctx.tenantId]: {
            dal: {
              tenants: {
                getTenantByName: {
                  [tenantData.name]: tenantData,
                },
              },
            },
          },
        },
      });
    });

    it('and ctx tenants cache is available should return the tenant data from the ctx', async () => {
      const enhancedCtx = enhanceTestCtxWithTenantsCache(ctx);
      const tenant = await getTenantByName(enhancedCtx, ctx.name);

      expect(mocks['../../database/factory'].rawStatement).not.toHaveBeenCalled();
      expect(tenant).toMatchObject(tenantData);
    });
  });

  describe('When call getTenantData', () => {
    let getTenantData;
    let ctx;
    let tenantData;

    beforeEach(() => {
      ctx = cloneDeep({ ...testCtx, tenantId: newTenantId, id: newTenantId, name: newTenantName });
      const { tenantId, ...tenant } = ctx;
      tenantData = tenant;

      mocks = {
        '../../database/factory': {
          rawStatement: jest.fn(() => ({ rows: [tenant] })),
        },
      };

      mockModules(mocks);

      jest.resetModules();

      getTenantData = require('../tenantsRepo').getTenantData;
    });

    it('and ctx tenants cache is not available should retrieve the tenant data from the database and add the tenant to ctx cache', async () => {
      const tenant = await getTenantData(ctx, ctx.id);
      expect(mocks['../../database/factory'].rawStatement).toHaveBeenCalledTimes(1);

      expect(tenant).toMatchObject(tenantData);

      expect(ctx).toMatchObject({
        ...tenantData,
        cache: {
          [ctx.tenantId]: {
            dal: {
              tenants: {
                getTenantData: {
                  [tenantData.id]: tenantData,
                },
              },
            },
          },
        },
      });
    });

    it('and ctx tenants cache is available should return the tenant data from the ctx', async () => {
      const enhancedCtx = enhanceTestCtxWithTenantsCache(ctx);
      const tenant = await getTenantData(enhancedCtx, ctx.id);
      expect(mocks['../../database/factory'].rawStatement).not.toHaveBeenCalled();

      expect(tenant).toMatchObject(tenantData);
    });
  });
});
