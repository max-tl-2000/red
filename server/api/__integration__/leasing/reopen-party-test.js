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
import { createAUser, createAParty, createATeam, createATeamMember, createAProperty, createAUserAndTeam } from '../../../testUtils/repoHelper';
import { getPartyBy } from '../../../dal/partyRepo';

import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenantId, tenant } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

describe('API/party', () => {
  describe('given a request to reopen a party', () => {
    describe('when the party does not exist', () => {
      it('returns 404 and PARTY_NOT_FOUND token', async () => {
        const user = await createAUser();

        await request(app)
          .post(`/parties/${newId()}/reopen`)
          .set(getAuthHeader(tenantId, user.id))
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the partyId is not a valid UUID', () => {
      it('returns 400 and INCORRECT_PARTY_ID', async () => {
        const user = await createAUser();

        await request(app)
          .post('/parties/some-uuid/reopen')
          .set(getAuthHeader(tenantId, user.id))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    describe('when the user does not have access to the party', () => {
      it('returns 403 and FORBIDDEN token', async () => {
        const party = await createAParty({ endDate: new Date() });

        await request(app)
          .post(`/parties/${party.id}/reopen`)
          .set(getAuthHeader())
          .expect(403)
          .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when the user is owner', () => {
      it('should mark the party as open', async () => {
        const user = await createAUser();
        const party = await createAParty({
          userId: user.id,
          endDate: new Date(),
        });

        const response = await request(app).post(`/parties/${party.id}/reopen`).set(getAuthHeader(tenantId, user.id)).expect(200);

        const responseBody = response.body;
        expect(responseBody.endDate).to.be.null;
      });
    });

    const testTeam = {
      name: 'team1',
      module: 'leasing',
      email: 'test1@test.a',
      phone: '12025550190',
    };
    const testTeam2 = {
      name: 'team2',
      module: 'leasing',
      email: 'test2@test.a',
      phone: '12025550111',
    };

    describe('when the user is not the owner and is not a member of the party teams', () => {
      it('returns 403 FORBIDDEN', async () => {
        const team = await createATeam(testTeam);
        const team2 = await createATeam(testTeam2);
        const user = await createAUser();
        await createATeamMember({ teamId: team2.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createAParty({
          userId: owner.id,
          teams: [team.id],
          endDate: new Date(),
        });

        await request(app)
          .post(`/parties/${party.id}/reopen`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team2.id, mainRoles: ['LA'] }]))
          .expect(403)
          .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when the user is not the owner but is a member of one of the party teams', () => {
      it('should be able to mark the party as closed', async () => {
        const team = await createATeam(testTeam);
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createAParty({
          userId: owner.id,
          teams: [team.id],
          endDate: new Date(),
        });

        const response = await request(app)
          .post(`/parties/${party.id}/reopen`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
          .expect(200);

        const responseBody = response.body;
        expect(responseBody.endDate).to.be.null;
      });
    });
  });

  describe('given a request to reopen a new lease party', () => {
    describe('when the user is owner and the the party is assigned to an inactive leasing team', () => {
      it('should mark the party as open and assign it to an active leasing team', async () => {
        const ctx = tenant;
        const user = await createAUser();
        const property = await createAProperty();
        const teamData = {
          name: 'A Team',
          displayName: 'A Team',
          description: 'A group of veterans...',
          module: 'leasing',
          directEmailIdentifier: 'a@team.com',
          directPhoneIdentifier: '12025550196',
          timeZone: 'America/Los_Angeles',
          inactiveFlag: false,
          outsideDedicatedEmails: '',
          properties: property.name,
        };
        const roles = {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
        };
        const { team: activeTeam, user: activeTeamUser } = await createAUserAndTeam({ teamParams: teamData, roles });
        const { team: inactiveTeam } = await createAUserAndTeam({
          teamParams: { ...teamData, inactiveFlag: true, name: 'B Team', displayName: 'B team' },
        });
        const party = await createAParty({
          userId: user.id,
          endDate: new Date(),
          ownerTeam: inactiveTeam.id,
          teams: [inactiveTeam.id],
          assignedPropertyId: property.id,
        });

        expect(party.ownerTeam).to.equal(inactiveTeam.id);

        await request(app).post(`/parties/${party.id}/reopen`).set(getAuthHeader(tenantId, user.id)).expect(200);

        const reopenedParty = await getPartyBy(ctx, { id: party.id });

        expect(reopenedParty.ownerTeam).to.equal(activeTeam.id);
        expect(reopenedParty.userId).to.equal(activeTeamUser.id);
      });
    });

    describe('given a request to reopen a new lease party', () => {
      describe('when the owner is inactive and the the party is assigned to an inactive leasing team', () => {
        it('should mark the party as open and assign it to an active owner', async () => {
          const ctx = tenant;
          const property = await createAProperty();
          const teamData = {
            name: 'A Team',
            displayName: 'A Team',
            description: 'A group of veterans...',
            module: 'leasing',
            directEmailIdentifier: 'a@team.com',
            directPhoneIdentifier: '12025550196',
            timeZone: 'America/Los_Angeles',
            inactiveFlag: false,
            outsideDedicatedEmails: '',
            properties: property.name,
          };
          const roles = {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
          };
          const { team: activeTeam, user: inactiveTeamUser } = await createAUserAndTeam({ teamParams: teamData, roles, isTeamMemberInactive: true });
          const { user: activeTeamUser } = await createAUserAndTeam({ teamParams: teamData, roles });
          const party = await createAParty({
            userId: inactiveTeamUser.id,
            endDate: new Date(),
            ownerTeam: activeTeam.id,
            teams: [activeTeam.id],
            assignedPropertyId: property.id,
          });

          expect(party.userId).to.equal(inactiveTeamUser.id);
          expect(party.ownerTeam).to.equal(activeTeam.id);

          await request(app).post(`/parties/${party.id}/reopen`).set(getAuthHeader(tenantId, inactiveTeamUser.id)).expect(200);

          const reopenedParty = await getPartyBy(ctx, { id: party.id });

          expect(reopenedParty.ownerTeam).to.equal(activeTeam.id);
          expect(reopenedParty.userId).to.equal(activeTeamUser.id);
        });
      });
    });

    describe('when the user is owner and the the party is assigned to an active leasing team', () => {
      it('should mark the new lease party as open and assign it to the same team', async () => {
        const ctx = tenant;
        const property = await createAProperty();
        const teamData = {
          name: 'A Team',
          displayName: 'A Team',
          description: 'A group of veterans...',
          module: 'leasing',
          directEmailIdentifier: 'a@team.com',
          directPhoneIdentifier: '12025550196',
          timeZone: 'America/Los_Angeles',
          inactiveFlag: false,
          outsideDedicatedEmails: '',
          properties: property.name,
        };
        const roles = {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
        };
        const { team: activeTeam, user: activeTeamUser } = await createAUserAndTeam({ teamParams: teamData, roles });
        const party = await createAParty({
          userId: activeTeamUser.id,
          endDate: new Date(),
          ownerTeam: activeTeam.id,
          teams: [activeTeam.id],
          assignedPropertyId: property.id,
        });

        expect(party.ownerTeam).to.equal(activeTeam.id);

        await request(app).post(`/parties/${party.id}/reopen`).set(getAuthHeader(tenantId, activeTeamUser.id)).expect(200);

        const reopenedParty = await getPartyBy(ctx, { id: party.id });

        expect(reopenedParty.ownerTeam).to.equal(activeTeam.id);
        expect(reopenedParty.userId).to.equal(activeTeamUser.id);
      });
    });
  });

  describe('given a request to reopen a renewal party', () => {
    describe('when the user is owner and the the party is assigned to an inactive resident services team', () => {
      it('should mark the renewal party as open and assign it to an active resident team', async () => {
        const ctx = tenant;
        const property = await createAProperty();
        const teamData = {
          name: 'A Team',
          displayName: 'A Team',
          description: 'A group of veterans...',
          module: 'residentServices',
          directEmailIdentifier: 'a@team.com',
          directPhoneIdentifier: '12025550196',
          timeZone: 'America/Los_Angeles',
          inactiveFlag: false,
          outsideDedicatedEmails: '',
          properties: property.name,
        };
        const roles = {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
        };
        const { team: activeTeam, user: activeTeamUser } = await createAUserAndTeam({ teamParams: teamData, roles });
        const { team: inactiveTeam, user: inactiveTeamUser } = await createAUserAndTeam({
          teamParams: { ...teamData, inactiveFlag: true, name: 'B Team', displayName: 'B team' },
        });
        const party = await createAParty({
          userId: inactiveTeamUser.id,
          endDate: new Date(),
          workflowName: DALTypes.WorkflowName.RENEWAL,
          ownerTeam: inactiveTeam.id,
          teams: [inactiveTeam.id],
          assignedPropertyId: property.id,
        });

        expect(party.ownerTeam).to.equal(inactiveTeam.id);

        await request(app).post(`/parties/${party.id}/reopen`).set(getAuthHeader(tenantId, inactiveTeamUser.id)).expect(200);

        const reopenedParty = await getPartyBy(ctx, { id: party.id });

        expect(reopenedParty.ownerTeam).to.equal(activeTeam.id);
        expect(reopenedParty.userId).to.equal(activeTeamUser.id);
      });
    });
  });
});
