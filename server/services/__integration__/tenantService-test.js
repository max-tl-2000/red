/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx } from '../../testUtils/repoHelper';
import { getTenant, getTenantByName, getTenantSettings } from '../tenantService';
import { tenant } from '../../testUtils/setupTestGlobalContext';

const tenantKeys = [
  'id',
  'name',
  'migrations_path',
  'authorization_token',
  'metadata',
  'created_at',
  'updated_at',
  'refreshed_at',
  'settings',
  'partySettings',
  'isTrainingTenant',
];

describe('services/tenantService', () => {
  describe('When calling getTenant', () => {
    describe('should return tenant data', () => {
      it('when is just passed the ctx', async () => {
        const tenantData = await getTenant(testCtx);
        expect(tenantData).to.have.all.keys(tenantKeys);
      });

      it('when is passed the ctx and the tenantId', async () => {
        const tenantData = await getTenant(testCtx, testCtx.tenantId);
        expect(tenantData).to.have.all.keys(tenantKeys);
      });
    });
  });

  describe('When calling getTenantSettings', () => {
    describe('should return tenant settings', () => {
      it('when is just passed the ctx', async () => {
        const tenantSettings = await getTenantSettings(testCtx);
        expect(tenantSettings).to.deep.equal(tenant.settings);
      });

      it('when is passed the ctx and tenantId', async () => {
        const tenantSettings = await getTenantSettings(testCtx, testCtx.tenantId);
        expect(tenantSettings).to.deep.equal(tenant.settings);
      });
    });
  });

  describe('When calling getTenantByName', () => {
    it('should return tenant data', async () => {
      const tenantData = await getTenantByName(tenant.name);
      expect(tenantData).to.have.all.keys(tenantKeys);
    });
  });
});
