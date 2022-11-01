/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';

import app from '../../api';
import '../../../testUtils/setupTestGlobalContext';
import { createAParty, createAUser, createAProperty, createATeam, createATeamMember, createATeamPropertyProgram } from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('API/parties', () => {
  describe('given a request to load primary agent for certain party', () => {
    describe('when no token is provided', () => {
      it('responds with status code 401', async () => {
        await request(app).get('/parties/no-token/agent').expect(401);
      });
    });

    describe('when token is provided but party-id is bad format', () => {
      it('responds with status code 400', async () => {
        await request(app).get('/parties/bad-party-format/agent').set(getAuthHeader(tenant.id)).expect(400);
      });
    });

    describe('when token is provided but party-id is a UUID that is not a party', () => {
      it('responds with status code 404', async () => {
        await request(app).get('/parties/552392ae-3c1f-4021-b06a-94adc8b37f31/agent').set(getAuthHeader(tenant.id)).expect(404);
      });
    });

    describe('when the partyId is a valid parameter', () => {
      it('it loads primary agent information of that party', async () => {
        const user = await createAUser();
        const { id: teamId } = await createATeam();
        await createATeamMember({ teamId, userId: user.id });
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });
        const party = await createAParty({ userId: user.id, ownerTeam: teamId, assignedPropertyId: propertyId });
        await request(app)
          .get(`/parties/${party.id}/agent`)
          .set(getAuthHeader(tenant.id, user.id))
          .expect(200)
          .expect(res => {
            expect(res.body.id).to.equal(user.id);
            expect(res.body.email).to.equal(user.email);
            expect(res.body.fullName).to.equal(user.fullName);
          });
      });
    });
  });
});
