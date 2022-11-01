/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import request from 'supertest';
import getUUID from 'uuid/v4';
import { createAUser } from '../../../testUtils/repoHelper';
import app from '../../api';
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { setProviderOps } from '../../../workers/communication/adapters/plivoServiceAdapter';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { updateTenant } from '../../../services/tenantService';
import { loadUserById } from '../../../services/users';
import { updateUser } from '../../../dal/usersRepo';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/users', () => {
  let user;

  function makeUpdateRequest(userId, delta) {
    return request(app).patch(`/users/${userId}`).set(getAuthHeader()).send(delta);
  }

  function getUser() {
    return request(app).get(`/users/${user.id}`).set(getAuthHeader()).send();
  }

  beforeEach(async () => {
    user = await createAUser();
  });

  describe('when updating a user with empty user id', () => {
    it('should return status 400', async () => {
      const result = await makeUpdateRequest();
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('INVALID_USER_ID');
    });
  });

  describe('when updating a missing user', () => {
    it('should return status 404', async () => {
      const result = await makeUpdateRequest(getUUID());
      expect(result.status).to.equal(404);
      expect(result.body.token).to.equal('USER_NOT_FOUND');
    });
  });

  describe('when updating a user with empty body', () => {
    it('should return status 400', async () => {
      const result = await makeUpdateRequest(user.id, {});
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('MISSING_USER');
    });
  });

  describe('when updating a user with invalid body', () => {
    it('should return status 500', async () => {
      const result = await makeUpdateRequest(user.id, {
        garbage: '123',
      });

      expect(result.status).to.equal(500);
    });
  });

  describe('when updating a user with an invalid ring phone', () => {
    it('should return status 400', async () => {
      const result = await makeUpdateRequest(user.id, { ringPhones: ['123'] });
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('INVALID_PHONE_NUMBER');
    });
  });

  describe('when updating a user with an invalid outside dedicated email address', () => {
    it('should return status 400', async () => {
      const result = await makeUpdateRequest(user.id, {
        outsideDedicatedEmails: ['a@'],
      });
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('INVALID_EMAIL_ADDRESS');
    });
  });

  describe('when updating a user', () => {
    it('the user should be updated', async () => {
      const result = await makeUpdateRequest(user.id, { fullName: 'new-name' });
      const updated = await getUser(user.id);

      expect(result.status).to.equal(200);
      expect(updated.body.fullName).to.equal('new-name');
    });

    it('the user existing metadata should be preserved', async () => {
      const newUser = {
        fullName: 'new-name',
        metadata: {
          key1: 'value1',
        },
      };
      await makeUpdateRequest(user.id, newUser);
      newUser.metadata = { key2: 'value2' };
      const result = await makeUpdateRequest(user.id, newUser);
      const updated = await getUser(user.id);

      expect(result.status).to.equal(200);
      const metadata = updated.body.metadata;
      expect(metadata.key1).to.equal('value1');
      expect(metadata.key2).to.equal('value2');
    });
  });

  describe('/ipPhoneCredentials', () => {
    describe('when there is no user for the provided ID', () => {
      it('the POST request should respond with 404 USER_NOT_FOUND', async () => {
        const { status, body } = await request(app).post(`/users/${getUUID()}/ipPhoneCredentials`).set(getAuthHeader());

        expect(status).to.equal(404);
        expect(body.token).to.equal('USER_NOT_FOUND');
      });

      it('the DELETE request should respond with 404 USER_NOT_FOUND', async () => {
        const { status, body } = await request(app).delete(`/users/${getUUID()}/ipPhoneCredentials`).set(getAuthHeader());

        expect(status).to.equal(404);
        expect(body.token).to.equal('USER_NOT_FOUND');
      });
    });

    describe('when there is a user for the provided ID', () => {
      let tenantPhoneSupport = false;
      let ops;
      let userUnderTest;
      let queueTask;

      beforeEach(async () => {
        tenantPhoneSupport = tenant.metadata.enablePhoneSupport;
        await updateTenant(tenant.id, {
          metadata: {
            enablePhoneSupport: true,
          },
        });

        ops = {
          createEndpoint: sinon.spy(params => params),
          deleteEndpoint: sinon.spy(),
        };
        setProviderOps(ops);

        userUnderTest = await createAUser({
          name: 'chandragupta',
          sipEndpoints: [],
        });

        const { task } = await setupQueueToWaitFor([msg => msg.user && msg.user.id === userUnderTest.id]);
        queueTask = task;
      });

      afterEach(
        async () =>
          await updateTenant(tenant.id, {
            metadata: { enablePhoneSupport: tenantPhoneSupport },
          }),
      );

      it('the POST request should call the `createEndpoint` provider function', async () => {
        await request(app).post(`/users/${userUnderTest.id}/ipPhoneCredentials`).set(getAuthHeader());
        await queueTask;

        expect(ops.createEndpoint).to.have.been.calledOnce;
        expect(ops.createEndpoint).to.have.been.calledWith(sinon.match({ username: 'chandragupta' }));
      });

      it("the POST request should add SIP endpoint info the user's `sipEndpoints` list", async () => {
        await request(app).post(`/users/${userUnderTest.id}/ipPhoneCredentials`).set(getAuthHeader());
        await queueTask;

        const updatedUser = await loadUserById(tenant, userUnderTest.id);
        expect(updatedUser.sipEndpoints.find(e => e.username === 'chandragupta')).to.be.ok;
      });

      it('the DELETE request should call the `deleteEndpoint` provider function', async () => {
        await updateUser({ tenantId: tenant.id }, userUnderTest.id, {
          sipEndpoints: [{ endpointId: 'endpointId', username: userUnderTest.fullName }],
        });

        await request(app).delete(`/users/${userUnderTest.id}/ipPhoneCredentials`).set(getAuthHeader()).send({ sipUsername: userUnderTest.fullName });
        await queueTask;

        expect(ops.deleteEndpoint).to.have.been.calledOnce;
        expect(ops.deleteEndpoint).to.have.been.calledWith('endpointId');
      });

      it("the DELETE request should remove the SIP endpoint info from user's `sipEndpoints` list", async () => {
        await updateUser({ tenantId: tenant.id }, userUnderTest.id, {
          sipEndpoints: [{ username: userUnderTest.fullName }],
        });

        await request(app).delete(`/users/${userUnderTest.id}/ipPhoneCredentials`).set(getAuthHeader()).send({ sipUsername: userUnderTest.fullName });
        await queueTask;

        const updatedUser = await loadUserById(tenant, userUnderTest.id);
        expect(updatedUser.metadata.ipPhoneCredentials).to.not.be.ok;
      });
    });
  });
});
