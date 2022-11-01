/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import sortBy from 'lodash/sortBy';
import newId from 'uuid/v4';

import { getAuthHeader } from '../../../testUtils/apiHelper';
import app from '../../api';
import {
  testCtx as ctx,
  createAPerson,
  createAUser,
  createATeam,
  createATeamMember,
  createAParty,
  createAPartyMember,
  createATask,
} from '../../../testUtils/repoHelper';
import { createParty } from '../../../dal/partyRepo';
import '../../../testUtils/setupTestGlobalContext.js';
import { now } from '../../../../common/helpers/moment-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('Application Data Loading', () => {
  describe('API/personDetails', () => {
    const personDetailsDataKeys = ['parties', 'persons', 'members', 'inactiveMembers', 'communications', 'tasks'];

    describe('given a call to personDetails data loading endpoint', () => {
      it('contains all the needed data to succesfully load PersonDetails Page', async () => {
        const person = await createAPerson('Logan', 'Wolverine');
        const res = await request(app).get(`/personDetails/${person.id}`).set(getAuthHeader()).expect(200);
        expect(res.body).to.have.all.keys(personDetailsDataKeys);
      });
    });

    describe('given a call to personDetails data loading endpoint', () => {
      it('should contains all parties associated with the person, including the closed ones', async () => {
        const user = await createAUser({ ctx, name: 'user-1' });
        const person = await createAPerson();
        const party = await createAParty({
          userId: user.id,
          endDate: new Date(),
          workflowState: DALTypes.WorkflowState.CLOSED,
        });
        await createAPartyMember(party.id, { personId: person.id });
        const party2 = await createAParty({ userId: user.id });
        await createAPartyMember(party2.id, { personId: person.id });
        const party3 = await createAParty({ userId: user.id });
        await createAPartyMember(party3.id, { personId: person.id });

        const res = await request(app).get(`/personDetails/${person.id}`).set(getAuthHeader()).expect(200);

        const { parties } = res.body;
        expect(parties.length).to.equal(3);
      });
    });

    describe('given a call to personDetails data loading endpoint', () => {
      it('should contains all parties associated with the person, including the closed and archived ones', async () => {
        const user = await createAUser({ ctx, name: 'user-1' });
        const person = await createAPerson();
        const party = await createAParty({
          userId: user.id,
          endDate: new Date(),
          workflowState: DALTypes.WorkflowState.CLOSED,
        });
        await createAPartyMember(party.id, { personId: person.id });
        const party2 = await createAParty({ userId: user.id });
        await createAPartyMember(party2.id, { personId: person.id });
        const party3 = await createAParty({ userId: user.id });
        await createAPartyMember(party3.id, { personId: person.id });
        const party4 = await createAParty({ userId: user.id });
        await createAPartyMember(party4.id, { personId: person.id, archiveDate: new Date(), workflowState: DALTypes.WorkflowState.ARCHIVED });

        const res = await request(app).get(`/personDetails/${person.id}`).set(getAuthHeader()).expect(200);

        const { parties } = res.body;
        expect(parties.length).to.equal(4);
      });
    });
  });

  describe('API/partyDetails', () => {
    const partyDetailsKeys = [
      'parties',
      'persons',
      'members',
      'otherPartiesApplications',
      'inactiveMembers',
      'tasks',
      'leases',
      'applications',
      'quotePromotions',
      'screeningSummary',
      'usersLastActivity',
      'outCommsProgram',
      'partiesAdditionalInfo',
      'partiesProgram',
      'activeLeaseWorkflowData',
      'seedPartyData',
    ];

    describe('given a call to partyDetails data loading endpoint', () => {
      it('contains all the needed data to succesfully load PartyDetails Page', async () => {
        const party = await createParty(ctx, { id: newId() });

        const res = await request(app).get(`/partyDetails/${party.id}`).set(getAuthHeader()).expect(200);
        expect(res.body).to.have.all.keys(partyDetailsKeys);
      });
    });
  });

  describe('API/dashboard', () => {
    const createRequestDashboard = data => request(app).post('/dashboard').set(getAuthHeader()).send({ acdFilter: data, extraFilter: {} });

    describe('given empty body', () => {
      it('returns 400', async () => {
        await createRequestDashboard({})
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('USERS_AND_TEAMS_NOT_SPECIFIED'));
      });
    });

    describe('given no teams specified', () => {
      it('returns 400', async () => {
        await createRequestDashboard({ users: [newId()] })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('USERS_AND_TEAMS_NOT_SPECIFIED'));
      });
    });

    describe('given a call to the filtered dashboard data loading endpoint', () => {
      it('contains all the needed data to succesfully load the Dashboard', async () => {
        const team = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '15417544217',
        });
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const res = await createRequestDashboard({
          users: [user.id],
          teams: [team.id],
        }).expect(200);
        expect(res.body).to.have.keys(['strongMatchData']);
      });
    });

    describe('given some created parties, when loading dashboard data', () => {
      it('has only the parties for specific users and teams', async () => {
        const u1 = await createAUser({ ctx, name: 'Joe' });
        const u2 = await createAUser({ ctx, name: 'Harry' });
        const u3 = await createAUser({ ctx, name: 'Alan' });

        const p1 = await createParty(ctx, {
          id: newId(),
          userId: u1.id,
          teams: [newId()],
        });
        await createParty(ctx, {
          id: newId(),
          userId: u2.id,
          teams: [newId()],
        });
        const p3 = await createParty(ctx, {
          id: newId(),
          userId: u3.id,
          teams: [newId()],
        });

        const data = {
          users: [u1.id, u3.id],
          teams: [...p1.teams, ...p3.teams],
        };
        const res = await createRequestDashboard(data).expect(200);

        const { laneData: parties, total, today, tomorrow } = res.body.Contact;
        expect(parties).to.be.ok;
        expect(parties.length).to.equal(2);
        expect(total).to.equal('2');
        expect(today).to.equal('0');
        expect(tomorrow).to.equal('0');
        expect(parties.some(p => p.userId === p1.userId)).to.be.true;
        expect(parties.some(p => p.userId === p3.userId)).to.be.true;
      });
    });

    describe('given some created parties, when loading dashboard data', () => {
      it('should return only active parties', async () => {
        const user = await createAUser({ ctx, name: 'user-1' });
        const teamId = newId();
        await createParty(ctx, {
          id: newId(),
          userId: user.id,
          teams: [teamId],
          endDate: new Date(),
          workflowState: DALTypes.WorkflowState.CLOSED,
        });
        const party2 = await createParty(ctx, {
          id: newId(),
          userId: user.id,
          teams: [teamId],
        });
        const party3 = await createParty(ctx, {
          id: newId(),
          userId: user.id,
          teams: [teamId],
        });

        await createParty(ctx, {
          id: newId(),
          userId: user.id,
          teams: [teamId],
          archiveDate: new Date(),
          workflowState: DALTypes.WorkflowState.ARCHIVED,
        });

        const data = {
          users: [user.id],
          teams: [teamId],
        };
        const res = await createRequestDashboard(data).expect(200);

        const { laneData: parties, total, today, tomorrow } = res.body.Contact;
        expect(parties).to.be.ok;
        expect(parties.length).to.equal(2);
        expect(total).to.equal('2');
        expect(today).to.equal('0');
        expect(tomorrow).to.equal('0');

        const sortedParties = sortBy(parties, 'id');
        expect(sortedParties.map(p => p.id)).to.deep.equal([party2.id, party3.id].sort());
      });
    });

    describe('when loading dashboard data', () => {
      it('should return parties owned by other users, but with a task assigned to the selected user', async () => {
        const { id: firstPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-1',
        });
        const { id: secondPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-2',
        });
        const { id: selectedUserId } = await createAUser({
          ctx,
          name: 'user-3',
        });
        const teamId = newId();
        await createParty(ctx, {
          id: newId(),
          userId: firstPartyOwnerId,
          teams: [teamId],
        }); // this should not be returned
        const party2 = await createParty(ctx, {
          id: newId(),
          userId: secondPartyOwnerId,
          teams: [teamId],
        });

        const task = {
          partyId: party2.id,
          userIds: [selectedUserId],
        };
        await createATask(task);

        const data = {
          users: [selectedUserId],
          teams: [teamId],
        };
        const res = await createRequestDashboard(data).expect(200);

        const { laneData: parties } = res.body.Contact;
        expect(parties).to.be.ok;
        expect(parties.length).to.equal(1);
        expect(parties[0].id).to.equal(party2.id);
      });

      describe('when a party has a task for today, but the task is not assigned to the party owner', () => {
        const prepareDataWhenPartyOwnerDifferentThanTaskOwner = async () => {
          const { id: teamId } = await createATeam();
          const { id: partyOwnerId } = await createAUser({ ctx, name: 'user-1' });
          const { id: taskOwnerId } = await createAUser({ ctx, name: 'user-2' });
          await createATeamMember({ teamId, userId: partyOwnerId });
          await createATeamMember({ teamId, userId: taskOwnerId });
          const party = await createParty(ctx, {
            id: newId(),
            userId: partyOwnerId,
            teams: [teamId],
          });

          const task = {
            partyId: party.id,
            userIds: [taskOwnerId],
            dueDate: now().toDate(),
          };
          await createATask(task);

          return {
            teamId,
            partyOwnerId,
            taskOwnerId,
          };
        };

        const parseValue = returnedValue => parseInt(returnedValue, 10);

        it("should show the party in 'Later' section for the owner", async () => {
          const { teamId, partyOwnerId } = await prepareDataWhenPartyOwnerDifferentThanTaskOwner();

          const filterByUser = {
            users: [partyOwnerId],
            teams: [teamId],
          };

          const { status, body } = await createRequestDashboard(filterByUser);
          expect(status).to.equal(200);

          // no of cards in later = total - today - tomorrow
          const prospectColumnData = body.Contact;
          expect(parseValue(prospectColumnData.today)).to.equal(0);
          expect(parseValue(prospectColumnData.tomorrow)).to.equal(0);
          expect(parseValue(prospectColumnData.total)).to.equal(1);
        });

        it("should show the party in 'Today' section for the task owner", async () => {
          const { teamId, partyOwnerId, taskOwnerId } = await prepareDataWhenPartyOwnerDifferentThanTaskOwner();

          const filterByTeam = {
            users: [partyOwnerId, taskOwnerId],
            teams: [teamId],
          };

          const { status, body } = await createRequestDashboard(filterByTeam);
          expect(status).to.equal(200);

          const prospectColumnData = body.Contact;
          expect(parseValue(prospectColumnData.today)).to.equal(1);
          expect(parseValue(prospectColumnData.tomorrow)).to.equal(0);
          expect(parseValue(prospectColumnData.total)).to.equal(1);
        });
      });
    });
  });

  describe('API/dashboard/party', () => {
    describe('when loading dashboard data for a specific party', () => {
      it('should return the party if the selected user is the party owner', async () => {
        const { id: firstPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-1',
        });
        const { id: secondPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-2',
        });
        const teamId = newId();
        await createParty(ctx, {
          id: newId(),
          userId: firstPartyOwnerId,
          teams: [teamId],
        }); // this should not be returned
        const { id: party2Id } = await createParty(ctx, {
          id: newId(),
          userId: secondPartyOwnerId,
          teams: [teamId],
        });

        const data = {
          users: [secondPartyOwnerId],
          teams: [teamId],
        };
        const res = await request(app).post(`/dashboard/party/${party2Id}`).set(getAuthHeader()).send(data).expect(200);

        const { laneData: parties } = res.body.Contact;
        expect(parties).to.be.ok;
        expect(parties.length).to.equal(1);
        expect(parties[0].id).to.equal(party2Id);
      });

      it('should return the party if the selected user is not the owner, but the party has tasks assigned to him', async () => {
        const { id: firstPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-1',
        });
        const { id: secondPartyOwnerId } = await createAUser({
          ctx,
          name: 'user-2',
        });
        const { id: taskOwnerId } = await createAUser({ ctx, name: 'user-3' });
        const teamId = newId();
        await createParty(ctx, {
          id: newId(),
          userId: firstPartyOwnerId,
          teams: [teamId],
        }); // this should not be returned
        const { id: party2Id } = await createParty(ctx, {
          id: newId(),
          userId: secondPartyOwnerId,
          teams: [teamId],
        });

        const task = {
          partyId: party2Id,
          userIds: [taskOwnerId],
        };
        await createATask(task);

        const data = {
          users: [taskOwnerId],
          teams: [teamId],
        };
        const res = await request(app).post(`/dashboard/party/${party2Id}`).set(getAuthHeader()).send(data).expect(200);

        const { laneData: parties } = res.body.Contact;
        expect(parties).to.be.ok;
        expect(parties.length).to.equal(1);
        expect(parties[0].id).to.equal(party2Id);
      });
    });
  });
});
