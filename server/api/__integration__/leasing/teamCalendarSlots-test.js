/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import newId from 'uuid/v4';

import app from '../../api';
import {
  createAParty,
  createAnAppointment,
  createAUserAndTeam,
  createAUser,
  createATeamMember,
  toggleExtCalendarFeature,
  createUserEvent as createUserPersonalEvent,
  createTeamEvent,
} from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';

const expect = chai.expect;

describe('API/teamCalendarSlots', () => {
  const teamViewSlotDuration = 60;
  let party;
  let firstUser;
  let secondUser;
  let team;

  const app1 = {
    startDate: new Date('12-01-2016 16:00:00'),
    endDate: new Date('12-01-2016 16:30:00'),
  };

  const app2 = {
    startDate: new Date('12-01-2016 17:00:00'),
    endDate: new Date('12-01-2016 18:00:00'),
  };

  const app3 = {
    startDate: new Date('12-01-2016 18:30:00'),
    endDate: new Date('12-01-2016 19:00:00'),
  };

  const seedData = async () => {
    const user1Params = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
    const user2Params = { externalCalendars: { calendarAccount: 'user2@reva.tech', primaryCalendarId: newId() } };
    const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };

    const { user: user1, team: firstTeam } = await createAUserAndTeam({ userParams: user1Params, teamParams });
    const user2 = await createAUser(user2Params);
    await createATeamMember({ userId: user2.id, teamId: firstTeam.id });
    firstUser = user1;
    secondUser = user2;
    team = firstTeam;

    party = await createAParty();
    const firstUsersAppointments = [app1, app2].map(appoint => ({
      ...appoint,
      salesPersonId: firstUser.id,
      partyId: party.id,
    }));
    const secondUsersAppointments = [app2, app3].map(appoint => ({
      ...appoint,
      salesPersonId: secondUser.id,
      partyId: party.id,
    }));

    const promises = firstUsersAppointments.concat(secondUsersAppointments).map(appointment => createAnAppointment(appointment));

    await Promise.all(promises);
  };

  afterEach(async () => await toggleExtCalendarFeature(false));

  describe('when loading team calendar slots for a team that is not uuid', () => {
    it('should respond with status code 400 and INCORRECT_TEAM_ID token', async () => {
      await seedData();
      await request(app)
        .get(`/tasks/some-invalid-uuid/2016/12/03/3/${teamViewSlotDuration}/teamCalendarSlots?timezone=ETC/UTC`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_TEAM_ID'));
    });
  });

  describe('when loading team calendar slots for a date that is not valid', () => {
    it('should respond with status code 400 and INCORRECT_DATE token', async () => {
      await seedData();
      await request(app)
        .get(`/tasks/${team.id}/2016/14/14/3/${teamViewSlotDuration}/teamCalendarSlots?timezone=ETC/UTC`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_DATE'));
    });
  });

  describe('when loading calendar slots for a time zone that is not valid', () => {
    it('should respond with status code 400 and INCORRECT_DATE token', async () => {
      await seedData();
      await request(app)
        .get(`/tasks/${team.id}/2016/12/03/3/${teamViewSlotDuration}/teamCalendarSlots?timezone=Invalid/UTC`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_TIMEZONE'));
    });
  });

  describe('when loading calendar slots for three days with valid date, team and 60 minutes slots', () => {
    describe('and external calendar integration is not enabled', () => {
      it('returns the available agents for each slot based on booked appointments', async () => {
        await seedData();
        const res = await request(app).get(`/tasks/${team.id}/2016/12/01/3/${teamViewSlotDuration}/teamCalendarSlots?timezone=ETC/UTC`).set(getAuthHeader());

        expect(res.status).to.equal(200);

        const { body: calendarSlots } = res;
        const firstUserBusySlots = calendarSlots.filter(s => !s.availableAgents.includes(firstUser.id));
        const secondUserBusySlots = calendarSlots.filter(s => !s.availableAgents.includes(secondUser.id));
        const slotsWithNoUserAvailable = calendarSlots.filter(s => s.availableAgents.length === 0);

        expect(firstUserBusySlots.length).to.equal(2);
        expect(secondUserBusySlots.length).to.equal(2);
        expect(slotsWithNoUserAvailable.length).to.equal(1);
      });
    });

    describe('and external calendar integration is enabled', () => {
      it('returns the available agents for each slot based on booked appointments, personal events and team events', async () => {
        await seedData();
        await createTeamEvent({
          teamId: team.id,
          startDate: '2016-12-02T10:00:00Z',
          endDate: '2016-12-02T11:30:00Z',
        });

        await createUserPersonalEvent({
          userId: firstUser.id,
          startDate: '2016-12-01T08:00:00Z',
          endDate: '2016-12-01T09:00:00Z',
        });

        await createUserPersonalEvent({
          userId: secondUser.id,
          startDate: '2016-12-01T18:00:00Z',
          endDate: '2016-12-01T18:30:00Z',
        });

        await createUserPersonalEvent({
          userId: secondUser.id,
          startDate: '2016-12-02T16:00:00Z',
          endDate: '2016-12-02T17:00:00Z',
        });

        const res = await request(app).get(`/tasks/${team.id}/2016/12/01/3/${teamViewSlotDuration}/teamCalendarSlots?timezone=ETC/UTC`).set(getAuthHeader());

        expect(res.status).to.equal(200);

        const numberOfDays = 3;
        const expectedNumOfSlots = (numberOfDays * 24 * 60) / teamViewSlotDuration;

        const { body: calendarSlots } = res;
        const firstUserBusySlots = calendarSlots.filter(s => !s.availableAgents.includes(firstUser.id));
        const secondUserBusySlots = calendarSlots.filter(s => !s.availableAgents.includes(secondUser.id));
        const slotsWithNoUserAvailable = calendarSlots.filter(s => s.availableAgents.length === 0);
        const slotsWithTeamEvents = calendarSlots.filter(s => s.isTeam);

        expect(calendarSlots.length).to.equal(expectedNumOfSlots);

        // 08:00 - 09:00 (2016-12-01) - personal event => 1 busy slot: 08:00 - 09:00
        // 16:00 - 16:30 (2016-12-01) - appointment 1 => 1 busy slot: 16:00 - 17:00
        // 17:00 - 18:00 (2016-12-01) - appointment 2 => 1 busy slot: 17:00 - 18:00
        // 10:00 - 11:30 (2016-12-02) - team event => 2 busy slots: 10:00 - 11:00, 11:00 - 12:00
        expect(firstUserBusySlots.length).to.equal(5);

        // 17:00 - 18:00 (2016-12-01) - appointment 2 => 1 busy slot: 17:00 - 18:00
        // 18:00 - 18:30 (2016-12-01) - personal event 1 => 1 busy slot: 18:00 - 19:00
        // 18:30 - 19:00 (2016-12-01) - appointment 3 => 1 busy slot: 18:00 - 19:00 (same slot as the one for personal event 1)
        // 10:00 - 11:30 (2016-12-02) - team event => 2 busy slots: 10:00 - 11:00, 11:00 - 12:00
        // 16:00 - 17:00 (2016-12-02) - personal event 2 => 1 busy slot: 16:00 - 17:00
        expect(secondUserBusySlots.length).to.equal(5);

        // 17:00 - 18:00 (2016-12-01) - appointment 2 => 1 busy slot: 17:00 - 18:00
        // 10:00 - 11:30 (2016-12-02) - team event => 2 busy slots: 10:00 - 11:00, 11:00 - 12:00
        expect(slotsWithNoUserAvailable.length).to.equal(3);

        // 10:00 - 11:30 (2016-12-02) - team event => 2 busy slots: 10:00 - 11:00, 11:00 - 12:00
        expect(slotsWithTeamEvents.length).to.equal(2);
      });
    });
  });
});
