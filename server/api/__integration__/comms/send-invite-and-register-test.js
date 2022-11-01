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
import { getInvite } from '../../../dal/usersInvitesRepo';
import { getUserByEmail } from '../../../dal/usersRepo';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe.skip('API/sendInvite', () => {
  let invUser;
  let regUser;
  let resInvite;

  beforeEach(async () => {
    invUser = {
      mail: 'you@reva.tech',
      organization: tenant.id,
      inviteData: { directEmailIdentifier: 'sales' },
    };

    regUser = {
      fullName: 'Foo',
      preferredName: 'Bar',
      password: '123',
    };

    resInvite = await request(app).post('/sendInvite').set(getAuthHeader('admin')).send(invUser);
  });

  describe('new valid user', () => {
    describe('/sendInvite', () => {
      it('has status code 200', async () => {
        expect(resInvite.status).to.equal(200);
        const dbInvite = await getInvite({ tenantId: invUser.organization }, { email: invUser.mail });
        expect(dbInvite.email).to.equal(invUser.mail);
      });
    });

    describe('/registerWithInvite', () => {
      it('has status 200', async () => {
        const dbUser = await getInvite({ tenantId: invUser.organization }, { email: invUser.mail });
        regUser.token = dbUser.token;
        const resRegister = await request(app).post('/registerWithInvite').set(getAuthHeader('admin')).send(regUser);
        const getUserDBbyEmail = await getUserByEmail({ tenantId: invUser.organization }, invUser.mail);
        expect(resRegister.status).to.equal(200);
        expect(getUserDBbyEmail.fullName).to.equal(regUser.fullName);
      });
    });
  });

  describe('existing user', () => {
    it('has error code 400', async () => {
      const res = await request(app).post('/sendInvite').set(getAuthHeader('admin')).send(invUser);
      expect(res.status).to.equal(400);
    });
  });
});
