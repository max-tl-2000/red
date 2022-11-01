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
import { tenant } from '../../../testUtils/test-tenant';
import { getAuthHeader, getExpiredAuthHeader } from '../../../testUtils/apiHelper';

import '../../../testUtils/setupTestGlobalContext';

describe('tenantHandler', () => {
  // pick a closed path so we can test middleware which depends on insertion of authUser
  const CLOSED_TEST_PATH = '/parties';
  const OPEN_TEST_PATH = '/swagger.json';
  const REVOKED_TEST_PATH = '/revoked-endpoint'; // Endpoint not allowed with the common user token

  describe('check for valid tenant', () => {
    it('Should return 400 and INVALID_TENANT if tenant not found for open paths', async () => {
      await request(app)
        .get(OPEN_TEST_PATH)
        .set('Host', 'badtenant')
        .expect(400)
        // QUESTION: is there a better way to do this?
        .expect(res => expect(res.body.token).to.equal('INVALID_TENANT'));
    });

    it('Should return 400 and INVALID_TENANT if tenant not found for closed paths with token with bad tenant ID', async () => {
      await request(app)
        .get(CLOSED_TEST_PATH)
        // QUESTION: if I use this the following, I get an unhandled rejection and test times out.  Why?
        // .set(getAuthHeader('badtenantid'))
        .set(getAuthHeader(getUUID()))
        .expect(400)
        .expect(res => {
          expect(res.body.token).to.equal('INVALID_TENANT');
        });
    });

    it('Should return 200 if tenant is found', async () => {
      await request(app).get(CLOSED_TEST_PATH).set(getAuthHeader()).set('Host', tenant.name).expect(200);
    });
  });

  describe('check for tenant refresh', () => {
    it('Should return 401 and TENANT_REFRESHED if tenant was refreshed after login', async () => {
      await request(app)
        .get(CLOSED_TEST_PATH)
        .set('Host', tenant.name)
        .set(getExpiredAuthHeader())
        .expect(401)
        .expect(res => expect(res.body.token).to.equal('TENANT_REFRESHED'));
    });

    it('Should return 200 otherwise', async () => {
      await request(app).get(CLOSED_TEST_PATH).set('Host', tenant.name).set(getAuthHeader()).expect(200);
    });
  });

  describe('check for tenant mismatch', () => {
    it('Should return 401 and TENANT_NAME_MISMATCH if tenant names do not match between request url and auth token ', async () => {
      await request(app)
        .get(CLOSED_TEST_PATH)
        .set('Host', 'different_tenant_name')
        .set(getAuthHeader())
        .expect(401)
        .expect(res => expect(res.body.token).to.equal('TENANT_NAME_MISMATCH'));
    });
  });

  describe('check request with common user token', () => {
    it('Should return 401 and UNAUTHORIZED if the path is not present in the userPaths', async () => {
      await request(app)
        .post(REVOKED_TEST_PATH)
        .set(getAuthHeader(null, getUUID(), null, true))
        .expect(401)
        .expect(res => expect(res.body.token).to.equal('UNAUTHORIZED'));
    });
  });
});
