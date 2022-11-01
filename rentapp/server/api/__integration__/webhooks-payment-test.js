/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import getUUID from 'uuid/v4';
import { expect } from 'chai';
import app from '../../../../server/api/api';
import { setupConsumers } from '../../../../server/workers/consumer';
import { waitForOne } from '../../../../server/testUtils/apiHelper';
import { chan, createResolverMatcher } from '../../../../server/testUtils/setupTestGlobalContext';
import { testCtx as ctx } from '../../../../server/testUtils/repoHelper';
import { createJWTToken } from '../../../../common/server/jwt-helpers';

describe('/webhooks/paymentNotification', () => {
  describe('POST', () => {
    describe('Given a request', () => {
      it('will return 200 and post message to queue', async () => {
        const msg = { invoiceId: getUUID(), personApplicationId: getUUID() };
        const gotMsgAndProcessed = (receivedMsg, processed) => {
          const matched = receivedMsg.invoiceId === msg.invoiceId;
          if (matched && !processed) {
            throw new Error('got match but did not process');
          }
          return matched;
        };

        const { resolver, promise } = waitForOne(gotMsgAndProcessed);
        // TODO: change this to payment queue
        const matcher = createResolverMatcher([resolver]);
        await setupConsumers(chan(), matcher, ['screening']);

        const token = createJWTToken({ tenantId: ctx.tenantId });
        await request(app).post(`/webhooks/paymentNotification?tenantId=${ctx.tenantId}&token=${token}`).send(msg).expect(200);

        const res = await promise;
        await expect(res).to.be.true;
      });
    });
  });
});
