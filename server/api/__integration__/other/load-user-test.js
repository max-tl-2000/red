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
import { createAUser, createATeam, createATeamMember, testCtx as ctx } from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { formatEmployeeAssetUrl } from '../../../helpers/assets-helper';

describe('API/users', () => {
  let user;

  beforeEach(async () => {
    user = await createAUser();
  });

  describe('when loading user with a userId that is not uuid', () => {
    it('should respond with status code 400 and INVALID_USER_ID token', done => {
      request(app)
        .get('/users/some-invalid-uuid')
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_USER_ID'))
        .end(done);
    });
  });

  describe('when loading user with unknown uuid', () => {
    const someUnknownUuid = '0c7459e0-ae71-47c9-93c1-babf14005d75';

    it('should respond with status code 404 and USER_NOT_FOUND token', done => {
      request(app)
        .get(`/users/${someUnknownUuid}`)
        .set(getAuthHeader())
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'))
        .end(done);
    });
  });

  describe('when loading user with known uuid', () => {
    it('should respond with status code 200 and user object in body', async () => {
      const avatarUrl = await formatEmployeeAssetUrl({ ...ctx, tenantName: tenant.name }, user.id);
      const expectedUser = {
        id: user.id,
        fullName: user.fullName,
        preferredName: user.preferredName,
        email: user.email,
        metadata: {
          isAdmin: false,
          status: DALTypes.UserStatus.AVAILABLE,
          businessTitle: 'Leasing Consultant',
          loginTimeoutId: null,
          notAvailableSetAt: null,
          statusUpdatedAt: null,
          wrapUpCallTimeoutId: null,
        },
        sipEndpoints: [
          {
            password: user.fullName,
            username: user.fullName,
            endpointId: user.fullName,
            isUsedInApp: true,
          },
        ],
        ringPhones: user.ringPhones,
        teamIds: [],
        teams: [],
        avatarUrl,
        associatedProperties: [],
        externalCalendars: {
          calendars: [],
        },
      };

      const response = await request(app).get(`/users/${user.id}`).set(getAuthHeader()).expect(200);

      // TODO token values change every time, find a way to test, I will delete it for now
      delete response.body.zendeskPrivateContentToken;
      delete response.body.zendeskCookieValue;
      delete response.body.sisenseCookieValue;

      expect(response.body).to.deep.equal(expectedUser);
    });
  });

  describe('when loading user that belongs to a team', () => {
    it('the loaded user contains a list of teams and the team object has expected keys', async () => {
      const team = await createATeam('team-name', 'leasing', 'team@test.com', '12025550190');
      await createATeamMember({ teamId: team.id, userId: user.id });

      const teamKeys = [
        'created_at',
        'description',
        'displayName',
        'functionalRoles',
        'id',
        'laaAccessLevels',
        'mainRoles',
        'metadata',
        'module',
        'name',
        'updated_at',
        'timeZone',
        'officeHours',
        'callCenterPhoneNumber',
        'associatedProperties',
        'externalCalendars',
        'voiceMessageId',
        'endDate',
      ];

      const response = await request(app).get(`/users/${user.id}`).set(getAuthHeader()).expect(200);

      expect(response.body.teams[0]).to.have.all.keys(teamKeys);
    });
  });

  describe('when loading users by ids', () => {
    it("should responds with status 400 and token INVALID_USER_IDS when 'ids' is missing", async () => {
      const { status, body } = await request(app).post('/users').set(getAuthHeader());

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_USER_IDS');
    });

    it("should responds with status 400 and token INVALID_USER_IDS when 'ids' is not an array", async () => {
      const { status, body } = await request(app).post('/users').set(getAuthHeader()).send({ ids: 'not-an-array' });

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_USER_IDS');
    });

    it('should responds with status 400 and token INVALID_USER_ID when one of the ids is not valid', async () => {
      const { status, body } = await request(app)
        .post('/users')
        .set(getAuthHeader())
        .send({ ids: ['11dce843-3cbd-49a7-8109-69ed990e23c9', 'not-a-uuid'] });

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_USER_ID');
    });

    it('should load all users with matching ids', async () => {
      const { id: userId1 } = await createAUser();
      const { id: userId2 } = await createAUser();
      await createAUser(); // another user - expected not to be loaded

      const { status, body } = await request(app)
        .post('/users')
        .set(getAuthHeader())
        .send({
          ids: ['11dce843-3cbd-49a7-8109-69ed990e23c9', userId1, userId2],
        });

      expect(status).to.equal(200);
      expect(body.length).to.equal(2);
      expect(body.map(u => u.id).sort()).to.deep.equal([userId1, userId2].sort());
    });
  });
});
