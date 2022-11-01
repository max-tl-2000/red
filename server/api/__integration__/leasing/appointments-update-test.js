/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';

import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';
import {
  createAParty,
  createAUser,
  createATeamMember,
  createAPartyMember,
  createAnInventoryItem,
  createAnAppointment,
  createATeam,
  createAProperty,
  createATeamProperty,
  testCtx,
  toggleExtCalendarFeature,
  createAvailability,
  createTeamEvent,
} from '../../../testUtils/repoHelper';
import { updateTenant } from '../../../services/tenantService';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { validate as validatePatch } from '../../../testUtils/patchValidator';
import { getActivityLogs, getActLogDisplayNo } from '../../../dal/activityLogRepo';
import { getAllUserEvents } from '../../../dal/calendarEventsRepo';
import { COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { tenantId } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { loadParty } from '../../../dal/partyRepo';
import { now, DATE_ISO_FORMAT, toMoment } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE, UTC_TIMEZONE } from '../../../../common/date-constants';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/tasks', () => {
  let selectedProperty;

  beforeEach(async () => {
    selectedProperty = await createAProperty();
  });
  afterEach(async () => await toggleExtCalendarFeature(false));

  describe('given a request to update an appointment', () => {
    describe("when the appointment doesn't exist", () => {
      it('responds with status code 404 and TASK_NOT_FOUND token', async () => {
        await request(app)
          .patch(`/tasks/${newId()}`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('TASK_NOT_FOUND'));
      });
    });

    describe('when the id is not a uuid', () => {
      it('responds with status code 400 and INVALID_TASK_ID token', async () => {
        await request(app)
          .patch('/tasks/123')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_TASK_ID'));
      });
    });

    describe('when canceling the appointment', () => {
      it('marks the appointment as canceled and remove the record from UserCalendarEvents', async () => {
        const user = await createAUser();
        const party = await createAParty();
        const startDate = toMoment('2016-12-14T08:30:00.000Z', { timezone: UTC_TIMEZONE });
        const endDate = toMoment('2016-12-14T09:30:00.000Z', { timezone: UTC_TIMEZONE });
        const closingNotes = 'not interested anymore';

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          startDate,
          endDate,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        const events = await getAllUserEvents({ tenantId: tenant.id }, user.id);
        expect(events.length).to.equal(1);

        const { status, body } = await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({
            state: DALTypes.TaskStates.CANCELED,
            metadata: {
              appointmentResult: DALTypes.AppointmentResults.CANCELLED,
              closingNotes,
            },
            sendConfirmationMail: false,
          });

        expect(status).to.equal(200);
        expect(body.state).to.equal(DALTypes.TaskStates.CANCELED);
        expect(body.metadata.closingNotes).to.equal(closingNotes);

        const eventsAfterCancel = await getAllUserEvents({ tenantId: tenant.id }, user.id);
        expect(eventsAfterCancel.length).to.equal(0);
      });

      describe('and external calendar integration is enabled', () => {
        it('makes a request to update the appointment event in user enterprise email account, Reva appointments calendar', async () => {
          await toggleExtCalendarFeature(true);
          const user = await createAUser({ externalCalendars: { calendarAccount: 'user@test.com', revaCalendarId: newId() } });
          const party = await createAParty();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const removeEvent = sinon.spy();
          setCalendarOps({ removeEvent });

          const res = await request(app)
            .patch(`/tasks/${appointment.id}`)
            .set(getAuthHeader(tenant.id, user.id))
            .send({
              state: DALTypes.TaskStates.CANCELED,
              metadata: {
                appointmentResult: DALTypes.AppointmentResults.COMPLETE,
              },
            });

          expect(res.status).to.equal(200);
          expect(removeEvent).to.have.been.calledOnce;
        });
      });

      it('the party is NOT reassigned to the agent who completed the appointment', async () => {
        const team = await createATeam({ module: 'callCenter' });
        const user = await createAUser();
        const originalUser = await createAUser();
        const party = await createAParty({
          ownerTeam: team.id,
          teams: [team.id],
          userId: originalUser.id,
        });

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({
            state: DALTypes.TaskStates.CANCELED,
            metadata: {
              appointmentResult: DALTypes.AppointmentResults.COMPLETE,
            },
          })
          .expect(200)
          .expect(res => expect(res.body.state).to.equal(DALTypes.TaskStates.CANCELED));
        const updatedParty = await loadParty(testCtx, party.id);
        expect(updatedParty.userId).to.equal(originalUser.id);
      });

      describe('and unmark it as done', () => {
        it('should insert a record in UserCalendarEvents', async () => {
          const user = await createAUser();
          const party = await createAParty();
          const startDate = toMoment('2016-12-14T08:30:00.000Z', { timezone: UTC_TIMEZONE });
          const endDate = toMoment('2016-12-14T09:30:00.000Z', { timezone: UTC_TIMEZONE });

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            startDate,
            endDate,
            state: DALTypes.TaskStates.CANCELED,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const events = await getAllUserEvents({ tenantId: tenant.id }, user.id);
          expect(events.length).to.equal(0);

          const { status, body } = await request(app)
            .patch(`/tasks/${appointment.id}`)
            .set(getAuthHeader(tenant.id, user.id))
            .send({
              state: DALTypes.TaskStates.ACTIVE,
              metadata: {
                appointmentResult: '',
                isReopened: true,
              },
              sendConfirmationMail: false,
            });

          expect(status).to.equal(200);
          expect(body.state).to.equal(DALTypes.TaskStates.ACTIVE);

          const eventsAfterUnmarkAsDone = await getAllUserEvents({ tenantId: tenant.id }, user.id);
          expect(eventsAfterUnmarkAsDone.length).to.equal(1);
        });
      });
    });

    describe('when marking it as complete', () => {
      const createPartyAndTeams = async ({ teamModule1, teamMemberRole1, teamModule2, teamMemberRole2 }) => {
        const team = await createATeam({
          module: teamModule1,
          name: 'Team 1',
          email: 'leasing_email-1@bar.com',
          phone: '18675309111',
        });

        const originalUser = await createAUser();
        await createATeamMember({
          teamId: team.id,
          userId: originalUser.id,
          roles: teamMemberRole1,
        });
        const property1 = await createAProperty();
        await createATeamProperty(team.id, property1.id);

        const party = await createAParty({
          ownerTeam: team.id,
          teams: [team.id],
          userId: originalUser.id,
        });

        const user = await createAUser();

        let secondTeam = {};
        if (teamModule2) secondTeam = await createATeam({ module: teamModule2 });

        await createATeamMember({ teamId: secondTeam?.id || team.id, userId: user.id, roles: teamMemberRole2 });
        return { party, originalUser, user };
      };

      const createAndCompleteAppointment = async (user, party) => {
        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .set({ Host: `${tenant.name}.local.env.reva.tech` })
          .send({
            state: DALTypes.TaskStates.COMPLETED,
            metadata: {
              appointmentResult: DALTypes.AppointmentResults.COMPLETE,
            },
          })
          .expect(200)
          .expect(res => expect(res.body.state).to.equal(DALTypes.TaskStates.COMPLETED))
          .expect(res => expect(res.body.completionDate).to.not.be.null);
      };

      it('the appointment is updated', async () => {
        const user = await createAUser();
        const party = await createAParty();

        await createAndCompleteAppointment(user, party);
      });

      it('the party is reassigned to the agent who completed the appointment if the ownerAgent is LD ', async () => {
        const { party, user } = await createPartyAndTeams({
          teamModule1: DALTypes.ModuleType.LEASING,
          teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LD.name] },
          teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
        });

        await createAndCompleteAppointment(user, party);

        const updatedParty = await loadParty(testCtx, party.id);
        expect(updatedParty.userId).to.equal(user.id);
      });

      it('the party is NOT reassigned to the agent who completed the appointment if the ownerAgent is NOT LD ', async () => {
        const { party, user, originalUser } = await createPartyAndTeams({
          teamModule1: DALTypes.ModuleType.LEASING,
          teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
          teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
        });

        await createAndCompleteAppointment(user, party);

        const updatedParty = await loadParty(testCtx, party.id);
        expect(updatedParty.userId).to.equal(originalUser.id);
      });

      it('the party is NOT reassigned to the agent who completed the appointment if the ownerAgent is not from the same team', async () => {
        const { party, user, originalUser } = await createPartyAndTeams({
          teamModule1: DALTypes.ModuleType.LEASING,
          teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
          teamModule2: DALTypes.ModuleType.LEASING,
          teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
        });

        await createAndCompleteAppointment(user, party);

        const updatedParty = await loadParty(testCtx, party.id);
        expect(updatedParty.userId).to.equal(originalUser.id);
      });

      it('the party is NOT reassigned to the agent who completed the appointment if the ownerTeam is a resident services team ', async () => {
        const { party, user, originalUser } = await createPartyAndTeams({
          teamModule1: DALTypes.ModuleType.RESIDENT_SERVICES,
          teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LD.name] },
          teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
        });

        await createAndCompleteAppointment(user, party);

        const updatedParty = await loadParty(testCtx, party.id);
        expect(updatedParty.userId).to.equal(originalUser.id);
      });

      describe('specific for demo tenants', () => {
        beforeEach(async () => {
          await updateTenant(tenant.id, {
            metadata: {
              isDemoMode: true,
            },
          });
        });

        it('the party is reassigned to the agent who completed the appointment if the ownerTeam is Call Center', async () => {
          const { party, user } = await createPartyAndTeams({
            teamModule1: DALTypes.ModuleType.CALL_CENTER,
            teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
            teamModule2: DALTypes.ModuleType.LEASING,
            teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
          });

          await createAndCompleteAppointment(user, party);

          const updatedParty = await loadParty(testCtx, party.id);
          expect(updatedParty.userId).to.equal(user.id);
        });

        it('the party is NOT reassigned to the agent who completed the appointment if the ownerTeam is not Call Center', async () => {
          const { party, user, originalUser } = await createPartyAndTeams({
            teamModule1: DALTypes.ModuleType.LEASING,
            teamMemberRole1: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
            teamModule2: DALTypes.ModuleType.LEASING,
            teamMemberRole2: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
          });

          await createAndCompleteAppointment(user, party);

          const updatedParty = await loadParty(testCtx, party.id);
          expect(updatedParty.userId).to.equal(originalUser.id);
        });
      });

      it('saves and logs completedBy user', async () => {
        const user = await createAUser();
        const completedBy = await createAUser({ name: 'completed by' });
        const party = await createAParty();

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        const res = await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, completedBy.id))
          .send({ state: DALTypes.TaskStates.COMPLETED });

        expect(res.status).to.equal(200);

        const data = res.body.metadata;
        expect(data.completedBy).to.equal(completedBy.id);

        const { details } = (
          await getActivityLogs({
            tenantId: tenant.id,
          })
        ).find(l => l.component === COMPONENT_TYPES.APPOINTMENT);

        expect(details.completedBy).to.equal(completedBy.fullName);
      });

      describe('and external calendar integration is enabled', () => {
        it('makes a request to update the appointment event in user enterprise email account, Reva appointments calendar', async () => {
          await toggleExtCalendarFeature(true);
          const user = await createAUser({ externalCalendars: { calendarAccount: 'user@test.com', revaCalendarId: newId() } });
          const completedBy = await createAUser({ name: 'completed by' });
          const party = await createAParty({ userId: user.id }, { tenantId: tenant.id }, { createAssignedProperty: true });

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const createEvent = sinon.spy();
          setCalendarOps({ createEvent });

          const res = await request(app)
            .patch(`/tasks/${appointment.id}`)
            .set(getAuthHeader(tenant.id, completedBy.id))
            .send({ state: DALTypes.TaskStates.COMPLETED });

          expect(res.status).to.equal(200);
          expect(createEvent).to.have.been.calledOnce;
        });
      });
    });

    describe('when updating the party members', () => {
      it('the response appointment has the updated party members', async () => {
        const user = await createAUser();
        const party = await createAParty();

        const initialPartyMembers = [await createAPartyMember(party.id), await createAPartyMember(party.id)].map(pm => pm.id);

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          partyMembers: initialPartyMembers,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        const newPartyMembers = [await createAPartyMember(party.id), await createAPartyMember(party.id)].map(pm => pm.id);

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({ metadata: { partyMembers: newPartyMembers } })
          .expect(200)
          .expect(res => expect(res.body.metadata.partyMembers).to.deep.equal(newPartyMembers));
      });
    });

    describe('when updating the properties', () => {
      it('the response appointment has the updated properties', async () => {
        const user = await createAUser();
        const party = await createAParty();

        const initialProperties = [await createAnInventoryItem(), await createAnInventoryItem()].map(p => p.id);

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          properties: initialProperties,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        const newProperties = [await createAnInventoryItem(), await createAnInventoryItem()].map(p => p.id);

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({ metadata: { properties: newProperties } })
          .expect(200)
          .expect(res => expect(res.body.metadata.properties).to.deep.equal(newProperties));
      });
    });

    describe('when updating the note', () => {
      it('the response appointment has the updated note', async () => {
        const user = await createAUser();
        const party = await createAParty();

        const note = 'first';

        const appointment = await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          note,
          metadata: { selectedPropertyId: selectedProperty.id },
        });

        const newNote = 'third';

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({ metadata: { note: newNote } })
          .expect(200)
          .expect(res => expect(res.body.metadata.note).to.deep.equal(newNote));
      });
    });
    describe('given a request to update a list of appointments', () => {
      describe('when the list contains one appointment', () => {
        it('responds with status code 200 and has the updated appointment in response', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const appointmentsBeforeUpdateResponse = await request(app).get(`/parties/${party.id}/tasks`).set(getAuthHeader(tenantId, user.id));

          const appointmentBeforeUpdate = appointmentsBeforeUpdateResponse.body[0];

          const appointmentsDelta = [{ id: appointment.id, state: DALTypes.TaskStates.COMPLETED }];

          const patchAppointmentResponse = await request(app).patch('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointmentsDelta).expect(200);

          const appointmentAfterUpdate = patchAppointmentResponse.body[0];

          const expectedFieldsToBeUpdated = {
            state: appointmentsDelta[0].state,
          };

          expect(validatePatch(appointmentBeforeUpdate, appointmentAfterUpdate, expectedFieldsToBeUpdated)).to.be.true;
        });

        it('responds with status code 200 and has the appointment entity keys ', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const appointmentsDelta = [{ id: appointment.id, state: DALTypes.TaskStates.COMPLETED }];

          const taskKeys = [
            'id',
            'name',
            'partyId',
            'userIds',
            'state',
            'dueDate',
            'category',
            'metadata',
            'created_at',
            'updated_at',
            'completionDate',
            'modified_by',
            'createdFromCommId',
          ];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0]).to.have.all.keys(taskKeys));
        });
      });

      describe('when the list contains two appointments', () => {
        it('responds with status code 200 and has a list of two appointments with updated values in response', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const inventoryItem = await createAnInventoryItem();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const appointment2 = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const appointmentsDelta = [
            { id: appointment.id, state: DALTypes.TaskStates.COMPLETED },
            {
              id: appointment2.id,
              metadata: { properties: [inventoryItem.id] },
            },
          ];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0].state).to.be.equal(DALTypes.TaskStates.COMPLETED))
            .expect(r => expect(r.body[0].completionDate).to.not.be.null)
            .expect(r => expect(r.body[1].metadata.properties.length).to.equal(1))
            .expect(r => expect(r.body[1].metadata.properties).to.deep.equal([inventoryItem.id]));
        });
      });

      describe('when adding one property to an appointment that has no properties', () => {
        it('responds with status code 200 and the updated appointment has one property', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const inventoryItem = await createAnInventoryItem();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const appointmentsDelta = [
            {
              id: appointment.id,
              metadata: { properties: [inventoryItem.id] },
            },
          ];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0].metadata.properties.length).to.equal(1))
            .expect(r => expect(r.body[0].metadata.properties).to.deep.equal([inventoryItem.id]));
        });
      });

      describe('when adding a property to an appointment that already has one property', () => {
        it('responds with status code 200 and the updated appointment has two properties', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const existingInventoryItem = await createAnInventoryItem();
          const newInventoryItem = await createAnInventoryItem();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: {
              properties: [existingInventoryItem.id],
              selectedPropertyId: selectedProperty.id,
            },
          });

          const appointmentsDelta = [
            {
              id: appointment.id,
              metadata: {
                properties: [existingInventoryItem.id, newInventoryItem.id],
                selectedPropertyId: selectedProperty.id,
              },
            },
          ];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0].metadata.properties.length).to.equal(2))
            .expect(r => expect(r.body[0].metadata.properties).to.deep.equal([existingInventoryItem.id, newInventoryItem.id]));
        });
      });

      describe('when removing a property from an appointment that has only one property', () => {
        it('responds with status code 200 and the updated appointment has no properties', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const existingInventoryItem = await createAnInventoryItem();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: {
              inventories: [existingInventoryItem.id],
              selectedPropertyId: selectedProperty.id,
            },
          });

          const appointmentsDelta = [{ id: appointment.id, metadata: { inventories: [] } }];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0].metadata.inventories.length).to.equal(0));
        });
      });

      describe('when removing a property from an appointment that has two properties', () => {
        it('responds with status code 200 and the updated appointment has one property', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const existingInventoryItem = await createAnInventoryItem();
          const existingInventoryItem2 = await createAnInventoryItem();

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: user.id,
            metadata: {
              inventories: [existingInventoryItem.id, existingInventoryItem2.id],
              selectedPropertyId: selectedProperty.id,
            },
          });

          const appointmentsDelta = [
            {
              id: appointment.id,
              metadata: { inventories: [existingInventoryItem.id] },
            },
          ];

          await request(app)
            .patch('/tasks')
            .set(getAuthHeader(tenant.id, user.id))
            .send(appointmentsDelta)
            .expect(200)
            .expect(r => expect(r.body[0].metadata.inventories.length).to.equal(1))
            .expect(r => expect(r.body[0].metadata.inventories).to.deep.equal([existingInventoryItem.id]));
        });
      });

      describe('when updating an appointment', () => {
        it('the update log will keep the displayNo', async () => {
          const user = await createAUser();
          const party = await createAParty({ userId: user.id });

          const appointment = {
            salesPersonId: user.id,
            partyId: party.id,
            note: 'test',
            startDate: new Date('12-14-2015 16:30:00'),
            endDate: new Date('12-14-2015 17:30:00'),
            category: DALTypes.TaskCategories.APPOINTMENT,
            metadata: { selectedPropertyId: selectedProperty.id },
          };

          const createRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

          expect(createRes.status).to.equal(200);
          const seqDisplayNo = await getActLogDisplayNo(testCtx);

          const appointmentsDelta = [
            {
              id: createRes.body.id,
              metadata: { endDate: new Date('12-14-2015 18:30:00') },
            },
          ];

          const updateRes = await request(app).patch('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointmentsDelta);

          expect(updateRes.status).to.equal(200);

          const logs = await getActivityLogs({ tenantId: tenant.id });
          const updateAppointmentsLog = logs.filter(p => p.component === COMPONENT_TYPES.APPOINTMENT);
          expect(updateAppointmentsLog.length).to.equal(2);
          expect(updateAppointmentsLog.map(l => l.details.seqDisplayNo).sort()).to.deep.equal([seqDisplayNo, seqDisplayNo]);
        });
      });

      describe('when appointment owner and start date are changed', () => {
        it('the appointment should be reassigned to the new owner, the dueDate should be set to start date and the changes should be reflected in UserCalendarEvents table', async () => {
          const { id: firstOwnerId } = await createAUser();
          const { id: secondOwnerId } = await createAUser();
          const party = await createAParty();
          const startDate = toMoment('2016-12-14T08:30:00.000Z', { timezone: UTC_TIMEZONE });
          const endDate = toMoment('2016-12-14T09:30:00.000Z', { timezone: UTC_TIMEZONE });

          const appointment = await createAnAppointment({
            partyId: party.id,
            salesPersonId: firstOwnerId,
            startDate,
            endDate,
            metadata: { selectedPropertyId: selectedProperty.id },
          });

          const newStartDate = '2016-12-14T09:00:00.000Z';

          await request(app)
            .patch(`/tasks/${appointment.id}`)
            .set(getAuthHeader(tenant.id, firstOwnerId))
            .send({
              userIds: [secondOwnerId],
              metadata: {
                startDate: newStartDate,
              },
            })
            .expect(200)
            .expect(res => expect(res.body.dueDate).to.equal(res.body.metadata.startDate))
            .expect(res => expect(res.body.userIds[0]).to.equal(secondOwnerId));

          const eventsForFirstOwner = await getAllUserEvents({ tenantId: tenant.id }, firstOwnerId);
          expect(eventsForFirstOwner.length).to.equal(0);

          const eventsForSecondOwner = await getAllUserEvents({ tenantId: tenant.id }, secondOwnerId);
          expect(eventsForSecondOwner.length).to.equal(1);
          const { userId: eventUserId, startDate: eventStartDate, endDate: eventEndDate } = eventsForSecondOwner[0];
          expect(eventUserId).to.equal(secondOwnerId);
          expect(toMoment(eventStartDate, { timezone: UTC_TIMEZONE }).isSame(toMoment(newStartDate, { timezone: UTC_TIMEZONE }))).to.equal(true);
          expect(toMoment(eventEndDate, { timezone: UTC_TIMEZONE }).isSame(endDate)).to.equal(true);
        });
      });

      describe('when appointment is reassigned from the assign menu', () => {
        describe('and there are no conflicting appointments with the new owner and new owner is available for dates', () => {
          it('the appointment should be reassigned to the new owner and the changes should be reflected in UserCalendarEvents table', async () => {
            const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
            const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);
            const { id: teamId } = await createATeam();
            const { id: firstOwnerId } = await createAUser();
            const { id: secondOwnerId } = await createAUser();
            const teamMember = await createATeamMember({ teamId, userId: secondOwnerId });

            await createAvailability(teamMember.id, tomorrow, firstOwnerId);
            await createAvailability(teamMember.id, dayAfterTomorrow, firstOwnerId);

            const party = await createAParty();

            const appointmentStartDate = `${tomorrow}T13:00:00Z`;
            const appointmentEndDate = `${tomorrow}T14:00:00Z`;

            const appointment = await createAnAppointment({
              startDate: new Date(appointmentStartDate),
              endDate: new Date(appointmentEndDate),
              salesPersonId: firstOwnerId,
              partyId: party.id,
              metadata: { selectedPropertyId: selectedProperty.id },
            });

            await request(app)
              .patch(`/tasks/${appointment.id}`)
              .set(getAuthHeader(tenant.id, firstOwnerId))
              .send({
                userIds: [secondOwnerId],
                metadata: { teamId },
                checkConflictingAppointments: true,
              })
              .expect(200)
              .expect(res => expect(res.body.dueDate).to.equal(res.body.metadata.startDate))
              .expect(res => expect(res.body.userIds[0]).to.equal(secondOwnerId));
            const eventsForFirstOwner = await getAllUserEvents({ tenantId: tenant.id }, firstOwnerId);
            expect(eventsForFirstOwner.length).to.equal(0);

            const eventsForSecondOwner = await getAllUserEvents({ tenantId: tenant.id }, secondOwnerId);
            expect(eventsForSecondOwner.length).to.equal(1);
            const { userId: eventUserId } = eventsForSecondOwner[0];
            expect(eventUserId).to.equal(secondOwnerId);
          });
        });

        describe('and there are no conflicting appointments with the new owner and new owner is not available for dates', () => {
          it('should not re-assign the appointment and the response should have status code 400 and contain the list of conflicting appointments', async () => {
            const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
            const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);
            const { id: teamId } = await createATeam();
            const { id: teamId2 } = await createATeam();
            const { id: firstOwnerId } = await createAUser();
            const { id: secondOwnerId } = await createAUser();
            const teamMember = await createATeamMember({ teamId, userId: secondOwnerId });
            const teamMember2 = await createATeamMember({ teamId: teamId2, userId: secondOwnerId });

            await createAvailability(teamMember2.id, tomorrow, firstOwnerId);
            await createAvailability(teamMember.id, dayAfterTomorrow, firstOwnerId);

            const party = await createAParty();

            const appointmentStartDate = `${tomorrow}T13:00:00Z`;
            const appointmentEndDate = `${tomorrow}T14:00:00Z`;

            const appointment = await createAnAppointment({
              startDate: new Date(appointmentStartDate),
              endDate: new Date(appointmentEndDate),
              salesPersonId: firstOwnerId,
              partyId: party.id,
              metadata: { selectedPropertyId: selectedProperty.id },
            });

            await request(app)
              .patch(`/tasks/${appointment.id}`)
              .set(getAuthHeader(tenant.id, firstOwnerId))
              .send({
                userIds: [secondOwnerId],
                metadata: { teamId },
                checkConflictingAppointments: true,
              })
              .expect(412)
              .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
              .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([appointment.id]));
            const eventsForFirstOwner = await getAllUserEvents({ tenantId: tenant.id }, firstOwnerId);
            expect(eventsForFirstOwner.length).to.equal(1);

            const eventsForSecondOwner = await getAllUserEvents({ tenantId: tenant.id }, secondOwnerId);
            expect(eventsForSecondOwner.length).to.equal(0);
            const { userId: eventUserId } = eventsForFirstOwner[0];
            expect(eventUserId).to.equal(firstOwnerId);
          });
        });

        describe('and there are conflicting appointments with the new owner and new owner is available for dates', () => {
          it('should not re-assign the appointment and the response should have status code 400 and contain the list of conflicting appointments', async () => {
            const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
            const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);
            const { id: teamId } = await createATeam();
            const { id: firstOwnerId } = await createAUser();
            const { id: secondOwnerId } = await createAUser();
            const teamMember = await createATeamMember({ teamId, userId: secondOwnerId });

            await createAvailability(teamMember.id, tomorrow, firstOwnerId);
            await createAvailability(teamMember.id, dayAfterTomorrow, firstOwnerId);

            const party = await createAParty();

            const appointmentStartDate = `${tomorrow}T13:00:00Z`;
            const appointmentEndDate = `${tomorrow}T14:00:00Z`;
            const appointmentEndDate2 = `${tomorrow}T13:30:00Z`;

            const appointment = await createAnAppointment({
              startDate: new Date(appointmentStartDate),
              endDate: new Date(appointmentEndDate),
              salesPersonId: firstOwnerId,
              partyId: party.id,
              metadata: { selectedPropertyId: selectedProperty.id },
            });

            const party2 = await createAParty();
            await createAnAppointment({
              startDate: new Date(appointmentStartDate),
              endDate: new Date(appointmentEndDate2),
              salesPersonId: secondOwnerId,
              partyId: party2.id,
              metadata: { selectedPropertyId: selectedProperty.id },
            });

            await request(app)
              .patch(`/tasks/${appointment.id}`)
              .set(getAuthHeader(tenant.id, firstOwnerId))
              .send({
                userIds: [secondOwnerId],
                metadata: { teamId },
                checkConflictingAppointments: true,
              })
              .expect(412)
              .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
              .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([appointment.id]));
            const eventsForFirstOwner = await getAllUserEvents({ tenantId: tenant.id }, firstOwnerId);
            expect(eventsForFirstOwner.length).to.equal(1);

            const eventsForSecondOwner = await getAllUserEvents({ tenantId: tenant.id }, secondOwnerId);
            expect(eventsForSecondOwner.length).to.equal(1);
            const { userId: eventUserId } = eventsForFirstOwner[0];
            expect(eventUserId).to.equal(firstOwnerId);
          });
        });

        describe("and there are conflicting appointments with the new owner's team and new owner is available for dates", () => {
          it('should not re-assign the appointment and the response should have status code 400 and contain the list of conflicting appointments', async () => {
            const tomorrow = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(DATE_ISO_FORMAT);
            const dayAfterTomorrow = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(DATE_ISO_FORMAT);
            const { id: teamId } = await createATeam();
            const { id: firstOwnerId } = await createAUser();
            const { id: secondOwnerId } = await createAUser();
            const teamMember = await createATeamMember({ teamId, userId: secondOwnerId });

            await createAvailability(teamMember.id, tomorrow, firstOwnerId);
            await createAvailability(teamMember.id, dayAfterTomorrow, firstOwnerId);

            const party = await createAParty();

            const appointmentStartDate = `${tomorrow}T13:00:00Z`;
            const appointmentEndDate = `${tomorrow}T14:00:00Z`;

            const appointment = await createAnAppointment({
              startDate: new Date(appointmentStartDate),
              endDate: new Date(appointmentEndDate),
              salesPersonId: firstOwnerId,
              partyId: party.id,
              metadata: { selectedPropertyId: selectedProperty.id },
            });

            const allDayEventStart = now({ timezone: LA_TIMEZONE }).format(DATE_ISO_FORMAT);

            await createTeamEvent({
              teamId,
              startDate: allDayEventStart,
              endDate: dayAfterTomorrow,
            });

            await request(app)
              .patch(`/tasks/${appointment.id}`)
              .set(getAuthHeader(tenant.id, firstOwnerId))
              .send({
                userIds: [secondOwnerId],
                metadata: { teamId },
                checkConflictingAppointments: true,
              })
              .expect(412)
              .expect(res => expect(res.body.token).to.equal('APPOINTMENTS_CONFLICT'))
              .expect(res => expect(res.body.data.appointmentIds).to.deep.equal([appointment.id]));
            const eventsForFirstOwner = await getAllUserEvents({ tenantId: tenant.id }, firstOwnerId);
            expect(eventsForFirstOwner.length).to.equal(1);

            const eventsForSecondOwner = await getAllUserEvents({ tenantId: tenant.id }, secondOwnerId);
            expect(eventsForSecondOwner.length).to.equal(0);
            const { userId: eventUserId } = eventsForFirstOwner[0];
            expect(eventUserId).to.equal(firstOwnerId);
          });
        });
      });
    });
  });
});
