/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import omit from 'lodash/omit';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import app from '../../api';
import { hash } from '../../../helpers/crypto';
import { testCtx as ctx, createAUser, createATeam, createATeamMember } from '../../../testUtils/repoHelper';
import config from '../../../config';
import { getUserByEmail, updateUser } from '../../../../auth/server/services/user-management';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { sanitizeUser } from '../../../services/users';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { formatEmployeeAssetUrl } from '../../../helpers/assets-helper';

describe('API/login', () => {
  const rawPassword = '123';
  const lastLoginAttempt = new Date();
  const rawKnownUser = {
    externalUniqueId: getUUID(),
    name: 'Foo',
    preferredName: 'Bar',
    email: 'foo@some.com',
    loginAttempts: 1,
    lastLoginAttempt,
    ringPhones: ['12025550182'],
    metadata: {
      status: DALTypes.UserStatus.NOT_AVAILABLE,
    },
  };
  let team;
  let createdUser;

  const seedAsync = async () => {
    const hashedPassword = await hash(rawPassword);
    rawKnownUser.password = hashedPassword;

    team = await createATeam({ name: 'testTeam', module: 'leasing' });
    createdUser = await createAUser({ ctx, ...rawKnownUser });
    await createATeamMember({ teamId: team.id, userId: createdUser.id, inactive: false });
  };

  beforeEach(async () => await seedAsync());

  describe('with valid credentials', () => {
    const makeLoginRequest = () => request(app).post('/login').send({ email: rawKnownUser.email, password: rawPassword });

    describe('when user has loginAttempts < MAX', () => {
      it('has status code 200', async () => {
        await makeLoginRequest().expect(200);
      });

      it('has partial user entity in response', async () => {
        const sanitizedUser = await sanitizeUser(ctx, createdUser);
        const avatarUrl = await formatEmployeeAssetUrl({ ...ctx, tenantName: tenant.name }, createdUser.id);

        const expectedResponseBody = {
          email: rawKnownUser.email,
          fullName: rawKnownUser.name,
          preferredName: rawKnownUser.preferredName,
          id: createdUser.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
          avatarUrl,
          domain: 'localhost',
          protocol: 'http',
          isTrainingTenant: false,
          phoneSupportEnabled: false,
          laaAccessLevels: [
            {
              laaAccessLevels: [],
              teamId: team.id,
            },
          ],
          leasingProviderMode: 'FAKE',
          metadata: {
            isAdmin: false,
            status: DALTypes.UserStatus.NOT_AVAILABLE,
            businessTitle: 'Leasing Consultant',
            loginTimeoutId: null,
            notAvailableSetAt: null,
            wrapUpCallTimeoutId: null,
          },
          sipEndpoints: createdUser.sipEndpoints,
          teamIds: [team.id],
          teams: sanitizedUser.teams,
          hasRCToken: false,
          ringPhones: rawKnownUser.ringPhones,
          associatedProperties: [],
          externalCalendars: {
            calendars: [],
          },
          communicationDefaultEmailSignature: '',
        };

        const res = await makeLoginRequest();

        // TODO token values change every time, find a way to test, I will delete it for now
        delete res.body.user.zendeskPrivateContentToken;
        delete res.body.user.zendeskCookieValue;
        delete res.body.user.sisenseCookieValue;

        // deleting created_at and updated_at since they might differ
        delete res.body.user.teams[0].created_at;
        delete res.body.user.teams[0].updated_at;
        delete expectedResponseBody.teams[0].created_at;
        delete expectedResponseBody.teams[0].updated_at;
        // deleting statusUpdateAt since they might differ
        delete res.body.user.metadata.statusUpdatedAt;

        expect(res.body).to.have.all.keys(['user', 'token', 'globalData', 'tokenExpirationTime']);

        expect(omit(res.body.user, 'features')).to.deep.equal(expectedResponseBody);
      });

      it('resets loginAttempts to 0', async () => {
        await makeLoginRequest();
        const user = await getUserByEmail(ctx, rawKnownUser.email);
        expect(user.loginAttempts).to.equal(0);
      });

      it('should update lastLoginAttempt', async () => {
        await makeLoginRequest();
        const user = await getUserByEmail(ctx, rawKnownUser.email);
        expect(toMoment(lastLoginAttempt).isBefore(user.lastLoginAttempt)).to.equal(true);
      });

      it('should make available user', async () => {
        const result = await makeLoginRequest();
        expect(result.body.user.metadata.status).to.equal(DALTypes.UserStatus.NOT_AVAILABLE);
      });

      describe('when user has not logged in before (has no status value)', () => {
        it('should make the user available', async () => {
          const user = await createAUser({
            ctx,
            externalUniqueId: getUUID(),
            name: 'Paul',
            preferredName: 'Atreides',
            email: 'muaddib@fremen.du',
            loginAttempts: 1,
            lastLoginAttempt,
            password: await hash('123'),
          });

          await createATeamMember({ teamId: team.id, userId: user.id, inactive: false });

          const { status, body } = await request(app).post('/login').send({ email: rawKnownUser.email, password: rawPassword });

          expect(status).to.equal(200);
          expect(body.user.metadata.status).to.equal(DALTypes.UserStatus.NOT_AVAILABLE);
        });
      });
    });

    describe('when user has loginAttempts = MAX', () => {
      beforeEach(async () => {
        await updateUser(ctx, {
          id: createdUser.id,
          loginAttempts: config.auth.maxLoginAttempts,
          lastLoginAttempt: now().toDate(),
        });
      });

      it('has status code 401', async () => {
        await makeLoginRequest().expect(401);
      });

      it('returns ACCOUNT_BLOCKED error code', async () => {
        await makeLoginRequest()
          .expect(res => expect(res.body.token).to.equal('ACCOUNT_BLOCKED'))
          .expect(res => expect(res.body.data.blockedAccount).to.equal(true));
      });
    });
  });

  describe('with known email and invalid password', () => {
    const makeLoginRequest = () =>
      request(app).post('/login').send({
        email: rawKnownUser.email,
        password: 'some-invalid-password',
      });

    it('has status code 401', async () => {
      await makeLoginRequest().expect(401);
    });

    it('has EMAIL_AND_PASSWORD_MISMATCH as error token', async () => {
      await makeLoginRequest().expect(res => expect(res.body.token).to.equal('EMAIL_AND_PASSWORD_MISMATCH'));
    });

    it('increments loginAttempts by one', async () => {
      await makeLoginRequest();
      const user = await getUserByEmail(ctx, rawKnownUser.email);
      expect(user.loginAttempts).to.equal(2);
    });
  });

  describe('with unknown email and invalid password', () => {
    const makeLoginRequest = () => request(app).post('/login').send({ email: 'some@random.tech', password: 'some-invalid-password' });

    it('has status code 401', async () => {
      await makeLoginRequest().expect(401);
    });

    it('has EMAIL_AND_PASSWORD_MISMATCH as error token', async () => {
      await makeLoginRequest().expect(res => expect(res.body.token).to.equal('EMAIL_AND_PASSWORD_MISMATCH'));
    });
  });

  describe('with invalid email', () => {
    const makeLoginRequest = () => request(app).post('/login').send({ email: 'invalid-email', password: 'some-invalid-password' });

    it('has status code 401', async () => {
      await makeLoginRequest().expect(401);
    });

    it('has INVALID_EMAIL as error token', async () => {
      await makeLoginRequest().expect(res => expect(res.body.token).to.equal('INVALID_EMAIL'));
    });
  });

  describe('with the credentials of an inactive user', () => {
    it('should return status code 401 and INACTIVE_ACCOUNT token', async () => {
      const inactiveUser = await createAUser({
        ctx,
        email: 'foo2@some.com',
        password: rawPassword,
        fullName: 'Foo2',
        preferredName: 'Bar',
        loginAttempts: 1,
      });

      await createATeamMember({ teamId: team.id, userId: inactiveUser.id, inactive: true });

      await request(app)
        .post('/login')
        .send({
          email: 'foo2@some.com',
          password: rawPassword,
        })
        .expect(401)
        .expect(res => expect(res.body.token).to.equal('INACTIVE_ACCOUNT'));
    });
  });

  describe('with the credentials of a user and the last attempt is older than a config duration', () => {
    const makeLoginRequest = password =>
      request(app).post('/login').send({
        email: rawKnownUser.email,
        password,
      });

    beforeEach(async () => {
      await updateUser(ctx, {
        id: createdUser.id,
        loginAttempts: config.auth.maxLoginAttempts,
        lastLoginAttempt: now()
          .add(-(config.auth.resetAttemptsTimeout + 1), 'minutes')
          .toDate(),
      });
    });

    describe('when user has loginAttempts >= MAX and valid credentials', () => {
      it('responds with status code 200 and reset the login attepmts to 0', async () => {
        await makeLoginRequest(rawPassword)
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(['user', 'token', 'globalData', 'tokenExpirationTime']));

        const user = await getUserByEmail(ctx, rawKnownUser.email);
        expect(user.loginAttempts).to.equal(0);
      });
    });

    describe('when user has loginAttempts >= MAX and invalid credentials', () => {
      it('responds with status code 401 and reset the login attempts to 1', async () => {
        await makeLoginRequest('some-invalid-password')
          .expect(401)
          .expect(res => expect(res.body.token).to.equal('EMAIL_AND_PASSWORD_MISMATCH'));

        const user = await getUserByEmail(ctx, rawKnownUser.email);
        expect(user.loginAttempts).to.equal(1);
      });
    });
  });
});
