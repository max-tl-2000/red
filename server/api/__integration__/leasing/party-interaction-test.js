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
import {
  testCtx as ctx,
  createAUser,
  createAParty,
  createAnInventory,
  createAnAmenity,
  createAnAppointment,
  addAmenityToInventory,
  createATeam,
  createATeamMember,
  createInventoryProcess,
} from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { createParty, loadParty } from '../../../dal/partyRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';

describe('Party Interactions', () => {
  let partyId;
  let primaryUser;
  let collaboratorUser;
  let team1;

  beforeEach(async () => {
    primaryUser = await createAUser();
    const team = await createATeam();
    const party = await createAParty({ userId: primaryUser.id, teams: [team.id], ownerTeam: team.id });
    partyId = party.id;
    collaboratorUser = await createAUser();
    team1 = await createATeam({
      name: 'team1',
      module: 'leasing',
      email: 'test1@test.a',
      phone: '16503381450',
    });
    const team2 = await createATeam({
      name: 'team2',
      module: 'residentServices',
      email: 'test2@test.a',
      phone: '16197384381',
    });
    collaboratorUser.teams = [team1, team2];
  });

  describe('when a user adds an appointment for a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const appointment = {
        salesPersonId: collaboratorUser.id,
        partyId,
        category: DALTypes.TaskCategories.APPOINTMENT,
        note: 'test',
        startDate: new Date('12-14-2015 16:30:00'),
        endDate: new Date('12-14-2015 17:30:00'),
      };

      const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, collaboratorUser.id)).send(appointment);

      expect(res.status).to.equal(200);
      const party = await loadParty({ tenantId: tenant.id }, partyId);
      expect(party.collaborators).to.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user adds two appointments for a party', () => {
    it('the user is added to the party collaborators list only once', async () => {
      const appointment = {
        salesPersonId: collaboratorUser.id,
        partyId,
        category: DALTypes.TaskCategories.APPOINTMENT,
        note: 'test',
        startDate: new Date('12-14-2015 16:30:00'),
        endDate: new Date('12-14-2015 17:30:00'),
      };

      const res1 = await request(app).post('/tasks').set(getAuthHeader(tenant.id, collaboratorUser.id)).send(appointment);

      expect(res1.status).to.equal(200);

      const res2 = await request(app).post('/tasks').set(getAuthHeader(tenant.id, collaboratorUser.id)).send(appointment);

      expect(res2.status).to.equal(200);

      const party = await loadParty({ tenantId: tenant.id }, partyId);
      expect(party.collaborators).to.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user updates an appointment for a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const appointment = {
        salesPersonId: collaboratorUser.id,
        partyId,
        category: DALTypes.TaskCategories.APPOINTMENT,
        note: 'test',
        startDate: new Date('12-14-2015 16:30:00'),
        endDate: new Date('12-14-2015 17:30:00'),
      };

      const createRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, primaryUser.id)).send(appointment);

      expect(createRes.status).to.equal(200);
      const { id } = createRes.body;

      const updateRes = await request(app)
        .patch(`/tasks/${id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id))
        .send({ state: DALTypes.TaskStates.COMPLETED });

      expect(updateRes.status).to.equal(200);
      const party = await loadParty({ tenantId: tenant.id }, partyId);
      expect(party.collaborators.sort()).to.deep.equal([primaryUser.id, collaboratorUser.id].sort());
    });
  });

  describe('when a user updates appointments for more parties', () => {
    it('the user is added to the parties collaborator lists', async () => {
      const user = await createAUser();
      const team = await createATeam();
      const { id: partyId1 } = await createAParty({ userId: user.id, ownerTeam: team.id, teams: [team.id] });
      const inventoryItem = await createAnInventory();

      const appointment1 = await createAnAppointment({
        partyId: partyId1,
        salesPersonId: user.id,
      });

      const { id: partyId2 } = await createAParty({ userId: user.id, ownerTeam: team.id, teams: [team.id] });
      const appointment2 = await createAnAppointment({
        partyId: partyId2,
        salesPersonId: user.id,
      });

      const appointmentDelta1 = {
        state: DALTypes.TaskStates.COMPLETED,
      };
      const appointmentDelta2 = {
        metadata: { inventories: [inventoryItem.id] },
      };

      const updateRes1 = await request(app).patch(`/tasks/${appointment1.id}`).set(getAuthHeader(tenant.id, collaboratorUser.id)).send(appointmentDelta1);

      const updateRes2 = await request(app).patch(`/tasks/${appointment2.id}`).set(getAuthHeader(tenant.id, collaboratorUser.id)).send(appointmentDelta2);

      expect(updateRes1.status).to.equal(200);
      const party1 = await loadParty({ tenantId: tenant.id }, partyId1);
      expect(party1.collaborators.sort()).to.deep.equal([user.id, collaboratorUser.id].sort());

      expect(updateRes2.status).to.equal(200);
      const party2 = await loadParty({ tenantId: tenant.id }, partyId2);
      expect(party2.collaborators.sort()).to.deep.equal([user.id, collaboratorUser.id].sort());
    });
  });

  describe('when a user creates a quote for a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const inventory = await createAnInventory();
      const amenity = await createAnAmenity({
        id: newId(),
        category: 'inventory',
        propertyId: inventory.propertyId,
      });
      await addAmenityToInventory(ctx, inventory.id, amenity.id);

      const res = await request(app).post('/quotes').set(getAuthHeader(tenant.id, collaboratorUser.id)).send({ inventoryId: inventory.id, partyId });

      expect(res.status).to.equal(200);
      const party = await loadParty({ tenantId: tenant.id }, partyId);
      expect(party.collaborators).to.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user updates a quote for a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const inventory = await createInventoryProcess();

      const createRes = await request(app).post('/quotes').set(getAuthHeader(tenant.id, primaryUser.id)).send({ inventoryId: inventory.id, partyId });

      expect(createRes.status).to.equal(200);
      const quote = createRes.body;

      const updateRes = await request(app).patch(`/quotes/draft/${quote.id}`).set(getAuthHeader(tenant.id, collaboratorUser.id)).send({
        leaseStartDate: now().toISOString(),
        propertyTimezone: 'America/Los_Angeles',
      });

      expect(updateRes.status).to.equal(200);

      const party = await loadParty({ tenantId: tenant.id }, partyId);

      expect(party.collaborators.sort()).to.deep.equal([primaryUser.id, collaboratorUser.id].sort());
    });
  });

  describe('when a user deletes a quote for a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const inventory = await createAnInventory();
      const amenity = await createAnAmenity({
        id: newId(),
        category: 'inventory',
        propertyId: inventory.propertyId,
      });

      await addAmenityToInventory(ctx, inventory.id, amenity.id);
      const createRes = await request(app).post('/quotes').set(getAuthHeader(tenant.id, primaryUser.id)).send({ inventoryId: inventory.id, partyId });

      expect(createRes.status).to.equal(200);
      const quote = createRes.body;

      const deleteRes = await request(app).delete(`/quotes/${quote.id}`).set(getAuthHeader(tenant.id, collaboratorUser.id));

      expect(deleteRes.status).to.equal(200);

      const party = await loadParty({ tenantId: tenant.id }, partyId);
      expect(party.collaborators.sort()).to.deep.equal([primaryUser.id, collaboratorUser.id].sort());
    });
  });

  describe('when a user adds a party member to a party', () => {
    it('the user is added to the party collaborators list', async () => {
      const member = {
        memberType: DALTypes.MemberType.RESIDENT,
        fullName: 'Luke Skywalker',
      };

      const owner = await createAUser();
      await createATeamMember({ teamId: team1.id, userId: owner.id, roles: { mainRoles: ['LM'] } });

      const party = await createParty(ctx, {
        id: newId(),
        userId: owner.id,
        teams: [team1.id],
        ownerTeam: team1.id,
      });

      const res = await request(app)
        .post(`/parties/${party.id}/members`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, [{ id: team1.id, userId: owner.id, mainRoles: ['LM'] }]))
        .send(member);

      expect(res.status).to.equal(200);

      const { collaborators } = await loadParty({ tenantId: tenant.id }, party.id);
      expect(collaborators).to.deep.include(collaboratorUser.id);
    });
  });
});
