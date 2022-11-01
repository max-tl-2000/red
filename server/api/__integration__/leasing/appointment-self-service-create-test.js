/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import {
  createAPartyMember,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  testCtx as ctx,
  createAProperty,
  createATeamPropertyProgram,
  createAnAppointment,
  createAParty,
  createAvailability,
  createAnInventory,
  refreshUnitSearch,
  saveUnitsRevaPricing,
  createUserEvent,
  createAPersonWithoutName,
} from '../../../testUtils/repoHelper';
import { updateTeam, getTeamMembersBy } from '../../../dal/teamsRepo';
import { CalendarUserEventType } from '../../../../common/enums/calendarTypes';
import { loadAppointmentsForParties } from '../../../dal/appointmentRepo';
import { getAllUserEvents, saveUserEvent, saveTeamEvent, markEventAsDeleted } from '../../../dal/calendarEventsRepo';
import { getTasks } from '../../../dal/tasksRepo';
import app from '../../api';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { loadParties } from '../../../dal/partyRepo';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { generateTokenForDomain } from '../../../services/tenantService';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { getContactInfosByPersonId } from '../../../dal/contactInfoRepo';
import { getPersonById } from '../../../dal/personRepo';

describe('POST: /guestCard', () => {
  const programEmailIdentifier = 'program-email-identifier';
  let hubTeamId;
  let header;
  const teamName = 'The HUB';

  const createProgram = async (teamId, onSiteLeasingTeamId, directEmailIdentifier = programEmailIdentifier) => {
    const { id: programPropertyId } = await createAProperty();
    return await createATeamPropertyProgram({
      teamId,
      propertyId: programPropertyId,
      onSiteLeasingTeamId,
      directEmailIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });
  };

  beforeEach(async () => {
    const user = await createAUser();
    const { id } = await createATeam({
      name: teamName,
      module: 'leasing',
      email: 'thehubteam@test.com',
      phone: '16504375757',
    });
    hubTeamId = id;
    // hubTeamEmail = directEmailIdentifier;

    await createATeamMember({ teamId: hubTeamId, userId: user.id });
    const token = await generateTokenForDomain({
      tenantId: tenant.id,
      domain: 'testing.reva.tech',
      expiresIn: '1m',
      allowedEndpoints: ['contactUs', 'leads', 'marketing/session', 'guestCard'],
    });
    header = {
      Authorization: `Bearer ${token}`,
      referer: 'http://testing.reva.tech',
    };
  });

  describe('when the request contains requestAppointment field', () => {
    describe('and the startDate is not valid', () => {
      it('should respond with status code 400 and INCORRECT_DATE token', async () => {
        const formData = {
          name: 'Orson Welles',
          phone: '+1-202-555-0130',
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: 'invalid-date',
          },
        };

        await createProgram(hubTeamId);

        const res = await request(app).post('/guestCard').set(header).send(formData);

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_DATE');
      });
    });

    describe('and the startDate is valid', () => {
      let onSiteLeasingTeamId;

      beforeEach(async () => {
        onSiteLeasingTeamId = (await createATeam()).id;

        await createProgram(hubTeamId, onSiteLeasingTeamId);
      });

      it('should create a party assigned to the dispatcher agent from the HUB, an appointment and an associated user calendar event', async () => {
        const { id: userId } = await createAUser();
        const { id: dispatcherId } = await createAUser();

        await createATeamMember({
          teamId: onSiteLeasingTeamId,
          userId,
        });
        await createATeamMember({
          teamId: hubTeamId,
          userId: dispatcherId,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });

        const tomorrow = now().startOf('day').add(1, 'days');

        const formData = {
          name: 'Orson Welles',
          email: 'orsonWells@test.com',
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: tomorrow.clone().add(8, 'hours'),
          },
        };

        const condition = msg => msg.data && msg.data.phone === formData.phone;
        const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

        const res = await request(app).post('/guestCard').set(header).send(formData);

        expect(res.status).to.equal(202);

        await task;

        const hubMembers = await getTeamMembersBy(ctx, hubTeamId);
        const nonDispatcherHubMember = hubMembers.find(m => m.id !== dispatcherId);
        const [party] = await loadParties(ctx);
        expect(party.userId).to.equal(nonDispatcherHubMember.userId);
        const [appointment] = await loadAppointmentsForParties(ctx, [party.id]);
        expect(appointment.userIds[0]).to.equal(userId);
        expect(appointment.metadata.appointmentCreatedFrom).to.equal(DALTypes.AppointmentCreatedFrom.SELF_SERVICE);

        const [event] = await getAllUserEvents(ctx, userId);
        expect(event).to.be.ok;
        expect(event.metadata).to.deep.equal({ type: CalendarUserEventType.SELF_BOOK, id: appointment.id });
      });

      describe('when several requests are received from the same person on different programs on different properties', () => {
        it('should create appointments for the correct parties', async () => {
          const { id: user1Id } = await createAUser();
          const { id: team1Id } = await createATeam();
          await createATeamMember({ teamId: team1Id, userId: user1Id });

          const { id: user2Id } = await createAUser();
          const { id: team2Id } = await createATeam();
          await createATeamMember({ teamId: team2Id, userId: user2Id });

          const { id: dispatcherId } = await createAUser();
          await createATeamMember({
            teamId: team1Id,
            userId: dispatcherId,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });
          await createATeamMember({
            teamId: team2Id,
            userId: dispatcherId,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });

          const { id: property1 } = await createAProperty();
          const teamPropertyProgram1 = await createATeamPropertyProgram({
            teamId: team1Id,
            propertyId: property1,
            onSiteLeasingTeamId: team1Id,
            directEmailIdentifier: 'property1',
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          const { id: property2 } = await createAProperty();
          const teamPropertyProgram2 = await createATeamPropertyProgram({
            teamId: team2Id,
            propertyId: property2,
            onSiteLeasingTeamId: team2Id,
            directEmailIdentifier: 'property2',
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          const { id: property3 } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team2Id,
            propertyId: property3,
            onSiteLeasingTeamId: team2Id,
            directEmailIdentifier: 'property3',
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          const yesterday = now().startOf('day').subtract(1, 'days');

          const personEmail = 'orsonWells@test.com';
          const contactInfos = enhance([{ type: 'email', value: personEmail, id: newId() }]);
          const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);

          const closedParty = await createAParty({ userId: user1Id, assignedPropertyId: property3, endDate: yesterday, ownerTeam: team1Id });
          await createAPartyMember(closedParty.id, { personId: person.id });

          const tomorrow = now().startOf('day').add(1, 'days');

          const getPayload = (teamEmail, hour) => ({
            name: 'Orson Welles',
            email: personEmail,
            teamEmail,
            requestAppointment: {
              startDate: tomorrow.clone().add(hour, 'hours'),
            },
          });

          const condition = msg => msg.data && msg.data.email === personEmail;
          const {
            tasks: [task1, task2, task3, task4],
          } = await setupQueueToWaitFor([condition, condition, condition, condition], ['webInquiry']);

          await request(app).post('/guestCard').set(header).send(getPayload('property1', 8)).expect(202);

          await task1;

          await request(app).post('/guestCard').set(header).send(getPayload('property2', 9)).expect(202);

          await task2;

          await request(app).post('/guestCard').set(header).send(getPayload('property1', 10)).expect(202);

          await task3;

          await request(app).post('/guestCard').set(header).send(getPayload('property3', 11)).expect(202);

          await task4;

          const parties = await loadParties(ctx, partyWfStatesSubset.all);
          expect(parties).to.have.lengthOf(3);

          const party1 = parties.find(p => p.teamPropertyProgramId === teamPropertyProgram1.id);
          const party2 = parties.find(p => p.teamPropertyProgramId === teamPropertyProgram2.id);

          const party1Appointments = await loadAppointmentsForParties(ctx, [party1.id]);
          expect(party1Appointments).to.have.lengthOf(2);

          const party2Appointments = await loadAppointmentsForParties(ctx, [party2.id]);
          expect(party2Appointments).to.have.lengthOf(1);

          const closedPartyAppointments = await loadAppointmentsForParties(ctx, [closedParty.id]);
          expect(closedPartyAppointments).to.have.lengthOf(1);
        });
      });

      describe('and there are two agents in the team', () => {
        describe("when agent A has an appointment for that date and agent B doesn't have any appointments", () => {
          it('should book appointment with agent B', async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: existingAppointmentId } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(11, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId);
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });

          describe('when targeted program has the same team as onSiteLeasingTeam', () => {
            describe('when team stragegy is "Round Robin" and agent A is next for party assignement', () => {
              it('should book appointment with agent B and assign party to the same agent', async () => {
                const { id: teamId } = await createATeam({ metadata: { partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN } });
                await createProgram(teamId, teamId, 'sameTeamProgramEmailIdentifier');

                const { id: agentAId } = await createAUser();
                await createATeamMember({ teamId, userId: agentAId });

                const { id: agentBId } = await createAUser();
                await createATeamMember({ teamId, userId: agentBId });

                // next round robin agent should be A
                await updateTeam(ctx, teamId, { metadata: { lastAssignedUser: agentBId } });

                const { id: partyId } = await createAParty({ userId: agentAId });

                const tomorrow = now().startOf('day').add(1, 'days');

                const { id: existingAppointmentId } = await createAnAppointment({
                  startDate: tomorrow.clone().add(9, 'hours'),
                  endDate: tomorrow.clone().add(10, 'hours'),
                  salesPersonId: agentAId,
                  partyId,
                });

                const formData = {
                  name: 'Orson Welles',
                  email: 'orsonWells@test.com',
                  teamEmail: 'sameTeamProgramEmailIdentifier',
                  requestAppointment: {
                    startDate: tomorrow.clone().add(8, 'hours'),
                  },
                };

                const condition = msg => msg.data && msg.data.phone === formData.phone;
                const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

                const res = await request(app).post('/guestCard').set(header).send(formData);

                expect(res.status).to.equal(202);

                await task;

                const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId);
                expect(appointment).to.be.ok;
                const [agent] = appointment.userIds;
                expect(agent).to.equal(agentBId);

                const [party] = await loadParties(ctx);
                expect(party.userId).to.equal(agentBId);
              });
            });
          });
        });

        describe("when agent A has an appointment for that date and agent B doesn't have any appointments but has dispatcher role", () => {
          it('should avoid dispatcher and book appointment with agent A', async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({
              teamId: onSiteLeasingTeamId,
              userId: agentBId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: existingAppointmentId } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              teamEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(11, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId);
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentAId);
          });
        });

        describe("when agent A has an appointment for that date and agent B doesn't have any appointments but has a sick leave", () => {
          it('should avoid agent b and book appointment with agent A', async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: existingAppointmentId } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            await createUserEvent({
              userId: agentBId,
              startDate: tomorrow.toISOString(),
              endDate: tomorrow.clone().add(1, 'days').toISOString(),
              metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'sick leave added for agent b' },
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              teamEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(11, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId);
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentAId);
          });
        });

        describe("when agent A has an appointment for that date and agent B doesn't have any appointments but has a deleted sick leave", () => {
          it('should avoid agent A and book appointment with agent B', async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: existingAppointmentId } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const sickLeave = await createUserEvent({
              userId: agentBId,
              startDate: tomorrow.toISOString(),
              endDate: tomorrow.clone().add(1, 'days').toISOString(),
              metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'sick leave added for agent b' },
            });
            await markEventAsDeleted(ctx, sickLeave.id, sickLeave.metadata);

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              teamEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(11, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId);
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });
        });

        describe('when agent A has an appointment for that date and agent B has more past appointments', () => {
          it("should book appointment with agent B because appointments in the past don't count", async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: sameDateAppt } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const yesterday = now().startOf('day').subtract(1, 'days');

            const { id: pastAppt } = await createAnAppointment({
              startDate: yesterday.clone().add(9, 'hours'),
              endDate: yesterday.clone().add(11, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const { id: otherPastAppt } = await createAnAppointment({
              startDate: yesterday.clone().add(12, 'hours'),
              endDate: yesterday.clone().add(13, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(12, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => ![sameDateAppt, pastAppt, otherPastAppt].includes(a.id));
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });
        });

        describe('when agent A has an appointment for that date and agent B has more appointments for another future date', () => {
          it("should book appointment with agent B because other future appointments don't count", async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: sameDateAppt } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const dayAfterTomorrow = now().startOf('day').add(2, 'days');

            const { id: futureAppt } = await createAnAppointment({
              startDate: dayAfterTomorrow.clone().add(9, 'hours'),
              endDate: dayAfterTomorrow.clone().add(11, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const { id: otherFutureAppt } = await createAnAppointment({
              startDate: dayAfterTomorrow.clone().add(12, 'hours'),
              endDate: dayAfterTomorrow.clone().add(13, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(12, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => ![sameDateAppt, futureAppt, otherFutureAppt].includes(a.id));
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });
        });

        describe('when agent A has a same date appointment and agent B has more same date appointments but with less booked time', () => {
          it('should book appointment with agent A because the number of appointments matter, not the booked time', async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: agentAAppt } = await createAnAppointment({
              startDate: tomorrow.clone().add(6, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const { id: agentBAppt1 } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const { id: agentBAppt2 } = await createAnAppointment({
              startDate: tomorrow.clone().add(10, 'hours'),
              endDate: tomorrow.clone().add(11, 'hours'),
              salesPersonId: agentBId,
              partyId,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(12, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => ![agentAAppt, agentBAppt1, agentBAppt2].includes(a.id));
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentAId);
          });
        });

        describe('when agent A has a same date appointment and agent B has more same date appointments but cancelled', () => {
          it("should book appointment with agent B because the cancelled appointments don't count", async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: agentAAppt } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            const { id: agentBAppt1 } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentBId,
              partyId,
              state: DALTypes.TaskStates.CANCELED,
            });

            const { id: agentBAppt2 } = await createAnAppointment({
              startDate: tomorrow.clone().add(10, 'hours'),
              endDate: tomorrow.clone().add(11, 'hours'),
              salesPersonId: agentBId,
              partyId,
              state: DALTypes.TaskStates.CANCELED,
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(12, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => ![agentAAppt, agentBAppt1, agentBAppt2].includes(a.id));
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });
        });

        describe('when agent A has a same date appointment and agent B has more same date personal events', () => {
          it("should book appointment with agent B because personal events don't count", async () => {
            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

            const { id: dispatcherId } = await createAUser();
            await createATeamMember({
              teamId: hubTeamId,
              userId: dispatcherId,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: partyId } = await createAParty({ userId: agentAId });

            const tomorrow = now().startOf('day').add(1, 'days');

            const { id: agentAAppt } = await createAnAppointment({
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              salesPersonId: agentAId,
              partyId,
            });

            await saveUserEvent(ctx, {
              userId: agentBId,
              startDate: tomorrow.clone().add(9, 'hours'),
              endDate: tomorrow.clone().add(10, 'hours'),
              metadata: { type: CalendarUserEventType.PERSONAL },
            });

            await saveUserEvent(ctx, {
              userId: agentBId,
              startDate: tomorrow.clone().add(10, 'hours'),
              endDate: tomorrow.clone().add(11, 'hours'),
              metadata: { type: CalendarUserEventType.PERSONAL },
            });

            const formData = {
              name: 'Orson Welles',
              email: 'orsonWelles@test.com',
              programEmail: programEmailIdentifier,
              requestAppointment: {
                startDate: tomorrow.clone().add(12, 'hours'),
              },
            };

            const condition = msg => msg.data && msg.data.email === formData.email;
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(formData);

            expect(res.status).to.equal(202);
            await task;

            const appointment = (await getTasks(ctx)).find(a => agentAAppt !== a.id);
            expect(appointment).to.be.ok;
            const [agent] = appointment.userIds;
            expect(agent).to.equal(agentBId);
          });

          describe("when agent B's personal events overlap with desired slot", () => {
            it('should book appointment with agent A', async () => {
              const { id: agentAId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });

              const { id: agentBId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });

              const { id: dispatcherId } = await createAUser();
              await createATeamMember({
                teamId: hubTeamId,
                userId: dispatcherId,
                roles: {
                  mainRoles: [MainRoleDefinition.LA.name],
                  functionalRoles: [FunctionalRoleDefinition.LD.name],
                },
              });

              const { id: partyId } = await createAParty({ userId: agentAId });

              const tomorrow = now().startOf('day').add(1, 'days');

              const { id: agentAAppt } = await createAnAppointment({
                startDate: tomorrow.clone().add(9, 'hours'),
                endDate: tomorrow.clone().add(10, 'hours'),
                salesPersonId: agentAId,
                partyId,
              });

              await saveUserEvent(ctx, {
                userId: agentBId,
                startDate: tomorrow.clone().add(9, 'hours'),
                endDate: tomorrow.clone().add(10, 'hours'),
                metadata: { type: CalendarUserEventType.PERSONAL },
              });

              await saveUserEvent(ctx, {
                userId: agentBId,
                startDate: tomorrow.clone().add(10, 'hours'),
                endDate: tomorrow.clone().add(11, 'hours'),
                metadata: { type: CalendarUserEventType.PERSONAL },
              });

              const formData = {
                name: 'Orson Welles',
                email: 'orsonWelles@test.com',
                programEmail: programEmailIdentifier,
                requestAppointment: {
                  startDate: tomorrow.clone().add(10, 'hours'),
                },
              };

              const condition = msg => msg.data && msg.data.email === formData.email;
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);

              expect(res.status).to.equal(202);
              await task;

              const appointment = (await getTasks(ctx)).find(a => agentAAppt !== a.id);
              expect(appointment).to.be.ok;
              const [agent] = appointment.userIds;
              expect(agent).to.equal(agentAId);
            });
          });
        });
      });

      it('should respond with status code 412 and SLOT_NOT_AVAILABLE token if the slot is no longer available', async () => {
        const { id: userId } = await createAUser();
        const { id: dispatcherId } = await createAUser();
        await createATeamMember({ teamId: onSiteLeasingTeamId, userId });
        await createATeamMember({
          teamId: hubTeamId,
          userId: dispatcherId,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });

        const tomorrow = now().startOf('day').add(1, 'days');

        const formData = {
          name: 'Orson Welles',
          email: 'orsonWells@test.com',
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: tomorrow.clone().add(8, 'hours'),
          },
        };
        const formData2 = {
          name: 'John Doe',
          email: 'johndoe@test.com',
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: tomorrow.clone().add(8, 'hours'),
          },
        };

        const condition = msg => msg.data && msg.data.email === formData.email;

        const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);
        const res = await request(app).post('/guestCard').set(header).send(formData);

        expect(res.status).to.equal(202);
        await task;

        const secondRes = await request(app).post('/guestCard').set(header).send(formData2);

        expect(secondRes.status).to.equal(412);
        expect(secondRes.body.token).to.equal('SLOT_NOT_AVAILABLE');
      });

      describe("when there's a team event that overlaps the desired slot", () => {
        it('should respond with status code 412 and SLOT_NOT_AVAILABLE token', async () => {
          const tomorrow = now().startOf('day').add(1, 'days');

          await saveTeamEvent(ctx, {
            teamId: hubTeamId,
            startDate: tomorrow.clone().add(8, 'hours'),
            endDate: tomorrow.clone().add(10, 'hours'),
            externalId: 'external-event-id',
          });

          const formData = {
            name: 'Orson Welles',
            email: 'orsonWells@test.com',
            programEmail: programEmailIdentifier,
            requestAppointment: {
              startDate: tomorrow.clone().add(8, 'hours'),
            },
          };

          const { body, status } = await request(app).post('/guestCard').set(header).send(formData);

          expect(status).to.equal(412);
          expect(body.token).to.equal('SLOT_NOT_AVAILABLE');
        });
      });

      describe('when startDate is not a multiple of slot duration', () => {
        it('should respond with status code 400 and INCORRECT_START_DATE token', async () => {
          const { id: userId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId });

          const tomorrow = now().startOf('day').add(1, 'days');

          const formData = {
            name: 'Orson Welles',
            email: 'orsonWells@test.com',
            programEmail: programEmailIdentifier,
            requestAppointment: {
              startDate: tomorrow.clone().add(8, 'hours').add('7', 'minutes').add('6', 'seconds').add('543', 'milliseconds'),
            },
          };

          const { body, status } = await request(app).post('/guestCard').set(header).send(formData);

          expect(status).to.equal(400);
          expect(body.token).to.equal('INCORRECT_DATE');
        });
      });

      describe('there are three agents in the team', () => {
        describe('when agent A has LA role in two teams and agent B has LA role in two teams', () => {
          describe('agent A and agent B have no entries in the Floating agents table ', () => {
            it('should book appointment with agent C', async () => {
              const team2 = await createATeam();
              const { id: agentAId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });
              await createATeamMember({ teamId: team2.id, userId: agentAId });

              const { id: agentBId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });
              await createATeamMember({ teamId: team2.id, userId: agentBId });

              const { id: agentCId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentCId });

              const { id: dispatcherId } = await createAUser();
              await createATeamMember({
                teamId: hubTeamId,
                userId: dispatcherId,
                roles: {
                  mainRoles: [MainRoleDefinition.LA.name],
                  functionalRoles: [FunctionalRoleDefinition.LD.name],
                },
              });

              const tomorrow = now().startOf('day').add(1, 'days');

              const formData = {
                name: 'Orson Welles',
                email: 'orsonWelles@test.com',
                programEmail: programEmailIdentifier,
                requestAppointment: {
                  startDate: tomorrow.clone().add(12, 'hours'),
                },
              };

              const condition = msg => msg.data && msg.data.email === formData.email;
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);

              expect(res.status).to.equal(202);
              await task;

              const appointment = (await getTasks(ctx))[0];
              expect(appointment).to.be.ok;
              const [agent] = appointment.userIds;
              expect(agent).to.equal(agentCId);
            });
          });

          describe('agent A is available on a day but agent B has no entries in the Floating agents table ', () => {
            it('should book appointment with any agent but agent B', async () => {
              const team2 = await createATeam();
              const { id: agentAId } = await createAUser();
              const teamMember1 = await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });
              await createATeamMember({ teamId: team2.id, userId: agentAId });
              const tomorrow = now().startOf('day').add(1, 'days');
              await createAvailability(teamMember1.id, tomorrow.toISOString(), agentAId);

              const { id: agentBId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });
              await createATeamMember({ teamId: team2.id, userId: agentBId });

              const { id: agentCId } = await createAUser();
              await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentCId });

              const { id: dispatcherId } = await createAUser();
              await createATeamMember({
                teamId: hubTeamId,
                userId: dispatcherId,
                roles: {
                  mainRoles: [MainRoleDefinition.LA.name],
                  functionalRoles: [FunctionalRoleDefinition.LD.name],
                },
              });

              const formData = {
                name: 'Orson Welles',
                email: 'orsonWelles@test.com',
                programEmail: programEmailIdentifier,
                requestAppointment: {
                  startDate: tomorrow.clone().add(12, 'hours'),
                },
              };

              const condition = msg => msg.data && msg.data.email === formData.email;
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);

              expect(res.status).to.equal(202);
              await task;

              const appointment = (await getTasks(ctx))[0];
              expect(appointment).to.be.ok;
              const [agent] = appointment.userIds;
              expect(agent).not.to.equal(agentBId);
            });
          });

          describe('agents A and B have entries in the Floating agents table ', () => {
            describe('agents A ang C already have an appointment on that day on another party ', () => {
              it('should book appointment with agent B', async () => {
                const team2 = await createATeam();
                const { id: agentAId } = await createAUser();
                const teamMember1 = await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentAId });
                const { id: dispatcherId } = await createAUser();
                await createATeamMember({
                  teamId: hubTeamId,
                  userId: dispatcherId,
                  roles: {
                    mainRoles: [MainRoleDefinition.LA.name],
                    functionalRoles: [FunctionalRoleDefinition.LD.name],
                  },
                });

                await createATeamMember({ teamId: team2.id, userId: agentAId });
                const tomorrow = now().startOf('day').add(1, 'days');
                await createAvailability(teamMember1.id, tomorrow.toISOString(), agentAId);

                const { id: agentBId } = await createAUser();
                const teamMember2 = await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentBId });
                await createATeamMember({ teamId: team2.id, userId: agentBId });
                await createAvailability(teamMember2.id, tomorrow.toISOString(), agentAId);

                const { id: agentCId } = await createAUser();
                await createATeamMember({ teamId: onSiteLeasingTeamId, userId: agentCId });

                const { id: partyId } = await createAParty({ userId: agentAId });

                const { id: existingAppointmentId } = await createAnAppointment({
                  startDate: tomorrow.clone().add(9, 'hours'),
                  endDate: tomorrow.clone().add(10, 'hours'),
                  salesPersonId: agentAId,
                  partyId,
                });
                const { id: existingAppointmentId2 } = await createAnAppointment({
                  startDate: tomorrow.clone().add(14, 'hours'),
                  endDate: tomorrow.clone().add(15, 'hours'),
                  salesPersonId: agentCId,
                  partyId,
                });

                const formData = {
                  name: 'Orson Welles',
                  email: 'orsonWelles@test.com',
                  programEmail: programEmailIdentifier,
                  requestAppointment: {
                    startDate: tomorrow.clone().add(12, 'hours'),
                  },
                };

                const condition = msg => msg.data && msg.data.email === formData.email;
                const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

                const res = await request(app).post('/guestCard').set(header).send(formData);

                expect(res.status).to.equal(202);
                await task;

                const appointment = (await getTasks(ctx)).find(a => a.id !== existingAppointmentId && a.id !== existingAppointmentId2);
                expect(appointment).to.be.ok;
                const [agent] = appointment.userIds;
                expect(agent).to.equal(agentBId);
              });
            });
          });
        });
      });
    });

    describe('when we receive a create-self-book-appointment request for a person that already exists in the system and has an existing party', () => {
      const createPerson = async (personEmail = 'johnj@test.com') => {
        const contactInfo = enhance([{ type: 'email', value: personEmail, id: newId() }]);
        const person = await createAPerson('John', 'J', contactInfo);
        return { personId: person.id, personEmail };
      };

      const getTomorrow = () => now().startOf('day').add(1, 'days');

      const createAppointment = async ({ startHour, partyId, ownerId, partyMembers, properties, teamId }) => {
        const tomorrow = getTomorrow();

        return await createAnAppointment({
          startDate: tomorrow.clone().add(startHour, 'hours'),
          endDate: tomorrow.clone().add(startHour + 1, 'hours'),
          salesPersonId: ownerId,
          partyId,
          partyMembers,
          properties,
          teamId,
        });
      };

      const getFormData = ({ startHour, email }) => {
        const tomorrow = getTomorrow();

        return {
          name: 'John J',
          email,
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: tomorrow.clone().add(startHour, 'hours'),
          },
        };
      };

      const getLastAppointment = appointments => appointments.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0];
      const getLastUpdatedAppointment = appointments => appointments.sort((a, b) => toMoment(b.updated_at).diff(toMoment(a.updated_at)))[0];

      it('should create the appointment for the existing party and the party owner should be set as the appointment owner when he is available', async () => {
        const onSiteLeasingTeamId = (await createATeam()).id;
        const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);

        const { id: partyOwnerId } = await createAUser();
        await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

        const { id: partyCollaboratorId } = await createAUser();
        await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyCollaboratorId });

        const { id: nonPartyCollaboratorId } = await createAUser();
        await createATeamMember({ teamId: onSiteLeasingTeamId, userId: nonPartyCollaboratorId });

        const { personId, personEmail } = await createPerson();

        const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyCollaboratorId], assignedPropertyId: propertyId });
        await createAPartyMember(partyId, { personId });
        await createAppointment({ startHour: 9, partyId, ownerId: partyOwnerId });
        await createAppointment({ startHour: 10, partyId, ownerId: partyOwnerId });
        await createAppointment({ startHour: 11, partyId, ownerId: partyCollaboratorId });

        const formData = getFormData({ startHour: 12, email: personEmail });
        const { personId: personId2, personEmail: personEmail2 } = await createPerson('johndoe1@reva.tech');
        await createAPartyMember(partyId, { personId: personId2 });
        const formData2 = getFormData({ startHour: 12, email: personEmail2 });
        const { personId: personId3, personEmail: personEmail3 } = await createPerson('johndoe2@reva.tech');
        await createAPartyMember(partyId, { personId: personId3 });
        const formData3 = getFormData({ startHour: 12, email: personEmail3 });

        const condition = msg => msg.data && msg.data.email === personEmail;
        const condition2 = msg => msg.data && msg.data.email === personEmail2;
        const condition3 = msg => msg.data && msg.data.email === personEmail3;
        const {
          tasks: [firstAppt, secondAppt, thirdAppt],
        } = await setupQueueToWaitFor([condition, condition2, condition3], ['webInquiry']);

        // first self-book request
        // the appointment should be assigned to the party onwer because he is available for that slot

        const { status: firstReqStatus } = await request(app).post('/guestCard').set(header).send(formData);

        expect(firstReqStatus).to.equal(202);
        await firstAppt;
        const apptsAfterFirstRequest = await getTasks(ctx);
        expect(apptsAfterFirstRequest.length).to.equal(4);
        const firstSelfBookAppt = getLastAppointment(apptsAfterFirstRequest);
        expect(firstSelfBookAppt.userIds[0]).to.equal(partyOwnerId);

        // second self-book request
        // the appointment should be assigned to the party collaborator because the party owner is not available anymore

        const { status: secondReqStatus } = await request(app).post('/guestCard').set(header).send(formData2);

        expect(secondReqStatus).to.equal(202);
        await secondAppt;
        const apptsAfterSecondRequest = await getTasks(ctx);
        expect(apptsAfterSecondRequest.length).to.equal(5);
        const secondSelfBookAppt = getLastAppointment(apptsAfterSecondRequest);
        expect(secondSelfBookAppt.userIds[0]).to.equal(partyCollaboratorId);

        // third self-bok request
        // the appointment should be assigned to the agent that is not party collaborator
        // because none of the following are available: the party owner, the party collaborator
        const { status: thirdReqStatus } = await request(app).post('/guestCard').set(header).send(formData3);

        expect(thirdReqStatus).to.equal(202);
        await thirdAppt;
        const apptsAfterThirdRequest = await getTasks(ctx);
        expect(apptsAfterThirdRequest.length).to.equal(6);
        const thirdSelfBookAppt = getLastAppointment(apptsAfterThirdRequest);
        expect(thirdSelfBookAppt.userIds[0]).to.equal(nonPartyCollaboratorId);
      });

      describe('when the person already has an appointment for the same time slot', () => {
        it('should throw a duplicate appointment error', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const { id: partyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyCollaboratorId });

          const { id: nonPartyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: nonPartyCollaboratorId });

          const { personId, personEmail } = await createPerson();

          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyCollaboratorId], assignedPropertyId: propertyId });
          const partyMember = await createAPartyMember(partyId, { personId });
          const partyMembers = [partyMember.id];

          await createAppointment({ startHour: 9, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 10, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 11, partyId, ownerId: partyCollaboratorId, partyMembers });

          const appointmentsBeforeRequest = await getTasks(ctx);
          expect(appointmentsBeforeRequest.length).to.equal(3);

          const formData = getFormData({ startHour: 11, email: personEmail });

          const result = await request(app).post('/guestCard').set(header).send(formData);

          expect(result.status).to.equal(412);
          expect(result.body.token).to.equal('DUPLICATE_APPOINTMENT');
          const appointmentsAfterRequest = await getTasks(ctx);
          expect(appointmentsAfterRequest.length).to.equal(3);
        });
      });
      describe('when the person already has an appointment for the same time slot and inventory', () => {
        it('should throw a duplicate appointment error', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);
          const inventory1 = await createAnInventory({ ctx, propertyId });
          const inventory2 = await createAnInventory({ ctx, propertyId });

          await saveUnitsRevaPricing([inventory1, inventory2]);
          await refreshUnitSearch();

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const { id: partyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyCollaboratorId });

          const { id: nonPartyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: nonPartyCollaboratorId });

          const { personId, personEmail } = await createPerson();

          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyCollaboratorId], assignedPropertyId: propertyId });
          const partyMember = await createAPartyMember(partyId, { personId });
          const partyMembers = [partyMember.id];
          const properties = [inventory1.id, inventory2.id];

          await createAppointment({ startHour: 9, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 10, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 11, partyId, ownerId: partyCollaboratorId, partyMembers, properties });

          const appointmentsBeforeRequest = await getTasks(ctx);
          expect(appointmentsBeforeRequest.length).to.equal(3);

          const formData = getFormData({ startHour: 11, email: personEmail });
          formData.requestAppointment.inventoryId = inventory1.id;

          const result = await request(app).post('/guestCard').set(header).send(formData);

          expect(result.status).to.equal(412);
          expect(result.body.token).to.equal('DUPLICATE_APPOINTMENT');
          const appointmentsAfterRequest = await getTasks(ctx);
          expect(appointmentsAfterRequest.length).to.equal(3);
        });
      });

      describe('when the person already has an appointment for the same time slot and another inventory', () => {
        it('should update the appointment units and add the new one', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);
          const inventory1 = await createAnInventory({ ctx, propertyId });
          const inventory2 = await createAnInventory({ ctx, propertyId });

          await saveUnitsRevaPricing([inventory1, inventory2]);
          await refreshUnitSearch();

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const { id: partyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyCollaboratorId });

          const { id: nonPartyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: nonPartyCollaboratorId });

          const { personId, personEmail } = await createPerson();

          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyCollaboratorId], assignedPropertyId: propertyId });
          const partyMember = await createAPartyMember(partyId, { personId });
          const partyMembers = [partyMember.id];
          const properties = [inventory2.id];

          await createAppointment({ startHour: 9, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 10, partyId, ownerId: partyOwnerId, partyMembers });
          await createAppointment({ startHour: 11, partyId, ownerId: partyCollaboratorId, partyMembers, properties });

          const appointmentsBeforeRequest = await getTasks(ctx);
          expect(appointmentsBeforeRequest.length).to.equal(3);
          const apptBeforeRequest = getLastAppointment(appointmentsBeforeRequest);

          const formData = getFormData({ startHour: 11, email: personEmail });
          formData.requestAppointment.inventoryId = inventory1.id;

          const result = await request(app).post('/guestCard').set(header).send(formData);

          expect(result.status).to.equal(202);
          const appointmentsAfterRequest = await getTasks(ctx);
          expect(appointmentsAfterRequest.length).to.equal(3);

          const apptAfterRequest = getLastUpdatedAppointment(appointmentsAfterRequest);

          expect(apptBeforeRequest.id).to.equal(apptAfterRequest.id);
          expect(apptAfterRequest.metadata.inventories.length).to.equal(2);
          expect(apptAfterRequest.metadata.inventories.some(i => i === inventory1.id)).to.be.true;
          expect(apptAfterRequest.metadata.inventories.some(i => i === inventory2.id)).to.be.true;
        });
      });
      describe('when the person already has an appointment for the same unit on another time slot', () => {
        it('should reschedule the appointment', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);
          const inventory1 = await createAnInventory({ ctx, propertyId });
          const inventory2 = await createAnInventory({ ctx, propertyId });

          await saveUnitsRevaPricing([inventory1, inventory2]);
          await refreshUnitSearch();

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const { id: partyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyCollaboratorId });

          const { id: nonPartyCollaboratorId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: nonPartyCollaboratorId });

          const { personId, personEmail } = await createPerson();

          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyCollaboratorId], assignedPropertyId: propertyId });
          const partyMember = await createAPartyMember(partyId, { personId });
          const partyMembers = [partyMember.id];
          const properties = [inventory1.id, inventory2.id];

          await createAppointment({ startHour: 9, partyId, ownerId: partyOwnerId, partyMembers, teamId: onSiteLeasingTeamId });
          await createAppointment({ startHour: 10, partyId, ownerId: partyOwnerId, partyMembers, teamId: onSiteLeasingTeamId });
          await createAppointment({ startHour: 11, partyId, ownerId: partyCollaboratorId, partyMembers, properties, teamId: onSiteLeasingTeamId });

          const appointmentsBeforeRequest = await getTasks(ctx);
          expect(appointmentsBeforeRequest.length).to.equal(3);
          const apptBeforeRequest = getLastAppointment(appointmentsBeforeRequest);

          const formData = getFormData({ startHour: 13, email: personEmail });
          formData.requestAppointment.inventoryId = inventory1.id;

          const result = await request(app).post('/guestCard').set(header).send(formData);

          expect(result.status).to.equal(202);
          const appointmentsAfterRequest = await getTasks(ctx);
          expect(appointmentsAfterRequest.length).to.equal(3);

          const apptAfterRequest = getLastUpdatedAppointment(appointmentsAfterRequest);

          expect(apptBeforeRequest.id).to.equal(apptAfterRequest.id);
          expect(apptAfterRequest.metadata.inventories.length).to.equal(2);
          expect(apptAfterRequest.metadata.inventories.some(i => i === inventory1.id)).to.be.true;
          expect(apptAfterRequest.metadata.inventories.some(i => i === inventory2.id)).to.be.true;
          expect(apptAfterRequest.metadata.startDate).to.equal(formData.requestAppointment.startDate.toISOString());
        });
      });

      describe('but has only the phone number as a contact info', () => {
        it('should create the appointment for the existing party and update the contact details of the party owner', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const contactInfo = enhance([{ type: 'phone', value: '16504375757', id: newId() }]);
          const person = await createAPerson('John', 'J', contactInfo);
          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyOwnerId], assignedPropertyId: propertyId });
          await createAPartyMember(partyId, { personId: person.id });
          const tomorrow = now().startOf('day').add(1, 'days');

          const formData = {
            name: 'Orson Welles',
            email: 'johhny@test.com',
            phone: '16504375757',
            programEmail: programEmailIdentifier,
            requestAppointment: {
              startDate: tomorrow.clone().add(12, 'hours'),
            },
          };

          const condition = msg => msg.data && msg.data.phone === formData.phone;
          const {
            tasks: [appointment],
          } = await setupQueueToWaitFor([condition], ['webInquiry']);

          const { status: firstReqStatus } = await request(app).post('/guestCard').set(header).send(formData);

          expect(firstReqStatus).to.equal(202);
          await appointment;
          const apptsAfterFirstRequest = await getTasks(ctx);
          const firstSelfBookAppt = getLastAppointment(apptsAfterFirstRequest);
          expect(firstSelfBookAppt.userIds[0]).to.equal(partyOwnerId);

          const contactInfos = await getContactInfosByPersonId(ctx, person.id);
          const email = contactInfos.find(ci => ci.type === 'email');
          expect(email.value).to.equal(formData.email);

          const updatedPerson = await getPersonById(ctx, person.id);
          expect(updatedPerson.fullName).to.equal(person.fullName);
        });
      });

      describe('but has only the phone number as a contact info', () => {
        it('should create the appointment for the existing party and update the contact details and name of the party owner', async () => {
          const onSiteLeasingTeamId = (await createATeam()).id;
          const { propertyId } = await createProgram(hubTeamId, onSiteLeasingTeamId);

          const { id: partyOwnerId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId: partyOwnerId });

          const contactInfo = enhance([{ type: 'phone', value: '16504375757', id: newId() }]);
          const person = await createAPersonWithoutName(contactInfo);
          const { id: partyId } = await createAParty({ userId: partyOwnerId, collaborators: [partyOwnerId], assignedPropertyId: propertyId });
          await createAPartyMember(partyId, { personId: person.id });
          const tomorrow = now().startOf('day').add(1, 'days');

          const formData = {
            name: 'Orson Welles',
            email: 'johhny@test.com',
            phone: '16504375757',
            programEmail: programEmailIdentifier,
            requestAppointment: {
              startDate: tomorrow.clone().add(12, 'hours'),
            },
          };

          const condition = msg => msg.data && msg.data.phone === formData.phone;
          const {
            tasks: [appointment],
          } = await setupQueueToWaitFor([condition], ['webInquiry']);

          const { status: firstReqStatus } = await request(app).post('/guestCard').set(header).send(formData);

          expect(firstReqStatus).to.equal(202);
          await appointment;
          const apptsAfterFirstRequest = await getTasks(ctx);
          const firstSelfBookAppt = getLastAppointment(apptsAfterFirstRequest);
          expect(firstSelfBookAppt.userIds[0]).to.equal(partyOwnerId);

          const contactInfos = await getContactInfosByPersonId(ctx, person.id);
          const email = contactInfos.find(ci => ci.type === 'email');
          expect(email.value).to.equal(formData.email);

          const updatedPerson = await getPersonById(ctx, person.id);
          expect(updatedPerson.fullName).to.equal(formData.name);
        });
      });
    });
  });
});
