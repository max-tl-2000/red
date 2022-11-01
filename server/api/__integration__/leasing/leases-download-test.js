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
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { createLeaseTestData, createLease } from '../../../testUtils/leaseTestHelper';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { createDocument } from '../../../dal/documentsRepo';

const ctx = { tenantId: tenant.id };

const createDoc = async leaseId =>
  await createDocument(ctx, {
    uuid: getUUID(),
    accessType: 'private',
    context: 'signed-lease',
    metadata: {
      leaseId,
      uploadFileName: 'test-lease.pdf',
    },
  });

/* These tests need to be refactored to take into consideration that documents not available
   until after lease execution */
describe.skip('Download lease', () => {
  describe('/leases/download', () => {
    it('downloads the lease specified in the token', async () => {
      const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
      const lease = await createLease(partyId, userId, promotedQuote.id, team);
      await createDoc(lease.id);
      const token = createJWTToken({ tenantId: tenant.id, id: userId, leaseId: lease.id });

      await request(app).get(`/leases/download?token=${token}`).expect(200);
    });

    describe('when the leaseId is not specified in the token', () => {
      it('returns 400 and MISSING_LEASE', async () => {
        const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
        const lease = await createLease(partyId, userId, promotedQuote.id, team);
        await createDoc(lease.id);
        const token = createJWTToken({ tenantId: tenant.id, id: userId });

        await request(app)
          .get(`/leases/download?token=${token}`)
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('MISSING_LEASE'));
      });
    });

    describe('when the lease has not been executed yet ', () => {
      it('returns 412 and LEASE_NOT_EXECUTED', async () => {
        const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
        const lease = await createLease(partyId, userId, promotedQuote.id, team);

        const token = createJWTToken({ tenantId: tenant.id, id: userId, leaseId: lease.id });

        await request(app)
          .get(`/leases/download?token=${token}`)
          .expect(412)
          .expect(res => expect(res.body.token).to.equal('LEASE_NOT_EXECUTED'));
      });
    });
  });

  /* TODO: publish and execute lease so this test is valid again
  describe.skip('when the document entry for the lease does not exists ', () => {
    it('returns 412 and LEASE_NOT_EXECUTED', async () => {
      const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
      const lease = await createLease(partyId, userId, promotedQuote.id, team);

      const token = createJWTToken({ tenantId: tenant.id, id: userId, leaseId: lease.id });

      await request(app)
        .get(`/leases/download?token=${token}`)
        .expect(412)
        .expect(res => expect(res.body.token).to.equal('LEASE_NOT_EXECUTED');
    });
  });
  */
  describe('/leases/:leaseId/download', () => {
    it('downloads the lease specified in the URL', async () => {
      const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
      const lease = await createLease(partyId, userId, promotedQuote.id, team);
      await createDoc(lease.id);

      await request(app).get(`/leases/${lease.id}/download`).set(getAuthHeader()).expect(200);
    });

    describe('when the leaseId is not specified', () => {
      it('returns 404', async () => {
        await request(app).get('/leases//download').set(getAuthHeader()).expect(404);
      });
    });
  });
});
