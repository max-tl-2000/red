/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import uuid from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { partyKeys } from '../../../testUtils/expectedKeys';
import { createAUser, createATeam, createATeamMember, createAProperty, createATeamProperty } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe('API/parties', () => {
  describe('create a party', () => {
    function addPartyRequest() {
      return request(app).post('/parties').set(getAuthHeader()).send({});
    }

    it('has partial party entity in response', async () => {
      await addPartyRequest()
        .expect(200)
        .expect(res => expect(res.body).to.have.all.keys(partyKeys));
    });
  });

  describe('when creating a party and the owner team has the disableNewLeasePartyCreation set', () => {
    it('will responde with 400 and token INVALID_PARTY_WORKFLOW_FOR_TEAM if the party workflow = leasing', async () => {
      const user = await createAUser();
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        email: 'leasing_email',
        phone: '12025550190',
        metadata: { features: { disableNewLeasePartyCreation: true } },
      });
      await createATeamMember({ teamId: team.id, userId: user.id });

      const party = {
        id: uuid(),
        userId: user.id,
        ownerTeam: team.id,
        workflowName: DALTypes.WorkflowName.NEW_LEASE,
      };

      const { status, body } = await request(app).post('/parties').set(getAuthHeader(tenant.id, user.id)).send(party);

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_PARTY_WORKFLOW_FOR_TEAM');
    });
  });

  describe('when creating a party with qualification questions data', () => {
    it('has the qualification questions data in response', async () => {
      const qualificationQuestions = {
        moveInTime: 'Within the next for weeks',
        groupType: 'A couple of family',
        cashAvailable: 'Yes',
      };

      const res = await request(app).post('/parties').set(getAuthHeader()).send({ qualificationQuestions });

      expect(res.status).to.equal(200);
      expect(res.body.qualificationQuestions).to.deep.equal(qualificationQuestions);
    });
  });

  describe('when creating a party and the owner belongs to multiple teams', () => {
    it('the newly created party is assigned to all teams where the user is active', async () => {
      const user = await createAUser();
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        email: 'leasing_email',
        phone: '12025550190',
      });
      const team2 = await createATeam({
        name: 'testTeam2',
        module: 'leasing',
        email: 'leasing_email2',
        phone: '12025550191',
      });
      const team3 = await createATeam({
        name: 'testTeam3',
        module: 'leasing',
        email: 'leasing_email3',
        phone: '12025550192',
      });
      await createATeamMember({ teamId: team.id, userId: user.id });
      await createATeamMember({ teamId: team2.id, userId: user.id, roles: {}, inactive: true });
      await createATeamMember({ teamId: team3.id, userId: user.id });

      const party = {
        id: uuid(),
        userId: user.id,
        state: DALTypes.PartyStateType.CONTACT,
      };

      const response = await request(app).post('/parties').set(getAuthHeader(tenant.id, user.id)).send(party);

      expect(response.body.teams.sort()).to.deep.equal([team.id, team3.id].sort());
    });
  });

  describe('when creating a party and there are some properties associated with the user', () => {
    const getTestData = async () => {
      const { id: userId } = await createAUser();
      const { id: teamId } = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        email: 'leasing_email',
        phone: '12025550190',
      });
      const { id: propertyId } = await createAProperty();
      await createATeamMember({ teamId, userId });
      await createATeamProperty(teamId, propertyId);

      const party = {
        id: uuid(),
        userId,
        state: DALTypes.PartyStateType.CONTACT,
      };

      return {
        userId,
        teamId,
        propertyId,
        party,
      };
    };

    describe('when only one property is associated with the user', () => {
      it('should assign the property to the newly created party', async () => {
        const { userId, propertyId, party } = await getTestData();

        const response = await request(app).post('/parties').set(getAuthHeader(tenant.id, userId)).send(party);

        expect(response.body.assignedPropertyId).to.equal(propertyId);
      });
    });

    describe('when two properties are associated with the user', () => {
      it('should not assign any property to the newly created party', async () => {
        const { userId, teamId, party } = await getTestData();
        const { id: propertyId2 } = await createAProperty();
        await createATeamProperty(teamId, propertyId2);

        const response = await request(app).post('/parties').set(getAuthHeader(tenant.id, userId)).send(party);

        expect(response.body.assignedPropertyId).to.be.null;
      });
    });
  });

  describe("when creating a party and the owner's team has an associated team", () => {
    it('the newly created party is assigned to all teams where the user is active and to the associated team', async () => {
      const user = await createAUser();
      const hubTeam = await createATeam({
        name: 'hubTeam',
        module: 'leasing',
        email: 'hub_team',
        phone: '12025550190',
      });
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        email: 'test_team',
        phone: '12025550191',
        metadata: {
          associatedTeamNames: 'hubTeam',
        },
      });
      const team2 = await createATeam({
        name: 'testTeam2',
        module: 'leasing',
        email: 'test_team2',
        phone: '12025550192',
      });
      await createATeamMember({ teamId: team.id, userId: user.id });
      await createATeamMember({ teamId: team2.id, userId: user.id });

      const party = {
        id: uuid(),
        userId: user.id,
        state: DALTypes.PartyStateType.CONTACT,
      };

      const response = await request(app).post('/parties').set(getAuthHeader(tenant.id, user.id)).send(party);
      const teams = response.body.teams;
      expect(teams.length).to.equal(3);
      expect(teams.sort()).to.deep.equal([team.id, team2.id, hubTeam.id].sort());
    });
  });
});
