/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import getUUID from 'uuid/v4';
import app from '../../../../server/api/api';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createJWTToken } from '../../../../common/server/jwt-helpers';

describe('/webhooks/paymentNotification', () => {
  describe('POST', () => {
    describe('Given a valid request', () => {
      it('will return 200', async () => {
        const req = {
          tenantId: tenant.id,
          personApplicationId: getUUID(),
        };
        const token = createJWTToken({ tenantId: tenant.id });
        await request(app).post(`/webhooks/paymentNotification?token=${token}`).send(req).expect(200);
      });
    });

    describe('Given an invalid request', () => {
      it('will return 400', async () => {
        const req = {};
        await request(app).post('/webhooks/paymentNotification').send(req).expect(401);
      });
    });
  });
});
