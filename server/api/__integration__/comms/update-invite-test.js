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
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import config from '../../../config';
const { apiToken } = config;
import { getAllValidInvites } from '../../../dal/usersInvitesRepo';

describe.skip('API/test/updateInvite', () => {
  let inviteData;

  beforeEach(async () => {
    const invUser = {
      mail: 'you@reva.tech',
      organization: tenant.id,
      inviteData: { directEmailIdentifier: 'sales' },
    };

    await request(app).post('/sendInvite').set(getAuthHeader('admin')).send(invUser);

    const [lastInvite] = await getAllValidInvites({ tenantId: tenant.id });

    inviteData = {
      token: lastInvite.token,
      organization: tenant.id,
      updateData: { valid: false },
    };
  });

  describe('given a request to update a user invite', () => {
    describe('when the apiToken query param is missing', () => {
      it('responds with status code 403 and API_TOKEN_REQUIRED token', async () => {
        const res = await request(app).patch('/test/updateInvite').set(getAuthHeader('admin')).send(inviteData);

        expect(res.status).to.equal(403);
        expect(res.body.token).to.equal('API_TOKEN_REQUIRED');
      });
    });

    describe('when the apiToken query param is not valid', () => {
      it('responds with status code 403 and API_TOKEN_INVALID token', async () => {
        const invalidApiToken = 'some-token';

        const res = await request(app).patch(`/test/updateInvite?apiToken=${invalidApiToken}`).set(getAuthHeader('admin')).send(inviteData);

        expect(res.status).to.equal(403);
        expect(res.body.token).to.equal('API_TOKEN_INVALID');
      });
    });

    describe('when the invite token does not exist', () => {
      const inviteDataWithInvalidToken = {
        token: 'invalid-token',
        organization: tenant.id,
        updateData: { valid: false },
      };

      it('responds with status code 404 and INVITE_NOT_FOUND token', async () => {
        const res = await request(app).patch(`/test/updateInvite?apiToken=${apiToken}`).set(getAuthHeader('admin')).send(inviteDataWithInvalidToken);

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('INVITE_NOT_FOUND');
      });
    });

    describe('when the update succeeds', () => {
      it('has all the invite keys in response', async () => {
        const inviteKeys = ['created_at', 'updated_at', 'id', 'email', 'sent_date', 'expiry_date', 'token', 'valid', 'inviteData'];

        const res = await request(app).patch(`/test/updateInvite?apiToken=${apiToken}`).set(getAuthHeader('admin')).send(inviteData);

        expect(res.status).to.equal(200);
        expect(res.body).to.have.all.keys(inviteKeys);
      });
    });

    describe('when marking it as not valid', () => {
      it('the invite is not valid anymore', async () => {
        const res = await request(app).patch(`/test/updateInvite?apiToken=${apiToken}`).set(getAuthHeader('admin')).send(inviteData);

        expect(res.status).to.equal(200);
        expect(res.body.valid).to.equal(false);
      });
    });
  });
});
