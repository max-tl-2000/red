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
  createTeamEvent,
  createUserEvent as createUserPersonalEvent,
  createATeam,
  createATeamMember,
  testCtx,
} from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { saveAvailability } from '../../../dal/floatingAgentsRepo';
import { LA_TIMEZONE, YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';

const expect = chai.expect;

describe('API/events', () => {
  let party;
  let firstUser;
  let firstTeam;
  let secondUser;

  const firstUsersAppointments = [
    {
      id: newId(),
      startDate: new Date('12-01-2016 16:30:00'),
      endDate: new Date('12-01-2016 17:30:00'),
    },
    {
      id: newId(),
      startDate: new Date('12-02-2016 16:30:00'),
      endDate: new Date('12-02-2016 17:30:00'),
    },
    {
      id: newId(),
      startDate: new Date('12-03-2016 16:30:00'),
      endDate: new Date('12-03-2016 17:30:00'),
    },
  ];
  const secondUsersAppointments = [
    {
      id: newId(),
      startDate: new Date('12-03-2016 16:30:00'),
      endDate: new Date('12-03-2016 17:30:00'),
    },
  ];

  const seedData = async () => {
    const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
    const teamParams = { externalCalendars: { calendarAccount: 'team1@reva.tech', teamCalendarId: newId() } };
    const { user: user1, team: team1 } = await createAUserAndTeam({ userParams, teamParams });
    firstUser = user1;
    firstTeam = team1;
    const { user: user2 } = await createAUserAndTeam();
    secondUser = user2;

    party = await createAParty();
    firstUsersAppointments.forEach(appointment => {
      appointment.salesPersonId = firstUser.id;
      appointment.partyId = party.id;
    });
    secondUsersAppointments.forEach(appointment => {
      appointment.salesPersonId = secondUser.id;
      appointment.partyId = party.id;
    });

    const promises = firstUsersAppointments.concat(secondUsersAppointments).map(appointment => createAnAppointment(appointment));

    await Promise.all(promises);
  };

  beforeEach(async () => {
    await seedData();
  });

  describe('when loading events for a userId that is not uuid', () => {
    it('should respond with status code 400 and INCORRECT_USER_ID token', async () => {
      await request(app)
        .get(`/tasks/some-invalid-uuid/${firstTeam.id}/2016/12/03/events`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_USER_ID'));
    });
  });

  describe('when loading events for a teamId that is not uuid', () => {
    it('should respond with status code 400 and INCORRECT_USER_ID token', async () => {
      await request(app)
        .get(`/tasks/${firstUser.id}/some-invalid-uuid/2016/12/03/events`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_TEAM_ID'));
    });
  });

  describe('when loading events for a date that is not valid', () => {
    it('should respond with status code 400 and INCORRECT_DATE token', async () => {
      await request(app)
        .get(`/tasks/${firstUser.id}/${firstTeam.id}/2016/14/14/events`)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INCORRECT_DATE'));
    });
  });

  describe('when loading events for a date with valid user and team', () => {
    describe('and external calendar integration is not enabled', () => {
      it('returns only appointments for the given date and user', async () => {
        const res = await request(app).get(`/tasks/${firstUser.id}/${firstTeam.id}/2016/12/03/events`).set(getAuthHeader());

        expect(res.status).to.equal(200);
        expect(res.body.userEvents).to.be.defined;
        expect(res.body.teamEvents).to.be.defined;
        expect(res.body.appointments.length).to.equal(1);
        const [appointment] = res.body.appointments;
        expect(appointment.id).to.equal(firstUsersAppointments[2].id);
        expect(appointment.guests).to.be.defined;
      });
    });

    describe('and external calendar integration is enabled', () => {
      it('returns the appointments and external events for user and team for that day', async () => {
        await createTeamEvent({
          teamId: firstTeam.id,
          startDate: '2016-12-03T14:00:00Z',
          endDate: '2016-12-03T14:00:00Z',
        });

        await createUserPersonalEvent({
          userId: firstUser.id,
          startDate: '2016-12-03T14:00:00Z',
          endDate: '2016-12-03T14:00:00Z',
        });

        const res = await request(app).get(`/tasks/${firstUser.id}/${firstTeam.id}/2016/12/03/events`).set(getAuthHeader());
        expect(res.status).to.equal(200);
        expect(res.body.appointments.length).to.equal(1);
        expect(res.body.userEvents.length).to.equal(1);
        expect(res.body.teamEvents.length).to.equal(1);
      });

      describe('if the floating agent is marked as unavailable for a team', () => {
        it('team events should contain only one event for the entire day', async () => {
          const today = now({ timezone: LA_TIMEZONE }).startOf('day');
          const tomorrow = today.clone().add(1, 'days');
          const inTwoDays = today.clone().add(2, 'days');

          await createTeamEvent({
            teamId: firstTeam.id,
            startDate: tomorrow.clone().add(12, 'hours').toISOString(),
            endDate: tomorrow.clone().add(14, 'hours').toISOString(),
          });

          const { id: teamId2 } = await createATeam();
          const day = tomorrow.format(YEAR_MONTH_DAY_FORMAT);

          const { id: teamMemberId } = await createATeamMember({ teamId: teamId2, userId: firstUser.id });

          await saveAvailability(testCtx, { teamMemberId, day, modifiedBy: firstUser.id });

          const res = await request(app)
            .get(`/tasks/${firstUser.id}/${firstTeam.id}/${tomorrow.format('YYYY')}/${tomorrow.format('M')}/${tomorrow.format('D')}/events?tz=${LA_TIMEZONE}`)
            .set(getAuthHeader());
          const teamEvents = res.body.teamEvents;
          expect(res.status).to.equal(200);
          expect(teamEvents.length).to.equal(1);
          expect(teamEvents[0].isAllDay).to.be.true;
          expect(teamEvents[0].startDate).to.equal(tomorrow.toISOString());
          expect(teamEvents[0].endDate).to.equal(inTwoDays.toISOString());
        });
      });
    });
  });
});
