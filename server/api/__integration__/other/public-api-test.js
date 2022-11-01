/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createAParty, createATask, createAUser } from '../../../testUtils/repoHelper';
import { getPartyDocumentByPartyId } from '../../../dal/partyDocumentRepo';
import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';

describe('API/', () => {
  let party;
  let task;
  let version;
  beforeEach(async () => {
    await enableAggregationTriggers(tenant.id);
    party = await createAParty();
    const { id, ...rest } = await createATask({ name: 'tst', partyId: party.id });
    task = rest;
    const doc = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
    version = doc.id;
    await createAUser({ email: 'admin@reva.tech' });
  });

  describe('given a valid request', () => {
    it('will return 200', async () => {
      const res = await request(app)
        .post(`/public/party/${party.id}/tasks`)
        .set(getAuthHeader(tenant.id, party.userId, null, false, { partyId: party.id, documentVersion: version }))
        .send(task);
      expect(res.status).to.equal(200);
    });
  });

  describe('given an invalid request', () => {
    describe('with missing partyId', () => {
      it('will return 400', async () => {
        const res = await request(app).post(`/public/party/${party.id}/tasks`).set(getAuthHeader(tenant.id, party.userId, null, false)).send(task);
        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_PARTY_ID');
      });
    });

    describe('with missing document version', () => {
      it('will return 400', async () => {
        const res = await request(app)
          .post(`/public/party/${party.id}/tasks`)
          .set(getAuthHeader(tenant.id, party.userId, null, false, { partyId: party.id }))
          .send(task);
        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_DOCUMENT_VERSION');
      });
    });

    describe('with invalid partyId', () => {
      it('will return 400', async () => {
        const res = await request(app)
          .post(`/public/party/${party.id}/tasks`)
          .set(getAuthHeader(tenant.id, party.userId, null, false, { partyId: 'invalid-uuid', documentVersion: version }))
          .send(task);
        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INVALID_PARTY_ID');
      });
    });
  });
});
