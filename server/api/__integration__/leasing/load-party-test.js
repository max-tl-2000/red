/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';

import app from '../../api';
import { createParty } from '../../../dal/partyRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAUser } from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';

describe('API/parties', () => {
  let knownParty;
  let user;

  beforeEach(async () => {
    user = await createAUser();
    const data = {
      id: newId(),
      userId: user.id,
      qualificationQuestions: {
        moveInTime: 'Within the next for weeks',
        groupType: 'A couple of family',
        cashAvailable: 'Yes',
      },
    };
    knownParty = await createParty(ctx, data);
  });

  describe('when loading party with a partyId that is not uuid', () => {
    it('should respond with status code 400 and INCORRECT_PARTY_ID token', done => {
      request(app)
        .get('/parties/some-invalid-uuid')
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'))
        .end(done);
    });
  });

  describe('when loading party with unknown uuid', () => {
    const someUnknownUuid = 'f615f99e-dee4-4d92-b1cb-f2e673825a90';

    it('should respond with status code 404 and PARTY_NOT_FOUND token', done => {
      request(app)
        .get(`/parties/${someUnknownUuid}`)
        .set(getAuthHeader())
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'))
        .end(done);
    });
  });

  describe('when loading party with known uuid', () => {
    it('should respond with status code 200 and party object in body', done => {
      request(app)
        .get(`/parties/${knownParty.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(res => expect(res.body.id).to.equal(knownParty.id))
        .expect(res => expect(res.body.stateId).to.equal(knownParty.stateId))
        .expect(res => expect(res.body.qualificationQuestions).to.deep.equal(knownParty.qualificationQuestions))
        .expect(res => expect(res.body.collaborators).to.deep.equal([user.id]))
        .end(done);
    });
  });
});
