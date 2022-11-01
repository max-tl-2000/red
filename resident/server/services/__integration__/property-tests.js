/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { markPropertyAsAccessed } from '../property';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createACommonUser } from '../../../../server/testUtils/repoHelper';
import { toMoment } from '../../../../common/helpers/moment-utils';

describe('property services', () => {
  const propertyId = newId();
  const ctx = {
    tenantName: tenant.name,
    tenantId: tenant.id,
    propertyId,
  };

  describe('when an rxp/common user', () => {
    it('accessed to a property should update the last accessed date', async () => {
      const { commonUser } = await createACommonUser({
        tenantId: ctx.tenantId,
        personId: newId(),
        fullName: 'Luke',
        preferredName: 'Luke',
        email: 'luke@reva.tech',
      });
      const firstTimeAccessed = await markPropertyAsAccessed(ctx, { commonUserId: commonUser.id, propertyId });
      const secondTimeAccessed = await markPropertyAsAccessed(ctx, { commonUserId: commonUser.id, propertyId });

      expect(firstTimeAccessed.lastAccessed).to.exist;
      expect(secondTimeAccessed.lastAccessed).to.exist;
      expect(toMoment(firstTimeAccessed.lastAccessed).isBefore(secondTimeAccessed.lastAccessed)).to.equal(true);
    });
  });
});
