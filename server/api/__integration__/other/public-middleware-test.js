/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import getUUID from 'uuid/v4';
import app from '../../api';
import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';
import { createAParty, createATask } from '../../../testUtils/repoHelper';
import { getPartyDocumentByPartyId } from '../../../dal/partyDocumentRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { X_REQUEST_ID } from '../../../../common/enums/requestHeaders';

describe('requestTrackingHandler', () => {
  let party;
  let documentVersion;
  let delayedMessageUrl;
  let delayedMessagePayload;
  let authHeader;

  beforeEach(async () => {
    await enableAggregationTriggers(tenant.id);
    party = await createAParty();
    await createATask({ name: 'tst', partyId: party.id });
    const doc = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
    documentVersion = doc.id;
    delayedMessageUrl = `/public/party/${party.id}/delayedMessages`;
    delayedMessagePayload = { customPayload: 'Custom Payload', delay: 172800000, partyID: party.id, ruleName: 'LackOfInboundComms' };
    authHeader = getAuthHeader(tenant.id, party.userId, null, false, { partyId: party.id, documentVersion });
  });

  describe('requestTrackingHandler', () => {
    it('should return 400 and DECISION_SERVICE_LOOP_DETECTED if a request loop is detected', async () => {
      const reqId = getUUID();
      const results = [];

      results.push(await request(app).post(delayedMessageUrl).set(authHeader).set(X_REQUEST_ID, reqId).send(delayedMessagePayload));
      results.push(await request(app).post(delayedMessageUrl).set(authHeader).set(X_REQUEST_ID, reqId).send(delayedMessagePayload));
      results.push(await request(app).post(delayedMessageUrl).set(authHeader).set(X_REQUEST_ID, reqId).send(delayedMessagePayload));
      results.push(await request(app).post(delayedMessageUrl).set(authHeader).set(X_REQUEST_ID, reqId).send(delayedMessagePayload));

      const firstThreeResults = results.slice(0, 3);
      const lastResult = results.pop();

      expect(firstThreeResults.every(res => res.status === 200)).to.be.true;
      expect(lastResult.status).to.equal(400);
      expect(lastResult.body.token).to.equal('DECISION_SERVICE_LOOP_DETECTED');
    });
  });
});
