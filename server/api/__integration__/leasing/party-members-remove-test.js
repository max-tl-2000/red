/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import newId from 'uuid/v4';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import {
  createAParty,
  createAPartyMember,
  createAUser,
  createAnAppointment,
  createATeam,
  createATeamMember,
  createAnInventory,
  createAInventoryGroup,
  createAProperty,
  createAnAmenity,
  addAmenityToInventory,
  refreshUnitSearch,
  testCtx as ctx,
} from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';
import { tenantId } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/parties', () => {
  describe('given a request to remove a member from a party', () => {
    describe('when the party does not exist', () => {
      it('responds with status code 404 and PARTY_NOT_FOUND token', async () => {
        await request(app)
          .del(`/parties/${newId()}/members/${newId()}`)
          .set(getAuthHeader())
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the party id is a valid uuid and the party member id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_MEMBER_ID token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .del(`/parties/${party.id}/members/some-invalid-party-member-id`)
          .set(getAuthHeader(tenantId, user.id))
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INCORRECT_PARTY_MEMBER_ID'));
      });
    });

    describe('when the party id is a valid uuid and the party member id does not exist', () => {
      it('responds with status code 404 and PARTY_MEMBER_NOT_FOUND token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .del(`/parties/${party.id}/members/${newId()}`)
          .set(getAuthHeader(tenantId, user.id))
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PARTY_MEMBER_NOT_FOUND'));
      });
    });

    describe('when it is valid, but made by an unauthorized user', () => {
      it('responds with status code 403 and FORBIDDEN token', async () => {
        const party = await createAParty();
        const partyMember = await createAPartyMember(party.id);

        await request(app)
          .del(`/parties/${party.id}/members/${partyMember.id}`)
          .set(getAuthHeader())
          .expect(403)
          .expect(r => expect(r.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when the request is valid', () => {
      it('sets the party member as deleted', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const partyMember = await createAPartyMember(party.id);

        const { body } = await request(app).del(`/parties/${party.id}/members/${partyMember.id}`).set(getAuthHeader(tenantId, user.id)).expect(200);

        const resultMember = body.member;
        expect(resultMember).to.not.be.null;
        expect(resultMember.endDate).to.be.ok;
      });

      it('updates all active tasks that reference the party member', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const pm1 = await createAPartyMember(party.id);
        const pm2 = await createAPartyMember(party.id);

        const upcomingAppointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          partyMembers: [pm1.id, pm2.id],
          endDate: now().add(1, 'days'),
        });

        const pastAppointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          partyMembers: [pm1.id, pm2.id],
          endDate: now().subtract(1, 'days'),
        });

        await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          partyMembers: [pm1.id, pm2.id],
          state: DALTypes.TaskStates.COMPLETED,
        });

        const { body } = await request(app).del(`/parties/${party.id}/members/${pm1.id}`).set(getAuthHeader(tenantId, user.id)).expect(200);

        expect(body.tasks).to.not.be.null;

        expect(body.tasks.map(t => t.id).sort()).to.deep.equal([upcomingAppointment.id, pastAppointment.id].sort());
      });
    });

    describe('when the request is valid', () => {
      it('removes any appointments for the party member', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const partyMember = await createAPartyMember(party.id);
        await createAPartyMember(party.id);
        await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
        });

        await request(app).del(`/parties/${party.id}/members/${partyMember.id}`).send({ notes: 'notes' }).set(getAuthHeader(tenantId, user.id)).expect(200);

        const response = await request(app).get(`/parties/${party.id}/tasks`).set(getAuthHeader(tenantId, user.id)).expect(200);

        const resultAppointment = response.body[0];
        expect(resultAppointment).to.not.be.null;
        expect(resultAppointment.partyMembers).to.be.empty;
      });
    });

    describe('when the party member is removed', () => {
      const createInventory = async () => {
        const property = await createAProperty({});
        const inventoryGroup = await createAInventoryGroup({
          propertyId: property.id,
        });

        const inventory = await createAnInventory({
          propertyId: property.id,
          inventoryGroupId: inventoryGroup.id,
        });

        const inventoryAmenity = await createAnAmenity({
          id: newId.v4(),
          propertyId: property.id,
        });

        await addAmenityToInventory(ctx, inventory.id, inventoryAmenity.id);

        await refreshUnitSearch();

        return inventory;
      };

      it('cancels all upcoming active tasks exclusive for the party member', async () => {
        const team = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '15417544217',
        });
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });
        const party = await createAParty({ userId: user.id, teams: [team.id] });
        const partyMember = await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.RESIDENT,
        });
        await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.RESIDENT,
        });

        const inventory = await createInventory();

        await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          startDate: now().add(1, 'days'),
          endDate: now().add(1, 'days'),
          partyMembers: [partyMember.id],
          properties: [inventory.id],
        });

        await request(app)
          .del(`/parties/${party.id}/members/${partyMember.id}`)
          .send({ notes: 'notes' })
          .set(getAuthHeader(ctx.tenantId, user.id, [team]))
          .expect(200);

        // get all tasks
        const response = await request(app).get('/tasks').set(getAuthHeader(ctx.tenantId, user.id)).expect(200);

        expect(response.body.length).to.equal(1);
        expect(response.body[0].state).to.equal(DALTypes.TaskStates.CANCELED);
      });
    });

    describe('when the party member is removed', () => {
      it('closes the party if there is no occupant and no resident in party', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const partyMemberResident = await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.RESIDENT,
        });
        await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.GUARANTOR,
        });
        const partyMemberOccupant = await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.OCCUPANT,
        });

        const removeAndAssertPartyMemberRequest = partyMemberId =>
          request(app).del(`/parties/${party.id}/members/${partyMemberId}`).send({ notes: 'notes' }).set(getAuthHeader(tenantId, user.id)).expect(200);

        await removeAndAssertPartyMemberRequest(partyMemberResident.id);
        await removeAndAssertPartyMemberRequest(partyMemberOccupant.id);

        const response = await request(app).get(`/parties/${party.id}`).set(getAuthHeader(tenantId, user.id)).expect(200);

        const closedParty = response.body;
        expect(closedParty).to.not.be.null;
        expect(closedParty.endDate).to.be.ok;
      });
    });
  });
});
