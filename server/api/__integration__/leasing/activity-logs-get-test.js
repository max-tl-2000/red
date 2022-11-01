/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenantId } from '../../../testUtils/test-tenant';
import { createAUser, createAParty, createAnActivityLog, testCtx as ctx } from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('API/activityLogs', () => {
  let revaAdmin;
  beforeEach(async () => {
    revaAdmin = await createAUser({ email: 'admin@reva.tech' });
  });
  describe('GET', () => {
    describe('when loading activity logs for a party', () => {
      describe('if partyId is valid', () => {
        it('only the activity logs that belong to that party are loaded', async () => {
          const user = await createAUser();
          const party1 = await createAParty({ userId: user.id });
          const party2 = await createAParty({ userId: user.id });
          await createAnActivityLog(user.id, party1.id);
          await createAnActivityLog(user.id, party2.id);

          await request(app)
            .get(`/activityLogs?partyId=${party1.id}`)
            .set(getAuthHeader())
            .expect(200)
            .expect(r => expect(r.body[0].context.parties[0]).to.equal(party1.id));
        });
        describe('and the logged user is Reva Admin', () => {
          it('it should load all the logs that belong to that party', async () => {
            const user = await createAUser();
            const party = await createAParty({ userId: user.id });
            await createAnActivityLog(user.id, party.id);
            await createAnActivityLog(revaAdmin.id, party.id);
            const revaAdminToken = getAuthHeader(tenantId, revaAdmin.id, undefined, false, { email: revaAdmin.email });

            const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(revaAdminToken).expect(200);

            expect(res.body.length).to.equal(2);
          });
        });
        describe('and the logged user is not Reva Admin', () => {
          it('it should load all the logs that belong to that party except the ones triggered by an action made by Reva Admin', async () => {
            const user = await createAUser();
            const party = await createAParty({ userId: user.id });
            await createAnActivityLog(user.id, party.id);
            await createAnActivityLog(revaAdmin.id, party.id);
            const userToken = getAuthHeader(tenantId, revaAdmin.id, undefined, false, { email: user.email });

            const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(userToken).expect(200);

            expect(res.body.length).to.equal(1);
            expect(res.body[0].context.users[0]).to.equal(user.id);
          });
        });
      });

      describe('when the partyId is not a uuid', () => {
        it('responds with status code 400 and INVALID_PARTY_ID token', async () => {
          await request(app)
            .get('/activityLogs?partyId=some-invalid-id')
            .set(getAuthHeader())
            .expect(400)
            .expect(res => expect(res.body.token).to.equal('INVALID_PARTY_ID'));
        });
      });

      describe('when the partyId does not exist', () => {
        it('no activity logs are loaded', async () => {
          await request(app)
            .get(`/activityLogs?partyId=${newId()}`)
            .set(getAuthHeader())
            .expect(200)
            .expect(r => expect(r.body.length).to.equal(0));
        });
      });
    });

    describe('if no userId/partyId query param is set', () => {
      it('all activity logs are loaded', async () => {
        const user1 = await createAUser({ ctx, name: 'user1', email: 'user1@email.com', status: DALTypes.UserStatus.AVAILABLE });
        const user2 = await createAUser({ ctx, name: 'user2', email: 'user2@email.com', status: DALTypes.UserStatus.AVAILABLE });
        await createAnActivityLog(user1.id);
        await createAnActivityLog(user2.id);

        await request(app)
          .get('/activityLogs')
          .set(getAuthHeader())
          .expect(200)
          .expect(r => expect(r.body.length).to.equal(2));
      });
    });

    describe('when loading an activity log by id', () => {
      describe('if the log id is valid', () => {
        it('responds with the activity log', async () => {
          const user = await createAUser();
          const activityLog = await createAnActivityLog(user.id);

          await request(app)
            .get(`/activityLogs/${activityLog.id}`)
            .set(getAuthHeader())
            .expect(200)
            .expect(res => {
              expect(res.body).not.to.be.an('array');
              expect(res.body.id).to.equal(activityLog.id);
            });
        });

        it('responds with status code 404 if the id does not exist', async () => {
          await request(app).get(`/activityLogs/${newId()}`).set(getAuthHeader()).expect(404);
        });
      });

      describe('if the log id is invalid', () => {
        it('responds with status code 400 and INVALID_ACTIVITY_LOG_ID token', async () => {
          await request(app)
            .get('/activityLogs/some-invalid-id')
            .set(getAuthHeader())
            .expect(400)
            .expect(res => expect(res.body.token).to.equal('INVALID_ACTIVITY_LOG_ID'));
        });
      });
    });
  });
});
