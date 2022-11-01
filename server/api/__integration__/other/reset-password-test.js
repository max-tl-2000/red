/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';

import getUUID from 'uuid/v4';
import app from '../../api';
import { getResetTokenForUser } from '../../../services/tokens';
import { registerResetTokenForUser } from '../../../dal/tokensRepo.js';
import { testCtx as ctx, createAUser, createATeam, createATeamMember } from '../../../testUtils/repoHelper';
import { getUserByEmail, getUserStatusByUserId } from '../../../dal/usersRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import '../../../testUtils/setupTestGlobalContext';
import { now } from '../../../../common/helpers/moment-utils';

describe('API/resetPassword tests', () => {
  describe('when resetting password for a user', () => {
    it('the user has the new password', async () => {
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
      });
      const user = await createAUser({ ctx });
      await createATeamMember({ teamId: team.id, userId: user.id, inactive: false });

      const token = await getResetTokenForUser(ctx, user);
      const newPassword = 'some_new_password';

      const res = await request(app).post('/resetPassword').send({
        email: user.email,
        password: newPassword,
        token,
      });
      expect(res.status).to.deep.equal(200);

      const loginRes = await request(app).post('/login').send({
        email: user.email,
        password: newPassword,
      });

      expect(loginRes.status).to.deep.equal(200);
    });

    it('should encrypt password before saving to db', async () => {
      const user = await createAUser();
      const token = await getResetTokenForUser(ctx, user);
      const newPassword = 'some_new_password';

      await request(app).post('/resetPassword').send({
        email: user.email,
        password: newPassword,
        token,
      });

      const updatedUser = await getUserByEmail(ctx, user.email);
      expect(updatedUser.password).to.not.equal(newPassword);
    });

    it('the rest token is expired', async () => {
      const generatedToken = {
        token: getUUID(),
        expiry_date: now().add(-2, 'days'),
      };
      const user = await createAUser();
      await registerResetTokenForUser(ctx, user, generatedToken);

      await request(app)
        .post('/validateResetToken')
        .send({
          token: generatedToken.token,
        })
        .expect(498)
        .expect(res => expect(res.body.token).to.equal('EXPIRED_TOKEN'));
    });

    it('the rest token does not exist', async () => {
      await request(app)
        .post('/validateResetToken')
        .send({
          token: getUUID(),
        })
        .expect(498)
        .expect(res => expect(res.body.token).to.equal('INVALID_TOKEN'));
    });
  });

  describe('after resetting password for a user', () => {
    it('the reset token is not valid anymore', async () => {
      const user = await createAUser({ ctx });
      const token = await getResetTokenForUser(ctx, user);
      const newPassword = 'some_new_password';

      await request(app).post('/resetPassword').send({
        email: user.email,
        password: newPassword,
        token,
      });

      await request(app)
        .post('/validateResetToken')
        .send({
          token,
        })
        .expect(498)
        .expect(res => expect(res.body.token).to.equal('INVALID_TOKEN'));
    });
  });

  describe('when register a password for an imported user', () => {
    it('the user is set as available', async () => {
      const user = await createAUser({
        ctx,
        name: 'Foo',
        directEmailIdentifier: 'directemailidentifier',
        email: 'a@a.a',
        status: DALTypes.UserStatus.NOT_AVAILABLE,
      });
      const token = await getResetTokenForUser(ctx, user);
      await request(app)
        .post('/resetPassword')
        .send({
          email: user.email,
          password: 'new-password',
          token,
          isRegisterMode: true,
        })
        .expect(200);

      const updatedUser = await getUserByEmail(ctx, user.email);
      const userStatus = await getUserStatusByUserId(ctx, updatedUser.id);

      expect(userStatus.status).to.equal(DALTypes.UserStatus.AVAILABLE);
    });
  });
});
