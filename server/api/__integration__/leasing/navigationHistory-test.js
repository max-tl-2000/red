/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { createAParty, createAUser, createANavigationHistoryEntry } from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenantId } from '../../../testUtils/test-tenant';
import getUUID from 'uuid/v4';
import { now } from '../../../../common/helpers/moment-utils';

describe('API/navigationHistory', () => {
  describe('given a request to save a navigationHistory entry', () => {
    describe("when the user doesn't exist", () => {
      it('responds with status code 401', async () => {
        await request(app).post('/navigationHistory').send({}).expect(401);
      });
    });

    describe('when the user does exist', () => {
      it('responds with status code 200 and saved entity', async () => {
        const expectedKeys = ['id', 'userId', 'entity_type', 'entity_id', 'created_at', 'updated_at', 'visited_at'];
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const resp = await request(app).post('/navigationHistory').set(getAuthHeader(tenantId, user.id)).send({
          entityType: DALTypes.NavigationHistoryType.PARTY,
          entityId: party.id,
        });

        expect(resp.status).equals(200);
        expect(resp.body).to.have.all.keys(expectedKeys);
      });
    });

    describe('when the entity has an invalid id', () => {
      it('responds with status code 400 and INVALID_ENTITY_ID token', async () => {
        const user = await createAUser();
        await request(app)
          .post('/navigationHistory')
          .set(getAuthHeader(tenantId, user.id))
          .send({
            entityType: DALTypes.NavigationHistoryType.PARTY,
            entityId: 'some-invalid-id',
          })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_ENTITY_ID'));
      });
    });

    describe('when the entity does not exist', () => {
      it('responds with status code 412 and ENTITY_DOES_NOT_EXIST token', async () => {
        const user = await createAUser();
        await request(app)
          .post('/navigationHistory')
          .set(getAuthHeader(tenantId, user.id))
          .send({
            entityType: DALTypes.NavigationHistoryType.PARTY,
            entityId: getUUID(),
          })
          .expect(412)
          .expect(res => expect(res.body.token).to.equal('ENTITY_DOES_NOT_EXIST'));
      });
    });
  });

  describe('when loading the navigation history for a user', () => {
    describe("when the user doesn't exist", () => {
      it('responds with status code 401', async () => {
        await request(app).get('/navigationHistory').send({}).expect(401);
      });
    });
    describe('when the user does exist', () => {
      it('load only the navigation history entries for that user', async () => {
        const user1 = await createAUser();
        const user2 = await createAUser();
        const party1 = await createAParty({ userId: user1.id });
        const party2 = await createAParty({ userId: user2.id });

        await createANavigationHistoryEntry({
          userId: user1.id,
          entity_id: party1.id,
          entity_type: DALTypes.NavigationHistoryType.PARTY,
          visited_at: now().toISOString(),
        });
        await createANavigationHistoryEntry({
          userId: user2.id,
          entity_id: party2.id,
          entity_type: DALTypes.NavigationHistoryType.PARTY,
          visited_at: now().toISOString(),
        });

        const resp = await request(app).get('/navigationHistory').set(getAuthHeader(tenantId, user1.id));
        expect(resp.body[0].entity.id).to.equal(party1.id);
        expect(resp.body.length === 1);
      });
    });
  });
});
