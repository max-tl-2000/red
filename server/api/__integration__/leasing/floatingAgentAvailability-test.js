/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import app from '../../api';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createAUser, createATeam, createATeamMember, createAvailability, getAvailabilitiesForUsers, testCtx } from '../../../testUtils/repoHelper';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getUsers } from '../../../services/appDataLoaderService';
import { isAgentInMultipleTeams } from '../../../../common/acd/roles';
import { getActiveAgentsFromTeamForSlotDay } from '../../../dal/floatingAgentsRepo';
import { UTC_TIMEZONE, YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/floatingAgents', () => {
  describe('GET', () => {
    let user1;
    let user2;
    let teamMember1;
    let teamMember2;
    let team;

    beforeEach(async () => {
      user1 = await createAUser();
      user2 = await createAUser();
      team = await createATeam();
      teamMember1 = await createATeamMember({ teamId: team.id, userId: user1.id });
      teamMember2 = await createATeamMember({ teamId: team.id, userId: user2.id });
    });

    describe('given invalid user id, when requesting the user availabilities', () => {
      it('has response with status code 400 and INVALID_USER_ID token', async () => {
        await request(app)
          .get('/floatingAgents/availability/some-invalid-uuid/2018-09-20/2018-09-30/')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_USER_ID'));
      });
    });

    describe("when the target user doesn't exist", () => {
      it('responds with status code 404 and USER_NOT_FOUND token', async () => {
        const id = newId();
        await request(app)
          .get(`/floatingAgents/availability/${id}/2018_09_01/2018-09-30/`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'));
      });
    });

    describe('given valid user id, and invalid start date when requesting the user availabilities', () => {
      it('has response with status code 400 and INCORRECT_DATE token', async () => {
        await request(app)
          .get(`/floatingAgents/availability/${user1.id}/2018_09_01/2018-09-30/`)
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_DATE'));
      });
    });

    describe('given valid user id, and invalid end date when requesting the user availabilities', () => {
      it('has response with status code 400 and INCORRECT_DATE token', async () => {
        await request(app)
          .get(`/floatingAgents/availability/${user1.id}/2018-09-20/2018_12_1/`)
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_DATE'));
      });
    });

    describe('given valid user id, and valid period when requesting the user availabilities', () => {
      describe('given a  user with defined availabilities', () => {
        it('returns the valid availabilities for the selected period', async () => {
          await createAvailability(teamMember1.id, '2018-09-01', user1.id);
          await createAvailability(teamMember1.id, '2018-09-02', user1.id);
          await createAvailability(teamMember1.id, '2018-09-03', user1.id);
          await createAvailability(teamMember1.id, '2018-09-04', user1.id);

          const res = await request(app).get(`/floatingAgents/availability/${user1.id}/2018-09-02/2018-09-03/`).set(getAuthHeader()).expect(200);

          expect(Object.keys(res.body)).to.have.length(2);
          expect(res.body).to.deep.equal({ '2018-09-02': team.id, '2018-09-03': team.id });
        });
      });
    });

    describe('given valid user id, and valid period when requesting the user availabilities', () => {
      describe('given two  user with defined availabilities', () => {
        it('returns the valid availabilities for the selected period for the selected user', async () => {
          await createAvailability(teamMember1.id, '2018-09-01', user1.id);
          await createAvailability(teamMember1.id, '2018-09-02', user1.id);
          await createAvailability(teamMember1.id, '2018-09-03', user1.id);
          await createAvailability(teamMember1.id, '2018-09-04', user1.id);
          await createAvailability(teamMember2.id, '2018-09-01', user1.id);
          await createAvailability(teamMember2.id, '2018-09-02', user1.id);
          await createAvailability(teamMember2.id, '2018-09-03', user1.id);

          const res = await request(app).get(`/floatingAgents/availability/${user1.id}/2018-09-02/2018-09-10/`).set(getAuthHeader()).expect(200);

          expect(Object.keys(res.body)).to.have.length(3);
          expect(res.body).to.deep.equal({ '2018-09-02': team.id, '2018-09-03': team.id, '2018-09-04': team.id });

          const res2 = await request(app).get(`/floatingAgents/availability/${user2.id}/2018-09-02/2018-09-10/`).set(getAuthHeader()).expect(200);

          expect(Object.keys(res2.body)).to.have.length(2);
          expect(res2.body).to.deep.equal({ '2018-09-02': team.id, '2018-09-03': team.id });
        });
      });
    });
    describe('when a user is part of 2 teams, but one of them is a resident service team', () => {
      it('should not consider the user as a floating agent for UI selection', async () => {
        // user 1 - resident service & leasing team
        // user 2 - 2x leasing teams
        // user 3 - one leasing team

        const { id: teamId2 } = await createATeam({ module: DALTypes.ModuleType.RESIDENT_SERVICES });
        const { id: teamId3 } = await createATeam();
        await createATeamMember({ teamId: teamId2, userId: user1.id });
        await createATeamMember({ teamId: teamId3, userId: user2.id });
        const user3 = await createAUser();
        await createATeamMember({ teamId: teamId3, userId: user3.id });

        const usersForGlobalStore = await getUsers(testCtx);

        const userDatauser1 = usersForGlobalStore.find(u => u.id === user1.id);
        expect(userDatauser1.teams.length).to.equal(2);

        const userDatauser2 = usersForGlobalStore.find(u => u.id === user2.id);
        expect(userDatauser2.teams.length).to.equal(2);

        const agentsForFloatingAgentsPage = usersForGlobalStore.filter(user => isAgentInMultipleTeams(user));
        expect(agentsForFloatingAgentsPage.length).to.equal(1);
        expect(agentsForFloatingAgentsPage[0].id).to.equal(user2.id);
      });
    });

    describe('when a user is part of 2 teams, but one of them is a resident service team', () => {
      it('should not consider the user as a floating agent when retrieving agents in team', async () => {
        // getActiveAgentsFromTeamForSlotDay function is strictly for checking floating agent availabilities against team membership

        // as well as for suggesting the user for a team calendar event

        // user 1 - resident service team 2 & leasing team team 1
        // user 2 - 2x leasing teams (team 1 and team 3)
        // user 3 - one leasing team (team 3)

        const { id: teamId2 } = await createATeam({ module: DALTypes.ModuleType.RESIDENT_SERVICES });
        const { id: teamId3 } = await createATeam();
        await createATeamMember({ teamId: teamId2, userId: user1.id });
        const tm = await createATeamMember({ teamId: teamId3, userId: user2.id });
        const user3 = await createAUser();
        await createATeamMember({ teamId: teamId3, userId: user3.id });
        const tomorrow = now().startOf('day').add(1, 'days');

        // CASE 1
        // no floating agent availabilities set for user 2 => unavailable in both teams
        // => when requesting availabilities for team 1 => user 1 available
        // => when requesting availabilities for team 2 => user 1 available
        // => when requesting availabilities for team 3 => user 3 available

        let availabilitiesTeam1 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: team.id,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam1.length).to.equal(1);
        expect(availabilitiesTeam1[0]).to.equal(user1.id);

        let availabilitiesTeam2 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: teamId2,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam2.length).to.equal(1);
        expect(availabilitiesTeam2[0]).to.equal(user1.id);

        let availabilitiesTeam3 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: teamId3,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam3.length).to.equal(1);
        expect(availabilitiesTeam3[0]).to.equal(user3.id);

        // CASE 2
        // floating agent availabilities set for user 2 for team 3
        // => when requesting availabilities for team 1 => user 1 available
        // => when requesting availabilities for team 2 => user 1 available
        // => when requesting availabilities for team 3 => user 3 and user 2 available
        await createAvailability(tm.id, tomorrow.format(YEAR_MONTH_DAY_FORMAT), user1.id);

        availabilitiesTeam1 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: team.id,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam1.length).to.equal(1);
        expect(availabilitiesTeam1[0]).to.equal(user1.id);

        availabilitiesTeam2 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: teamId2,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam2.length).to.equal(1);
        expect(availabilitiesTeam2[0]).to.equal(user1.id);

        availabilitiesTeam3 = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId: teamId3,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam3.length).to.equal(2);
        expect(availabilitiesTeam3).to.include(user3.id);
        expect(availabilitiesTeam3).to.include(user2.id);
      });
    });

    describe('when a user is part of an inactive team', () => {
      it('it should not have any active agents for that team', async () => {
        const { id: teamId } = await createATeam({ inactiveFlag: true });
        await createATeamMember({ teamId, userId: user1.id });

        const tomorrow = now().startOf('day').add(1, 'days');
        const availabilitiesTeam = await getActiveAgentsFromTeamForSlotDay(testCtx, {
          teamId,
          slotStartTime: tomorrow.clone().add(8, 'hours'),
          timezone: UTC_TIMEZONE,
        });

        expect(availabilitiesTeam.length).to.equal(0);
      });
    });
  });

  describe('POST', () => {
    let user;
    let team;
    const day = '2018-09-05';

    beforeEach(async () => {
      user = await createAUser();
      team = await createATeam();
    });

    describe('given valid user id, team id and day, when saving the user availabilities', () => {
      it('should return status code 200 and save the user availability', async () => {
        await createATeamMember({ teamId: team.id, userId: user.id });

        const body = {
          day,
          userId: user.id,
          teamId: team.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);

        expect(result.status).to.equal(200);

        const [userAvailability] = await getAvailabilitiesForUsers([user.id], day, day);

        expect(userAvailability.teamId).to.equal(team.id);
        expect(userAvailability.day.toString()).to.equal(toMoment(day).toDate().toString());
      });
    });

    describe('given invalid user id, when saving the user availability', () => {
      it('should return status code 400 and and INVALID_USER_ID token', async () => {
        const invalidUserId = 'some-invalid-user-id';
        const body = {
          day,
          userId: invalidUserId,
          teamId: team.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);

        expect(result.status).to.equal(400);
        expect(result.body.token).to.equal('INVALID_USER_ID');
      });
    });

    describe('given valid user id and invalid team id, when saving the user availability', () => {
      it('should return status code 400 and and INVALID_TEAM_ID token', async () => {
        const invalidTeamId = 'some-invalid-team-id';
        const body = {
          day,
          userId: user.id,
          teamId: invalidTeamId,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);

        expect(result.status).to.equal(400);
        expect(result.body.token).to.equal('INVALID_TEAM_ID');
      });
    });

    describe('given valid user id, team id and an invalid day, when saving the user availability', () => {
      it('should return status code 400 and and INCORRECT_DATE token', async () => {
        const invalidDay = '11-11-11';
        const body = {
          day: invalidDay,
          teamId: team.id,
          userId: user.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);

        expect(result.status).to.equal(400);
        expect(result.body.token).to.equal('INCORRECT_DATE');
      });
    });

    describe('given a valid user who is not in the specified team, when saving the user availability', () => {
      it('should return status code 404 and and TEAM_MEMBER_NOT_FOUND token', async () => {
        const { id: userId2 } = await createAUser();
        await createATeam({ teamId: team.id, userId: userId2 });

        const body = {
          day,
          teamId: team.id,
          userId: user.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);

        expect(result.status).to.equal(404);
        expect(result.body.token).to.equal('TEAM_MEMBER_NOT_FOUND');
      });
    });

    describe('when an unauthenticated user request to save the user availability', () => {
      it('should return status code 403 and and MISSING_AUTHENTICATED_USER token', async () => {
        await createATeamMember({ teamId: team.id, userId: user.id });

        const body = {
          day,
          teamId: team.id,
          userId: user.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader()).send(body);

        expect(result.status).to.equal(403);
        expect(result.body.token).to.equal('MISSING_AUTHENTICATED_USER');
      });
    });

    describe('when user is set as unavailable', () => {
      it('should return status code 200 and delete the existing user availability', async () => {
        await createATeamMember({ teamId: team.id, userId: user.id });

        const body = {
          day,
          userId: user.id,
          isUnavailable: true,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);
        expect(result.status).to.equal(200);

        const [userAvailability] = await getAvailabilitiesForUsers([user.id], day, day);
        expect(userAvailability).to.be.undefined;
      });
    });

    describe('when user is set as available for team1 and the availability is changed for team2 in the same day', () => {
      it('should return status code 200, delete the existing user availability for team1 and save the availability for team2', async () => {
        await createATeamMember({ teamId: team.id, userId: user.id });
        const { id: teamId2 } = await createATeam();

        const { id: teamMemberId2 } = await createATeamMember({ teamId: teamId2, userId: user.id });
        await createAvailability(teamMemberId2, day, user.id);

        const body = {
          day,
          userId: user.id,
          teamId: team.id,
        };

        const result = await request(app).post('/floatingAgents/availability').set(getAuthHeader(tenant.id, user.id)).send(body);
        expect(result.status).to.equal(200);

        const userAvailability = await getAvailabilitiesForUsers([user.id], day, day);

        expect(userAvailability.length).to.equal(1);
        expect(userAvailability[0].teamId).to.equal(team.id);
        expect(userAvailability[0].day.toString()).to.equal(toMoment(day).toDate().toString());
      });
    });
  });
});
