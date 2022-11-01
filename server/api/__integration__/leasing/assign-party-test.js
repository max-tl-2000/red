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
import {
  testCtx as ctx,
  createAParty,
  createAUser,
  createATeam,
  createATeamMember,
  createAnAppointment,
  createAProperty,
  createATeamProperty,
  createAvailability,
  createTeamEvent,
  toggleExtCalendarFeature,
} from '../../../testUtils/repoHelper';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { createParty, loadParty } from '../../../dal/partyRepo';
import { getTasksByIds } from '../../../dal/tasksRepo';
import { getAllUserEvents } from '../../../dal/calendarEventsRepo';
import { getEventsByParty } from '../../../dal/partyEventsRepo';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenantId } from '../../../testUtils/test-tenant';
import { createLeaseTestData, createLease } from '../../../testUtils/leaseTestHelper';
import * as leaseRepo from '../../../dal/leaseRepo';
import { now, DATE_ISO_FORMAT, toMoment } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../../common/date-constants';

const testTeam = {
  name: 'team1',
  module: 'leasing',
  email: 'test1@test.a',
  phone: '15417544217',
};

const testTeam2 = {
  name: 'team2',
  module: 'leasing',
  email: 'test2@test.a',
  phone: '15417544111',
};

describe('API/party', () => {
  describe('given a request to assign a party', () => {
    describe('when the assignee is missing from the request body', () => {
      it('responds with 400 and ASSIGNEE_REQUIRED token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });

        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({})
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('ASSIGNEE_REQUIRED'));
      });
    });

    describe('when the assignee user is missing from the request body', () => {
      it('responds with 400 and ASSIGNEE_REQUIRED token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: {} })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('ASSIGNEE_REQUIRED'));
      });
    });

    describe('when the party does not exist', () => {
      describe('calling the party assign endpoint', () => {
        it('returns 404 PARTY_NOT_FOUND', async () => {
          const user = await createAUser();

          await request(app)
            .post(`/parties/${newId()}/assign`)
            .set(getAuthHeader(tenantId, user.id))
            .send({ to: { userId: user.id } })
            .expect(404)
            .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
        });
      });
    });

    describe('when calling the party assign endpoint with an invalid UUID for partyId', () => {
      it('returns 400 INCORRECT_PARTY_ID', async () => {
        const user = await createAUser();

        await request(app)
          .post('/parties/INVALID_UUID/assign')
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: { userId: user.id } })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    describe('when calling the party assign endpoint with an invalid UUID for userId', () => {
      it('returns 400 INVALID_USER_ID', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: { userId: 'INVALID_UUID' } })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_USER_ID'));
      });
    });

    describe('when calling the party assign endpoint with an invalid UUID for teamId', () => {
      it('returns 400 INVALID_TEAM_ID', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: { teamId: 'INVALID_UUID' } })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_TEAM_ID'));
      });
    });

    describe('when calling the party assign endpoint with an userId of a missing user', () => {
      it('returns 404 USER_NOT_FOUND', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: { userId: newId() } })
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'));
      });
    });

    describe('when calling the party assign endpoint with an userId of a missing team', () => {
      it('returns 404 TEAM_NOT_FOUND', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ to: { teamId: newId() } })
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('TEAM_NOT_FOUND'));
      });
    });

    describe('when the requestor is the party owner', () => {
      describe('assigning the party to a user', () => {
        it('responds with status code 200 ', async () => {
          const { id: teamId } = await createATeam(testTeam);
          const { id: userId } = await createAUser();
          await createATeamMember({ teamId, userId });
          const { id: partyId } = await createAParty({ userId });

          await request(app).post(`/parties/${partyId}/assign`).set(getAuthHeader(tenantId, userId)).send({ to: { userId, teamId } }).expect(200);
        });

        it('reassigns the party', async () => {
          const { id: teamId } = await createATeam(testTeam);
          const { id: ownerId } = await createAUser();
          const { id: assigneeId } = await createAUser();
          await createATeamMember({ teamId, userId: assigneeId });
          const { id: partyId } = await createAParty({ userId: ownerId });

          const response = await request(app)
            .post(`/parties/${partyId}/assign`)
            .set(getAuthHeader(tenantId, ownerId))
            .send({ to: { userId: assigneeId, teamId } });

          const resultParty = response.body;
          expect(resultParty).to.not.be.null;
          expect(resultParty.id).to.equal(partyId);
          expect(resultParty.userId).to.equal(assigneeId);
          expect(resultParty.collaborators).to.include(ownerId);
        });
      });
      describe('assigning a party with an appointment to a dispatcher from other team and property', () => {
        it('reassigns the party to the dispatcher and changes the party assigned property', async () => {
          const { id: team1Id } = await createATeam(testTeam);
          const { id: ownerId } = await createAUser();
          await createATeamMember({ teamId: team1Id, userId: ownerId });
          const { id: property1Id } = await createAProperty();
          await createATeamProperty(team1Id, property1Id);
          const { id: partyId } = await createAParty({ userId: ownerId, assignedPropertyId: property1Id });

          const tomorrow = now().startOf('day').add(1, 'days');
          await createAnAppointment({
            partyId,
            salesPersonId: ownerId,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const { id: dispatcherId } = await createAUser();
          const { id: team2Id } = await createATeam(testTeam2);
          const { id: property2Id } = await createAProperty();
          await createATeamProperty(team2Id, property2Id);
          await createATeamMember({
            teamId: team2Id,
            userId: dispatcherId,
            roles: {
              mainRoles: [MainRoleDefinition.LM.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });
          await createATeamMember({ teamId: team2Id, userId: ownerId });

          const response = await request(app)
            .post(`/parties/${partyId}/assign`)
            .set(getAuthHeader(tenantId, ownerId))
            .send({ to: { userId: dispatcherId, teamId: team2Id } });

          const resultParty = response.body;
          expect(resultParty).to.not.be.null;
          expect(resultParty.id).to.equal(partyId);
          expect(resultParty.userId).to.equal(dispatcherId);
          expect(resultParty.assignedPropertyId).to.equal(property2Id);
        });
      });

      describe('assigning the party to a team', () => {
        it('reassigns the party to a team member using party routing', async () => {
          const team = await createATeam(testTeam);
          const users = [await createAUser({ name: 'Bush' }), await createAUser({ name: 'Chuck' })];
          await createATeamMember({ teamId: team.id, userId: users[0].id });
          await createATeamMember({ teamId: team.id, userId: users[1].id });
          const owner = await createAUser();
          await createATeamMember({ teamId: team.id, userId: owner.id });
          const party = await createAParty({ userId: owner.id });

          const response = await request(app)
            .post(`/parties/${party.id}/assign`)
            .set(getAuthHeader(tenantId, owner.id))
            .send({ to: { teamId: team.id } })
            .expect(200);

          const resultParty = response.body;
          expect(resultParty).to.not.be.null;

          expect(resultParty.userId).to.equal(users[0].id); // round-robin will give the first user in the team in this case
          expect(resultParty.teams).to.include(team.id);
          expect(resultParty.collaborators).to.include(owner.id);
          expect(resultParty.ownerTeam).to.equal(team.id);
        });
      });
    });

    describe('when the requestor is not the owner but is a member of one of the party teams', () => {
      describe('assigning the party to a user', () => {
        it('reassigns the party', async () => {
          const team = await createATeam(testTeam);
          const user = await createAUser();
          await createATeamMember({ teamId: team.id, userId: user.id });

          const owner = await createAUser();
          await createATeamMember({ teamId: team.id, userId: owner.id });
          const assignee = await createAUser();
          assignee.teams = [team.id];
          await createATeamMember({ teamId: team.id, userId: assignee.id });
          const party = await createParty(ctx, {
            id: newId(),
            userId: owner.id,
            teams: [team.id],
          });

          const response = await request(app)
            .post(`/parties/${party.id}/assign`)
            .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
            .send({ to: { userId: assignee.id, teamId: team.id } });

          expect(response.statusCode).to.equal(200);
          const resultParty = response.body;
          expect(resultParty).to.not.be.null;
          expect(resultParty.id).to.equal(party.id);
          expect(resultParty.userId).to.equal(assignee.id);
          expect(resultParty.collaborators).to.include(owner.id);
        });
      });

      describe('assigning the party to a team', () => {
        it('reassigns the party to a team member using party routing', async () => {
          const team = await createATeam(testTeam);
          const users = [await createAUser({ name: 'Bush' }), await createAUser({ name: 'Chuck' })];
          await createATeamMember({ teamId: team.id, userId: users[0].id });
          await createATeamMember({ teamId: team.id, userId: users[1].id });
          const user = await createAUser();
          await createATeamMember({ teamId: team.id, userId: user.id });
          const owner = await createAUser();
          await createATeamMember({ teamId: team.id, userId: owner.id });
          const party = await createParty(ctx, {
            id: newId(),
            userId: owner.id,
            teams: [team.id],
          });

          const response = await request(app)
            .post(`/parties/${party.id}/assign`)
            .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
            .send({ to: { teamId: team.id } })
            .expect(200);

          const resultParty = response.body;
          expect(resultParty).to.not.be.null;

          expect(resultParty.userId).to.equal(users[0].id); // round-robin will give the first user in the team in this case
          expect(resultParty.teams).to.include(team.id);
          expect(resultParty.collaborators).to.include(owner.id);
          expect(resultParty.ownerTeam).to.equal(team.id);
        });
      });
    });

    describe("when the requestor is not the owner and is not teammate with the owner, nor member of any of the party's teams", () => {
      describe('assigning the party to a user', () => {
        it('returns 403 FORBIDDEN', async () => {
          const ownersTeam = await createATeam(testTeam);
          const assigneesTeam = await createATeam(testTeam2);
          const requestorsTeam = await createATeam(testTeam2);
          const requestor = await createAUser();
          await createATeamMember({ teamId: requestorsTeam.id, userId: requestor.id });

          const owner = await createAUser();
          await createATeamMember({ teamId: ownersTeam.id, userId: owner.id });
          const assignee = await createAUser();
          assignee.teams = [assigneesTeam.id];
          await createATeamMember({ teamId: assigneesTeam.id, userId: assignee.id });
          const party = await createParty(ctx, {
            id: newId(),
            userId: owner.id,
            teams: [assigneesTeam.id],
          });

          await request(app)
            .post(`/parties/${party.id}/assign`)
            .set(getAuthHeader(tenantId, requestor.id, [{ id: requestorsTeam.id, mainRoles: ['LA'] }]))
            .send({ to: { userId: assignee.id, teamId: assigneesTeam.id } })
            .expect(403);
        });
      });
    });

    describe('when the requestor is a teammate of the owner', () => {
      describe('assigning the party to a user', () => {
        it('returns 200 OK', async () => {
          const team = await createATeam(testTeam);
          const team2 = await createATeam(testTeam2);
          const user = await createAUser();
          await createATeamMember({ teamId: team.id, userId: user.id });

          const owner = await createAUser();
          await createATeamMember({ teamId: team.id, userId: owner.id });
          const assignee = await createAUser();
          assignee.teams = [team.id];
          await createATeamMember({ teamId: team.id, userId: assignee.id });
          const party = await createParty(ctx, {
            id: newId(),
            userId: owner.id,
            teams: [team2.id],
          });

          await request(app)
            .post(`/parties/${party.id}/assign`)
            .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
            .send({ to: { userId: assignee.id, teamId: team.id } })
            .expect(200);
        });
      });
    });

    describe('when there is a draft lease and no CounterSigner signatures', () => {
      it('will assign the party to the new owner', async () => {
        const { id: teamId } = await createATeam(testTeam);
        const { id: assigneeId } = await createAUser();
        await createATeamMember({ teamId, userId: assigneeId });
        const { partyId, userId, promotedQuote, team } = await createLeaseTestData();
        const lease = await createLease(partyId, userId, promotedQuote.id, team);

        const signatures = await leaseRepo.getLeaseSignatureStatuses(ctx, lease.id);
        expect(signatures.length).to.be.equal(0);
        await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenantId, userId))
          .send({ to: { userId: assigneeId, teamId } })
          .expect(200);

        const party = await loadParty(ctx, partyId);
        expect(party.userId).to.equal(assigneeId);
      });
    });

    describe('when there is an appointment conflict', () => {
      describe('when assigning to a user with checkConflictingAppointments set to true and user already has appointments', () => {
        it('should not re-assign the party and the response should have status code 400 and contain the list of conflicting appointments', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          const { id: user1Id } = await createAUser();
          const user1Party = await createAParty({ userId: user1Id });

          const party1Appointment = await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1Id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const { id: teamId } = await createATeam(testTeam);
          const { id: user2Id } = await createAUser();
          await createATeamMember({ teamId, userId: user2Id });
          const user2Party = await createAParty({ userId: user2Id });

          await createAnAppointment({
            partyId: user2Party.id,
            salesPersonId: user2Id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(8, 'hours').add(30, 'minutes'),
          });

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1Id))
            .send({
              to: { userId: user2Id, teamId },
              checkConflictingAppointments: true,
            })
            .expect(412)
            .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
            .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([party1Appointment.id]));

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user1Id);
        });
      });

      describe('when assigning to a user with checkConflictingAppointments set to true and appointments conflict with the toTeam events', () => {
        it('should not re-assign the party and the response should have status code 400 and contain the list of conflicting appointments', async () => {
          const { id: user1Id } = await createAUser();
          const user1Party = await createAParty({ userId: user1Id });

          const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
          const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);

          const appointmentStartDate = `${tomorrow}T13:00:00Z`;
          const appointmentEndDate = `${tomorrow}T14:00:00Z`;

          const party1Appointment = await createAnAppointment({
            startDate: new Date(appointmentStartDate),
            endDate: new Date(appointmentEndDate),
            salesPersonId: user1Id,
            partyId: user1Party.id,
          });

          const { id: teamId } = await createATeam(testTeam);
          const { id: user2Id } = await createAUser();
          await createATeamMember({ teamId, userId: user2Id });

          await createTeamEvent({
            teamId,
            startDate: appointmentStartDate,
            endDate: toMoment(appointmentStartDate).add(30, 'minutes').toISOString(),
          });

          const allDayEventStart = now({ timezone: LA_TIMEZONE }).format(DATE_ISO_FORMAT);

          await createTeamEvent({
            teamId,
            startDate: allDayEventStart,
            endDate: dayAfterTomorrow,
          });

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1Id))
            .send({
              to: { userId: user2Id, teamId },
              checkConflictingAppointments: true,
            })
            .expect(412)
            .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
            .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([party1Appointment.id]));

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user1Id);
        });
      });

      describe('when assigning to a user with checkConflictingAppointments set to true and user is unavailable on some days', () => {
        it('should not re-assign the party and the response should have status code 400 and contain the list of conflicting appointments', async () => {
          const { id: user1Id } = await createAUser();
          const user1Party = await createAParty({ userId: user1Id });

          const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
          const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);

          const appointmentStartDate = `${tomorrow}T13:00:00Z`;
          const appointmentEndDate = `${tomorrow}T14:00:00Z`;

          const party1Appointment = await createAnAppointment({
            startDate: new Date(appointmentStartDate),
            endDate: new Date(appointmentEndDate),
            salesPersonId: user1Id,
            partyId: user1Party.id,
          });

          const { id: teamId } = await createATeam(testTeam);
          const { id: teamId2 } = await createATeam(testTeam2);
          const { id: user2Id } = await createAUser();
          const teamMember21 = await createATeamMember({ teamId, userId: user2Id });
          const teamMember22 = await createATeamMember({ teamId: teamId2, userId: user2Id });

          await createAvailability(teamMember22.id, tomorrow, user1Id);
          await createAvailability(teamMember21.id, dayAfterTomorrow, user1Id);

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1Id))
            .send({
              to: { userId: user2Id, teamId },
              checkConflictingAppointments: true,
            })
            .expect(412)
            .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
            .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([party1Appointment.id]));

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user1Id);
        });
      });

      describe('when assigning to a user with checkConflictingAppointments set to false', () => {
        it('the response should have status code 200 and the party should be re-assigned', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          const { id: user1Id } = await createAUser();
          const user1Party = await createAParty({ userId: user1Id });

          await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1Id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const { id: teamId } = await createATeam(testTeam);
          const { id: user2Id } = await createAUser();
          await createATeamMember({ teamId, userId: user2Id });
          const user2Party = await createAParty({ userId: user2Id });

          await createAnAppointment({
            partyId: user2Party.id,
            salesPersonId: user2Id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(8, 'hours').add(30, 'minutes'),
          });

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1Id))
            .send({
              to: { userId: user2Id, teamId },
              checkConflictingAppointments: false,
            })
            .expect(200);

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user2Id);
        });
      });

      describe('when assigning to a team and there is no user available (the existing user is NOT_AVAILABLE)', () => {
        it('should not re-assign the party and the response should have status code 400', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          const user1 = await createAUser();
          const user1Party = await createAParty({ userId: user1.id });

          await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1.id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const user2 = await createAUser({
            status: DALTypes.UserStatus.NOT_AVAILABLE,
          });

          const team = {
            name: 'team1',
            module: 'leasing',
            email: 'test1@test.a',
            phone: '15417544217',
            metadata: {
              lastAssignedUser: user1.id,
            },
          };

          const savedTeam = await createATeam(team);
          await createATeamMember({ teamId: savedTeam.id, userId: user1.id });
          await createATeamMember({ teamId: savedTeam.id, userId: user2.id });

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1.id))
            .send({
              to: { teamId: savedTeam.id },
            })
            .expect(412)
            .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'));

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user1.id);
        });
      });

      describe('when assigning to a team and there is no user available (the existing user has other appointment for the same time slot)', () => {
        it('should not re-assign the party and the response should have status code 400', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          const user1 = await createAUser();
          const user1Party = await createAParty({ userId: user1.id });

          await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1.id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const user2 = await createAUser({
            status: DALTypes.UserStatus.NOT_AVAILABLE,
          });
          const user2Party = await createAParty({ userId: user2.id });

          await createAnAppointment({
            partyId: user2Party.id,
            salesPersonId: user2.id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(8, 'hours').add(30, 'minutes'),
          });

          const team = {
            name: 'team1',
            module: 'leasing',
            email: 'test1@test.a',
            phone: '15417544217',
            metadata: {
              lastAssignedUser: user1.id,
            },
          };

          const savedTeam = await createATeam(team);
          await createATeamMember({ teamId: savedTeam.id, userId: user1.id });
          await createATeamMember({ teamId: savedTeam.id, userId: user2.id });

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1.id))
            .send({
              to: { teamId: savedTeam.id },
            })
            .expect(412)
            .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'));

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user1.id);
        });
      });

      describe('when assigning to a team and there is a user available with no appointments for the same time slot', () => {
        it('the response should have status code 200 and the party should be re-assigned', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          const user1 = await createAUser();
          const user1Party = await createAParty({ userId: user1.id });

          await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1.id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const user2 = await createAUser();
          const user2Party = await createAParty({ userId: user2.id });

          await createAnAppointment({
            partyId: user2Party.id,
            salesPersonId: user2.id,
            startDate: tomorrow.clone().add(1, 'days').add(8, 'hours'),
            endDate: tomorrow.clone().add(1, 'days').add(8, 'hours').add(30, 'minutes'),
          });

          const team = {
            name: 'team1',
            module: 'leasing',
            email: 'test1@test.a',
            phone: '15417544217',
            metadata: {
              lastAssignedUser: user1.id,
            },
          };

          const savedTeam = await createATeam(team);
          await createATeamMember({ teamId: savedTeam.id, userId: user1.id });
          await createATeamMember({ teamId: savedTeam.id, userId: user2.id });

          const eventsForFirstUser = await getAllUserEvents(ctx, user1.id);
          expect(eventsForFirstUser.length).to.equal(1);
          const eventsForSecondUser = await getAllUserEvents(ctx, user2.id);
          expect(eventsForSecondUser.length).to.equal(1);

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1.id))
            .send({
              to: { userId: user2.id, teamId: savedTeam.id },
              checkConflictingAppointments: false,
            })
            .expect(200);

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user2.id);

          const eventsForFirstUserAfterReassign = await getAllUserEvents(ctx, user1.id);
          expect(eventsForFirstUserAfterReassign.length).to.equal(0);
          const eventsForSecondUserAfterReassign = await getAllUserEvents(ctx, user2.id);
          expect(eventsForSecondUserAfterReassign.length).to.equal(2);
        });
      });

      describe('when assigning to a new user without calendar but old party owner had calendar integration enabled', () => {
        it('the response should have status code 200 and the party should be re-assigned', async () => {
          const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
          await toggleExtCalendarFeature(true);

          const tomorrow = now().startOf('day').add(1, 'days');

          const user1 = await createAUser(userParams);
          const user1Party = await createAParty({ userId: user1.id });

          await createAnAppointment({
            partyId: user1Party.id,
            salesPersonId: user1.id,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(9, 'hours'),
          });

          const user2 = await createAUser();
          const user2Party = await createAParty({ userId: user2.id });

          await createAnAppointment({
            partyId: user2Party.id,
            salesPersonId: user2.id,
            startDate: tomorrow.clone().add(1, 'days').add(8, 'hours'),
            endDate: tomorrow.clone().add(1, 'days').add(8, 'hours').add(30, 'minutes'),
          });

          const team = {
            name: 'team1',
            module: 'leasing',
            email: 'test1@test.a',
            phone: '15417544217',
            metadata: {
              lastAssignedUser: user1.id,
            },
          };

          const savedTeam = await createATeam(team);
          await createATeamMember({ teamId: savedTeam.id, userId: user1.id });
          await createATeamMember({ teamId: savedTeam.id, userId: user2.id });

          const eventsForFirstUser = await getAllUserEvents(ctx, user1.id);
          expect(eventsForFirstUser.length).to.equal(1);
          const eventsForSecondUser = await getAllUserEvents(ctx, user2.id);
          expect(eventsForSecondUser.length).to.equal(1);

          await request(app)
            .post(`/parties/${user1Party.id}/assign`)
            .set(getAuthHeader(tenantId, user1.id))
            .send({
              to: { userId: user2.id, teamId: savedTeam.id },
              checkConflictingAppointments: false,
            })
            .expect(200);

          const party = await loadParty(ctx, user1Party.id);
          expect(party.userId).to.equal(user2.id);

          const eventsForFirstUserAfterReassign = await getAllUserEvents(ctx, user1.id);
          expect(eventsForFirstUserAfterReassign.length).to.equal(0);
          const eventsForSecondUserAfterReassign = await getAllUserEvents(ctx, user2.id);
          expect(eventsForSecondUserAfterReassign.length).to.equal(2);
        });
      });
    });

    describe('assigning the party to a user in a differen team', () => {
      it('changes the ownerTeam to the new users team', async () => {
        const team1 = await createATeam(testTeam);
        const team2 = await createATeam(testTeam);
        const users = [await createAUser(), await createAUser()];

        await createATeamMember({ teamId: team1.id, userId: users[0].id });
        await createATeamMember({ teamId: team2.id, userId: users[1].id });

        const party = await createAParty({
          userId: users[0].id,
          ownerTeam: team1.id,
        });

        const response = await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, users[0].id))
          .send({ to: { userId: users[1].id, teamId: team2.id } })
          .expect(200);

        const resultParty = response.body;
        expect(resultParty).to.not.be.null;

        expect(resultParty.userId).to.equal(users[1].id);
        expect(resultParty.teams).to.include(team2.id);
        expect(resultParty.ownerTeam).to.equal(team2.id);
      });
    });

    describe('assigning the party to a different team', () => {
      it('changes the ownerTeam to the new team', async () => {
        const team1 = await createATeam(testTeam);
        const team2 = await createATeam(testTeam);
        const users = [await createAUser(), await createAUser()];

        await createATeamMember({ teamId: team1.id, userId: users[0].id });
        await createATeamMember({ teamId: team2.id, userId: users[1].id });

        const party = await createAParty({
          userId: users[0].id,
          ownerTeam: team1.id,
        });

        const response = await request(app)
          .post(`/parties/${party.id}/assign`)
          .set(getAuthHeader(tenantId, users[0].id))
          .send({ to: { teamId: team2.id } })
          .expect(200);

        const resultParty = response.body;
        expect(resultParty).to.not.be.null;

        expect(resultParty.userId).to.equal(users[1].id);
        expect(resultParty.teams).to.include(team2.id);
        expect(resultParty.ownerTeam).to.equal(team2.id);
      });
    });

    describe('when the party is assigned to a different agent', () => {
      it('should reassign all active tasks to the new party owner', async () => {
        const { id: currentPartyOwnerId } = await createAUser();

        const { id: teamId } = await createATeam(testTeam);
        const { id: newPartyOwnerId } = await createAUser();
        await createATeamMember({ teamId, userId: newPartyOwnerId });

        const { id: partyId } = await createAParty({
          userId: currentPartyOwnerId,
        });

        const tomorrow = now().startOf('day').add(1, 'days');

        const { id: activeAppointmentId } = await createAnAppointment({
          partyId,
          salesPersonId: currentPartyOwnerId,
          startDate: tomorrow.clone().add(8, 'hours'),
          endDate: tomorrow.clone().add(9, 'hours'),
        });

        const { id: completedAppointmentId } = await createAnAppointment({
          partyId,
          salesPersonId: currentPartyOwnerId,
          startDate: tomorrow.clone().add(8, 'hours'),
          endDate: tomorrow.clone().add(9, 'hours'),
          state: DALTypes.TaskStates.COMPLETED,
        });
        const { status } = await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenant.id, currentPartyOwnerId))
          .send({ to: { userId: newPartyOwnerId, teamId } });
        expect(status).to.equal(200);

        const partyTasks = await getTasksByIds({ tenantId: tenant.id }, [activeAppointmentId, completedAppointmentId]);

        const activeAppointment = partyTasks.find(t => t.id === activeAppointmentId);
        expect(activeAppointment.userIds).to.deep.equal([newPartyOwnerId]);

        const completedAppointment = partyTasks.find(t => t.id === completedAppointmentId);
        expect(completedAppointment.userIds).to.deep.equal([currentPartyOwnerId]);
      });
    });

    describe('when the new owner is associated with the party assigned property', () => {
      it('the party assigned property should not be changed', async () => {
        const { id: teamId } = await createATeam(testTeam);
        const { id: propertyId } = await createAProperty();
        await createATeamProperty(teamId, propertyId);

        const { id: ownerId } = await createAUser();
        const { id: assigneeId } = await createAUser();
        await createATeamMember({ teamId, userId: assigneeId });
        const { id: partyId } = await createAParty({ userId: ownerId, assignedPropertyId: propertyId });

        const { body: resultParty } = await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenantId, ownerId))
          .send({ to: { userId: assigneeId, teamId } });

        expect(resultParty.userId).to.equal(assigneeId);
        expect(resultParty.ownerTeam).to.equal(teamId);
        expect(resultParty.assignedPropertyId).to.equal(propertyId);
      });
    });

    describe('when the new owner is not associated with the party assigned property and there is only one property associated with him', () => {
      it('the party assigned property should be set to the property associated with the new owner', async () => {
        const { id: currentOwnerTeamId } = await createATeam(testTeam);
        const { id: currentPropertyId } = await createAProperty();
        await createATeamProperty(currentOwnerTeamId, currentPropertyId);
        const { id: currentOwnerId } = await createAUser();
        await createATeamMember({ teamId: currentOwnerTeamId, userId: currentOwnerId });

        const { id: newOwnerTeamId } = await createATeam(testTeam2);
        const { id: newPropertyId } = await createAProperty();
        await createATeamProperty(newOwnerTeamId, newPropertyId);
        const { id: newOwnerId } = await createAUser();
        await createATeamMember({ teamId: newOwnerTeamId, userId: newOwnerId });

        const { id: partyId } = await createAParty({ userId: currentOwnerId, ownerTeam: currentOwnerTeamId, assignedPropertyId: currentPropertyId });

        const { body: resultParty } = await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenantId, currentOwnerId))
          .send({ to: { userId: newOwnerId, teamId: newOwnerTeamId } });

        expect(resultParty.userId).to.equal(newOwnerId);
        expect(resultParty.ownerTeam).to.equal(newOwnerTeamId);
        expect(resultParty.assignedPropertyId).to.equal(newPropertyId);
      });
    });

    describe('when the new owner is not associated with the party assigned property and there are two properties associated with him', () => {
      it('the party assigned property should be set to null', async () => {
        const { id: currentOwnerTeamId } = await createATeam(testTeam);
        const { id: currentPropertyId } = await createAProperty();
        await createATeamProperty(currentOwnerTeamId, currentPropertyId);
        const { id: currentOwnerId } = await createAUser();
        await createATeamMember({ teamId: currentOwnerTeamId, userId: currentOwnerId });

        const { id: newOwnerTeamId } = await createATeam(testTeam2);
        const { id: newOwnerFirstPropertyId } = await createAProperty();
        await createATeamProperty(newOwnerTeamId, newOwnerFirstPropertyId);
        const { id: newOwnerSecondPropertyId } = await createAProperty();
        await createATeamProperty(newOwnerTeamId, newOwnerSecondPropertyId);
        const { id: newOwnerId } = await createAUser();
        await createATeamMember({ teamId: newOwnerTeamId, userId: newOwnerId });

        const { id: partyId } = await createAParty({ userId: currentOwnerId, ownerTeam: currentOwnerTeamId, assignedPropertyId: currentPropertyId });

        const { body: resultParty } = await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenantId, currentOwnerId))
          .send({ to: { userId: newOwnerId, teamId: newOwnerTeamId } });

        expect(resultParty.userId).to.equal(newOwnerId);
        expect(resultParty.ownerTeam).to.equal(newOwnerTeamId);
        expect(resultParty.assignedPropertyId).to.equal(null);
      });
    });

    describe('when the new owner is at a different property', () => {
      it('should trigger the PARTY_REASSIGNED_PROPERTY event', async () => {
        const { id: currentOwnerTeamId } = await createATeam(testTeam);
        const { id: currentPropertyId } = await createAProperty();
        await createATeamProperty(currentOwnerTeamId, currentPropertyId);
        const { id: currentOwnerId } = await createAUser();
        await createATeamMember({ teamId: currentOwnerTeamId, userId: currentOwnerId });

        const { id: newOwnerTeamId } = await createATeam(testTeam2);
        const { id: newPropertyId } = await createAProperty();
        await createATeamProperty(newOwnerTeamId, newPropertyId);
        const { id: newOwnerId } = await createAUser();
        await createATeamMember({ teamId: newOwnerTeamId, userId: newOwnerId });

        const { id: partyId } = await createAParty({ userId: currentOwnerId, ownerTeam: currentOwnerTeamId, assignedPropertyId: currentPropertyId });

        await request(app)
          .post(`/parties/${partyId}/assign`)
          .set(getAuthHeader(tenantId, currentOwnerId))
          .send({ to: { userId: newOwnerId, teamId: newOwnerTeamId } });

        const events = await getEventsByParty(ctx, partyId);
        const reassignedToPropertyEvent = events.find(ev => ev.event === DALTypes.PartyEventType.PARTY_REASSIGNED_PROPERTY);
        expect(reassignedToPropertyEvent, 'The PARTY_REASSIGNED_PROPERTY event was not triggered').to.be.ok;
      });
    });
  });
});
