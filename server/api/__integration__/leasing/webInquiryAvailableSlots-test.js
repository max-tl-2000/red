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
  createAProperty,
  createATeamPropertyProgram,
  createAUserAndTeam,
  createAnAppointment,
  createAParty,
  createTeamEvent,
  createUserEvent as createUserPersonalEvent,
  createATeam,
  createAUser,
  createATeamMember,
  createAvailability,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { generateTokenForDomain } from '../../../services/tenantService';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { now, DATE_ISO_FORMAT, parseAsInTimezone, useFixedDateTimeForMomentUtilsNow } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE, YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { CalendarUserEventType } from '../../../../common/enums/calendarTypes';
import { markEventAsDeleted } from '../../../dal/calendarEventsRepo';

describe('API/guestCard/availableSlots', () => {
  describe('GET', () => {
    const programEmailIdentifier = 'program-email-identifier';

    const createProgram = async (teamId, programPropertyId) =>
      await createATeamPropertyProgram({
        teamId,
        propertyId: programPropertyId,
        directEmailIdentifier: programEmailIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
        onSiteLeasingTeamId: teamId,
      });

    let header;
    let token;
    const nowDateTimeAsISOString = now().toISOString();

    beforeEach(async () => {
      if (!token) {
        token = await generateTokenForDomain({
          tenantId: tenant.id,
          domain: 'testing.reva.tech',
          expiresIn: '1h',
          allowedEndpoints: ['guestCard/availableSlots'],
        });
        header = {
          Authorization: `Bearer ${token}`,
          referer: 'http://testing.reva.tech',
        };
      }
    });

    it('should be a protected route', async () => {
      const res = await request(app).get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&numberOfDays=1`);

      expect(res.status).to.equal(401);
    });

    describe('when from date has invalid format', () => {
      it('responds with status code 400 and INCORRECT_FROM_DATE token', async () => {
        const res = await request(app).get('/guestCard/availableSlots?from=2018_1_12&noOfDays=1').set(header);

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_FROM_DATE');
      });
    });

    describe('when number of days is invalid', () => {
      it('responds with status code 400 and INVALID_NUMBER_OF_DAYS token', async () => {
        const res = await request(app).get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=0`).set(header);

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INVALID_NUMBER_OF_DAYS');
      });
    });

    describe('when program email is missing', () => {
      it('responds with status code 400 and MISSING_PROGRAM_EMAIL token', async () => {
        const res = await request(app).get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=1`).set(header);

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_PROGRAM_EMAIL_OR_SESSION_ID');
      });
    });

    describe('when program email is missing from query, but is present on headers', () => {
      it('responds with status code 200', async () => {
        const newHeader = {
          ...header,
          'x-reva-program-email': programEmailIdentifier,
        };

        const { team } = await createAUserAndTeam();
        const { id: programPropertyId } = await createAProperty();
        await createProgram(team.id, programPropertyId);
        const dateInThePast = '2018-05-08T01:51:57.607Z';

        const res = await request(app).get(`/guestCard/availableSlots?from=${dateInThePast}&noOfDays=3`).set(newHeader);

        expect(res.status).to.equal(200);
      });
    });

    describe('when program email does not exist', () => {
      it('responds with status code 404 and PROGRAM_NOT_FOUND token', async () => {
        const res = await request(app).get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=1&programEmail=wrongProgram`).set(header);

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('PROGRAM_NOT_FOUND');
      });
    });

    describe(`when valid request is made for three days,
    and on the first two days the office is closed and on the third day there is a personal event and an appointment`, () => {
      it('should respond with available slots for three days and related metadata', async () => {
        const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
        const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };

        const { user, team } = await createAUserAndTeam({ userParams, teamParams });

        const { id: programPropertyId, timezone: propertyTimezone } = await createAProperty();
        await createProgram(team.id, programPropertyId);

        const todayMoment = parseAsInTimezone('2020-03-05', { format: DATE_ISO_FORMAT, timezone: propertyTimezone }).startOf('day');
        const todayDatePartOnly = todayMoment.format(DATE_ISO_FORMAT);

        const tomorrowMoment = todayMoment.clone().add(1, 'days');
        const tomorrowDatePartOnly = tomorrowMoment.format(DATE_ISO_FORMAT);

        const dayAfterTomorrowMoment = todayMoment.clone().add(2, 'days');
        const dayAfterTomorrowDateOnly = dayAfterTomorrowMoment.format(DATE_ISO_FORMAT);

        const userPrivateEventTimeMoment = dayAfterTomorrowMoment.clone().startOf('day').add(8, 'h');

        const teamLunchEventTimeMoment = dayAfterTomorrowMoment.clone().startOf('day').add(13, 'h');

        const allDayEventStartMoment = todayMoment.clone();
        const allDayEventEndMoment = allDayEventStartMoment.clone().add(2, 'days');

        await createTeamEvent({
          teamId: team.id,
          startDate: allDayEventStartMoment.toISOString(),
          endDate: allDayEventEndMoment.toISOString(),
        });

        await createTeamEvent({
          teamId: team.id,
          startDate: teamLunchEventTimeMoment.toISOString(),
          endDate: teamLunchEventTimeMoment.clone().add(60, 'minutes').toISOString(),
        });

        await createUserPersonalEvent({
          userId: user.id,
          startDate: userPrivateEventTimeMoment.toISOString(),
          endDate: userPrivateEventTimeMoment.clone().add(60, 'minutes').toISOString(),
        });

        const { id: partyId } = await createAParty();

        const appointmentStartDate = dayAfterTomorrowMoment.clone().startOf('day').add(17, 'h');
        const appointmentEndDate = dayAfterTomorrowMoment.clone().startOf('day').add(18, 'h');

        await createAnAppointment({
          startDate: appointmentStartDate.toISOString(),
          endDate: appointmentEndDate.toISOString(),
          salesPersonId: user.id,
          partyId,
        });

        const numberOfDays = 3;

        const stopMockingNow = useFixedDateTimeForMomentUtilsNow(todayMoment);

        const res = await request(app)
          .get(`/guestCard/availableSlots?from=${todayDatePartOnly}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
          .set({ ...header });

        stopMockingNow();

        expect(res.status).to.equal(200);

        const expectedResponseFormat = {
          propertyTimezone: '',
          calendar: [
            {
              day: '',
              officeClosed: false,
              slots: [],
            },
          ],
        };

        const body = res.body;
        const todayCalendar = body.calendar.find(c => c.day === todayDatePartOnly);
        const tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
        const dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrowDateOnly);

        expect(body).to.have.all.keys(expectedResponseFormat);
        expect(body.calendar.length).to.equal(numberOfDays);
        expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
        expect(body.propertyTimezone).to.equal(propertyTimezone);

        expect(todayCalendar.slots.length).to.equal(0);
        expect(todayCalendar.officeClosed).to.be.true;

        expect(tomorrowCalendar.slots.length).to.equal(0);
        expect(tomorrowCalendar.officeClosed).to.be.true;

        const expectedFreeSlotMoment = userPrivateEventTimeMoment.clone().add(1, 'hours');

        expect(dayAfterTomorrowCalendar.slots.length).to.equal(21);
        expect(dayAfterTomorrowCalendar.slots).to.not.include(userPrivateEventTimeMoment.toISOString());
        expect(dayAfterTomorrowCalendar.slots).to.include(expectedFreeSlotMoment.toISOString());
        expect(dayAfterTomorrowCalendar.slots).to.not.include(appointmentStartDate.toISOString());
        expect(dayAfterTomorrowCalendar.slots).to.not.include(teamLunchEventTimeMoment.toISOString());
        expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;
      });
    });

    describe('when valid request is made and the from date is in the past', () => {
      it('should respond with available slots and from date is considered the current day', async () => {
        const { team } = await createAUserAndTeam();

        const { id: programPropertyId } = await createAProperty();
        await createProgram(team.id, programPropertyId);
        const dateInThePast = parseAsInTimezone('2018-05-08', { format: DATE_ISO_FORMAT }).startOf('day');

        const res = await request(app)
          .get(`/guestCard/availableSlots?from=${dateInThePast.toISOString()}&noOfDays=3&programEmail=${programEmailIdentifier}`)
          .set(header);

        expect(res.status).to.equal(200);

        const { calendar } = res.body;

        expect(calendar.length).to.equal(3);

        const todayMoment = now({ timezone: LA_TIMEZONE }).startOf('day');

        const expectedCalendarDays = [
          todayMoment.format(DATE_ISO_FORMAT),
          todayMoment.clone().add(1, 'day').format(DATE_ISO_FORMAT),
          todayMoment.clone().add(2, 'day').format(DATE_ISO_FORMAT),
        ];

        const calendarDays = calendar.map(item => item.day);
        expect(calendarDays.sort()).to.deep.equal(expectedCalendarDays.sort());
      });
    });

    describe('when valid request is made for three days', () => {
      describe('given three agents in the team, but two are multi team agents', () => {
        describe(`when office is closed on the first day and when agent A and B are not set as available for none of the three days
          and agent C has a personal event on the second day`, () => {
          it('should respond with available slots for three days and related metadata', async () => {
            const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
            const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };

            const team = await createATeam(teamParams);
            const team2 = await createATeam();

            const { id: agentAId } = await createAUser();
            await createATeamMember({ teamId: team.id, userId: agentAId });
            await createATeamMember({ teamId: team2.id, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: team.id, userId: agentBId });
            await createATeamMember({ teamId: team2.id, userId: agentBId });

            const { id: agentCId } = await createAUser(userParams);
            await createATeamMember({ teamId: team.id, userId: agentCId });

            const { id: programPropertyId, timezone: propertyTimezone } = await createAProperty();
            await createProgram(team.id, programPropertyId);

            const todayMoment = now({ timezone: propertyTimezone }).startOf('day');
            const todayDatePartOnly = todayMoment.format(DATE_ISO_FORMAT);

            const tomorrowMoment = todayMoment.clone().add(1, 'days');
            const tomorrowDatePartOnly = tomorrowMoment.format(DATE_ISO_FORMAT);

            const dayAfterTomorrowMoment = todayMoment.clone().add(2, 'days');
            const dayAfterTomorrow = dayAfterTomorrowMoment.format(DATE_ISO_FORMAT);

            const userPrivateEventTimeMoment = tomorrowMoment.clone().add(8, 'h');
            const teamLunchEventTimeMoment = tomorrowMoment.clone().add(13, 'h');

            await createTeamEvent({
              teamId: team.id,
              startDate: teamLunchEventTimeMoment.toISOString(),
              endDate: teamLunchEventTimeMoment.clone().add(60, 'minutes').toISOString(),
            });

            await createUserPersonalEvent({
              userId: agentCId,
              startDate: userPrivateEventTimeMoment.toISOString(),
              endDate: userPrivateEventTimeMoment.clone().add(60, 'minutes').toISOString(),
            });

            await createTeamEvent({
              teamId: team.id,
              startDate: todayMoment.toISOString(),
              endDate: todayMoment.clone().add(1, 'days').toISOString(),
            });

            const numberOfDays = 3;

            const res = await request(app)
              .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
              .set(header);

            expect(res.status).to.equal(200);

            const expectedResponseFormat = {
              propertyTimezone: '',
              calendar: [
                {
                  day: '',
                  officeClosed: false,
                  slots: [],
                },
              ],
            };

            const body = res.body;
            const todayCalendar = body.calendar.find(c => c.day === todayDatePartOnly);
            const tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
            const dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrow);

            expect(body).to.have.all.keys(expectedResponseFormat);
            expect(body.calendar.length).to.equal(numberOfDays);
            expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
            expect(body.propertyTimezone).to.equal(propertyTimezone);

            expect(todayCalendar.slots.length).to.equal(0);
            expect(todayCalendar.officeClosed).to.be.true;

            expect(tomorrowCalendar.slots.length).to.equal(22);
            expect(tomorrowCalendar.officeClosed).to.be.false;
            expect(tomorrowCalendar.slots).to.not.include(userPrivateEventTimeMoment.toISOString());

            const expectedFreeSlotMoment = userPrivateEventTimeMoment.clone().add(1, 'hours');

            expect(tomorrowCalendar.slots).to.include(expectedFreeSlotMoment.toISOString());
            expect(tomorrowCalendar.slots).to.not.include(teamLunchEventTimeMoment.toISOString());

            expect(dayAfterTomorrowCalendar.slots.length).to.equal(24);
            expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;
          });
        });

        describe(`when office is closed on the first day and when agent A is available for the three days
           and agent C has a personal event on the second day and agent A has a appointment on the second day`, () => {
          it('should respond with available slots for three days and related metadata', async () => {
            const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
            const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };
            const team = await createATeam(teamParams);
            const team2 = await createATeam();
            const { id: agentAId } = await createAUser();
            const teamMember1 = await createATeamMember({ teamId: team.id, userId: agentAId });
            await createATeamMember({ teamId: team2.id, userId: agentAId });

            const { id: agentBId } = await createAUser();
            await createATeamMember({ teamId: team.id, userId: agentBId });
            await createATeamMember({ teamId: team2.id, userId: agentBId });

            const { id: agentCId } = await createAUser(userParams);
            await createATeamMember({ teamId: team.id, userId: agentCId });

            const { id: programPropertyId, timezone: propertyTimezone } = await createAProperty();
            await createProgram(team.id, programPropertyId);

            const todayMoment = now({ timezone: propertyTimezone }).startOf('day');
            const todayDatePartOnly = todayMoment.format(DATE_ISO_FORMAT);

            const tomorrowMoment = todayMoment.clone().add(1, 'days');
            const tomorrowDatePartOnly = tomorrowMoment.format(DATE_ISO_FORMAT);

            const dateAfterTomorrowMoment = todayMoment.clone().add(2, 'days');
            const dayAfterTomorrowDatePartOnly = dateAfterTomorrowMoment.format(DATE_ISO_FORMAT);

            const userPrivateEventTime = tomorrowMoment.clone().add(8, 'h');
            const userPrivateEventEndTime = tomorrowMoment.clone().add(9, 'h');
            const teamLunchEventTime = tomorrowMoment.clone().add(13, 'h');

            await createAvailability(teamMember1.id, todayDatePartOnly, agentAId);
            await createAvailability(teamMember1.id, tomorrowDatePartOnly, agentAId);
            await createAvailability(teamMember1.id, dayAfterTomorrowDatePartOnly, agentAId);

            await createTeamEvent({
              teamId: team.id,
              startDate: teamLunchEventTime.toISOString(),
              endDate: teamLunchEventTime.clone().add(60, 'minutes').toISOString(),
            });

            await createUserPersonalEvent({
              userId: agentCId,
              startDate: userPrivateEventTime.toISOString(),
              endDate: userPrivateEventEndTime.toISOString(),
            });

            const allDayEventStartMoment = todayMoment.clone();
            const allDayEventEndMoment = allDayEventStartMoment.clone().add(1, 'days');

            await createTeamEvent({
              teamId: team.id,
              startDate: allDayEventStartMoment.toISOString(),
              endDate: allDayEventEndMoment.toISOString(),
            });
            const { id: partyId } = await createAParty({ userId: agentAId });

            const appointmentStartDateMoment = tomorrowMoment.clone().add(17, 'h');
            const appointmentEndDateMoment = tomorrowMoment.clone().add(18, 'h');

            await createAnAppointment({
              startDate: appointmentStartDateMoment.toISOString(),
              endDate: appointmentEndDateMoment.toISOString(),
              salesPersonId: agentAId,
              partyId,
            });

            const numberOfDays = 3;

            const res = await request(app)
              .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
              .set(header);

            expect(res.status).to.equal(200);

            const expectedResponseFormat = {
              propertyTimezone: '',
              calendar: [
                {
                  day: '',
                  officeClosed: false,
                  slots: [],
                },
              ],
            };

            const body = res.body;
            const todayCalendar = body.calendar.find(c => c.day === todayDatePartOnly);
            const tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
            const dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrowDatePartOnly);

            expect(body).to.have.all.keys(expectedResponseFormat);
            expect(body.calendar.length).to.equal(numberOfDays);
            expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
            expect(body.propertyTimezone).to.equal(propertyTimezone);

            expect(todayCalendar.slots.length).to.equal(0);
            expect(todayCalendar.officeClosed).to.be.true;

            expect(tomorrowCalendar.slots.length).to.equal(23);
            expect(tomorrowCalendar.officeClosed).to.be.false;

            expect(dayAfterTomorrowCalendar.slots.length).to.equal(24);
            expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;

            await createAnAppointment({
              startDate: appointmentStartDateMoment.toISOString(),
              endDate: appointmentEndDateMoment.toISOString(),
              salesPersonId: agentCId,
              partyId,
            });
            await createAnAppointment({
              startDate: userPrivateEventTime.toISOString(),
              endDate: userPrivateEventEndTime.toISOString(),
              salesPersonId: agentAId,
              partyId,
            });

            const res2 = await request(app)
              .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
              .set(header);

            expect(res2.status).to.equal(200);

            const body2 = res2.body;
            const todayCalendar2 = body2.calendar.find(c => c.day === todayDatePartOnly);
            const tomorrowCalendar2 = body2.calendar.find(c => c.day === tomorrowDatePartOnly);
            const dayAfterTomorrowCalendar2 = body2.calendar.find(c => c.day === dayAfterTomorrowDatePartOnly);

            expect(body2).to.have.all.keys(expectedResponseFormat);
            expect(body2.calendar.length).to.equal(numberOfDays);
            expect(todayCalendar2).to.have.all.keys(expectedResponseFormat.calendar[0]);
            expect(body2.propertyTimezone).to.equal(propertyTimezone);

            expect(todayCalendar2.slots.length).to.equal(0);
            expect(todayCalendar2.officeClosed).to.be.true;

            expect(tomorrowCalendar2.slots.length).to.equal(21);
            expect(tomorrowCalendar2.officeClosed).to.be.false;
            expect(tomorrowCalendar2.slots).to.not.include(userPrivateEventTime.toISOString());
            expect(tomorrowCalendar2.slots).to.not.include(appointmentStartDateMoment.toISOString());
            expect(tomorrowCalendar2.slots).to.not.include(teamLunchEventTime.toISOString());

            expect(dayAfterTomorrowCalendar2.slots.length).to.equal(24);
            expect(dayAfterTomorrowCalendar2.officeClosed).to.be.false;
          });
        });

        describe(`when one of the multi team agents is in a residentService team - agent A -
          and agent B is in two leasing teams`, () => {
          it('should respond with available slots for three days and related metadata', async () => {
            // user 1 - resident service team 2 & leasing team team 1
            // user 2 - 2x leasing teams (team 1 and team 3)
            // user 3 - one leasing team (team 3)

            // CASE 1 - user 2 has no availabilities set as a floting agent
            // => when calling slots for team 1 the only user that is valid for the team is user 1

            const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
            const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };

            const team = await createATeam(teamParams);
            const team2 = await createATeam({ module: DALTypes.ModuleType.RESIDENT_SERVICES });
            const team3 = await createATeam();

            const { id: agentAId } = await createAUser(userParams);
            await createATeamMember({ teamId: team.id, userId: agentAId });
            await createATeamMember({ teamId: team2.id, userId: agentAId });

            const { id: agentBId } = await createAUser();
            const tm = await createATeamMember({ teamId: team.id, userId: agentBId });
            await createATeamMember({ teamId: team3.id, userId: agentBId });

            const { id: agentCId } = await createAUser();
            await createATeamMember({ teamId: team3.id, userId: agentCId });

            const { id: programPropertyId, timezone: propertyTimezone } = await createAProperty();
            await createProgram(team.id, programPropertyId);

            const todayMoment = now({ timezone: propertyTimezone }).startOf('day');
            const todayDatePartOnly = todayMoment.format(DATE_ISO_FORMAT);

            const tomorrowMoment = todayMoment.clone().add(1, 'days');
            const tomorrowDatePartOnly = tomorrowMoment.format(DATE_ISO_FORMAT);

            const dayAfterTomorrowMoment = todayMoment.clone().add(2, 'days');
            const dayAfterTomorrow = dayAfterTomorrowMoment.format(DATE_ISO_FORMAT);

            const userPrivateEventTimeMoment = tomorrowMoment.clone().add(8, 'h');
            const teamLunchEventTimeMoment = tomorrowMoment.clone().add(13, 'h');

            await createTeamEvent({
              teamId: team.id,
              startDate: teamLunchEventTimeMoment.toISOString(),
              endDate: teamLunchEventTimeMoment.clone().add(60, 'minutes').toISOString(),
            });

            await createUserPersonalEvent({
              userId: agentAId,
              startDate: userPrivateEventTimeMoment.toISOString(),
              endDate: userPrivateEventTimeMoment.clone().add(60, 'minutes').toISOString(),
            });

            await createTeamEvent({
              teamId: team.id,
              startDate: todayMoment.toISOString(),
              endDate: todayMoment.clone().add(1, 'days').toISOString(),
            });

            const numberOfDays = 3;

            const res = await request(app)
              .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
              .set(header);

            expect(res.status).to.equal(200);

            const expectedResponseFormat = {
              propertyTimezone: '',
              calendar: [
                {
                  day: '',
                  officeClosed: false,
                  slots: [],
                },
              ],
            };

            let body = res.body;
            let todayCalendar = body.calendar.find(c => c.day === todayDatePartOnly);
            let tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
            let dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrow);

            expect(body).to.have.all.keys(expectedResponseFormat);
            expect(body.calendar.length).to.equal(numberOfDays);
            expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
            expect(body.propertyTimezone).to.equal(propertyTimezone);

            expect(todayCalendar.slots.length).to.equal(0);
            expect(todayCalendar.officeClosed).to.be.true;

            expect(tomorrowCalendar.slots.length).to.equal(22);
            expect(tomorrowCalendar.officeClosed).to.be.false;
            expect(tomorrowCalendar.slots).to.not.include(userPrivateEventTimeMoment.toISOString());

            const expectedFreeSlotMoment = userPrivateEventTimeMoment.clone().add(1, 'hours');

            expect(tomorrowCalendar.slots).to.include(expectedFreeSlotMoment.toISOString());
            expect(tomorrowCalendar.slots).to.not.include(teamLunchEventTimeMoment.toISOString());

            expect(dayAfterTomorrowCalendar.slots.length).to.equal(24);
            expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;

            // CASE 2 user 2 is available for team 1 for tomorrow
            await createAvailability(tm.id, tomorrowMoment.format(YEAR_MONTH_DAY_FORMAT), agentBId);
            const res2 = await request(app)
              .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
              .set(header);

            expect(res2.status).to.equal(200);
            body = res2.body;
            todayCalendar = body.calendar.find(c => c.day === todayDatePartOnly);
            tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
            dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrow);

            expect(body).to.have.all.keys(expectedResponseFormat);
            expect(body.calendar.length).to.equal(numberOfDays);
            expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
            expect(body.propertyTimezone).to.equal(propertyTimezone);

            expect(todayCalendar.slots.length).to.equal(0);
            expect(todayCalendar.officeClosed).to.be.true;

            expect(tomorrowCalendar.slots.length).to.equal(23);
            expect(tomorrowCalendar.officeClosed).to.be.false;
            expect(tomorrowCalendar.slots).to.include(userPrivateEventTimeMoment.toISOString());
            expect(tomorrowCalendar.slots).to.not.include(teamLunchEventTimeMoment.toISOString());

            expect(dayAfterTomorrowCalendar.slots.length).to.equal(24);
            expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;
          });
        });
      });
    });

    it('should exclude dispatcher when retrieving available slots', async () => {
      const { id: teamId } = await createATeam();
      const { id: programPropertyId } = await createAProperty();
      await createProgram(teamId, programPropertyId);

      const { id: userId } = await createAUser();

      await createATeamMember({
        teamId,
        userId,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      const { status, body } = await request(app)
        .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=1&programEmail=${programEmailIdentifier}`)
        .set(header);

      expect(status).to.equal(200);
      expect(body.calendar.length).to.equal(1);
      const day = body.calendar[0];
      expect(day.slots).to.be.empty;
    });

    it('should exclude agent with sick leave when retrieving available slots', async () => {
      const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
      const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };
      const team = await createATeam(teamParams);
      // considering a team with 3 agents
      const { id: agentAId } = await createAUser();
      await createATeamMember({ teamId: team.id, userId: agentAId });
      const { id: agentBId } = await createAUser();
      await createATeamMember({ teamId: team.id, userId: agentBId });
      const { id: agentCId } = await createAUser(userParams);
      await createATeamMember({ teamId: team.id, userId: agentCId });

      const { id: programPropertyId, timezone: propertyTimezone } = await createAProperty();
      await createProgram(team.id, programPropertyId);

      const todayStartOfDay = now({ timezone: propertyTimezone }).startOf('day');
      const tomorrowStartOfDay = todayStartOfDay.clone().add(1, 'days');
      const dayAfterTomorrowStartOfDay = todayStartOfDay.clone().add(2, 'days');

      const todayAsDatePartOnly = todayStartOfDay.format(DATE_ISO_FORMAT);
      const tomorrowDatePartOnly = tomorrowStartOfDay.format(DATE_ISO_FORMAT);
      const dayAfterTomorrowDatePartOnly = dayAfterTomorrowStartOfDay.format(DATE_ISO_FORMAT);

      const userPrivateEventTime = tomorrowStartOfDay.clone().add(8, 'h');
      const userPrivateEventEndTime = tomorrowStartOfDay.clone().add(9, 'h');
      const teamLunchEventTime = tomorrowStartOfDay.clone().add(13, 'h');
      // tomorrow has lunch defined for team

      await createTeamEvent({
        teamId: team.id,
        startDate: teamLunchEventTime.toISOString(),
        endDate: teamLunchEventTime.clone().add(60, 'minutes').toISOString(),
      });
      // agent c has a personal event tomorrow at 8
      await createUserPersonalEvent({
        userId: agentCId,
        startDate: userPrivateEventTime.toISOString(),
        endDate: userPrivateEventEndTime.toISOString(),
      });

      const allDayEventStartDate = todayStartOfDay.clone();
      const allDayEventEndDate = todayStartOfDay.clone().add(1, 'days');

      // today should be off for team
      await createTeamEvent({
        teamId: team.id,
        startDate: allDayEventStartDate.toISOString(),
        endDate: allDayEventEndDate.toISOString(),
      });

      const { id: partyId } = await createAParty({ userId: agentAId });

      const appointmentStartDate = tomorrowStartOfDay.clone().add(17, 'h');
      const appointmentEndDate = tomorrowStartOfDay.clone().add(18, 'h');

      await createAnAppointment({
        startDate: appointmentStartDate.toISOString(),
        endDate: appointmentEndDate.toISOString(),
        salesPersonId: agentAId,
        partyId,
      });
      // agent a has an appointment for tomorrow at 5

      const numberOfDays = 3;

      const expectedResponseFormat = {
        propertyTimezone: '',
        calendar: [
          {
            day: '',
            officeClosed: false,
            slots: [],
          },
        ],
      };
      // agent c has an appointment for tomorrow at 5
      await createAnAppointment({
        startDate: appointmentStartDate.toISOString(),
        endDate: appointmentEndDate.toISOString(),
        salesPersonId: agentCId,
        partyId,
      });
      // agent a has a personal event tomorrow at 8
      await createAnAppointment({
        startDate: userPrivateEventTime.toISOString(),
        endDate: userPrivateEventEndTime.toISOString(),
        salesPersonId: agentAId,
        partyId,
      });
      /*
      before sick leave we have the following configuration
      - today - off for all
      - tomorrow - no agents available  between 1 and 2 pm
                 - agent b is available from 8 to 9
                 - agent b is available from 5 to 6
                 - all agents available the rest of the time
      - day after tomorrow everyone is available
      */

      const res2 = await request(app)
        .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
        .set(header);

      expect(res2.status).to.equal(200);

      const body2 = res2.body;
      const todayCalendar2 = body2.calendar.find(c => c.day === todayAsDatePartOnly);
      const tomorrowCalendar2 = body2.calendar.find(c => c.day === tomorrowDatePartOnly);
      const dayAfterTomorrowCalendar2 = body2.calendar.find(c => c.day === dayAfterTomorrowDatePartOnly);

      expect(body2).to.have.all.keys(expectedResponseFormat);
      expect(body2.calendar.length).to.equal(numberOfDays);
      expect(todayCalendar2).to.have.all.keys(expectedResponseFormat.calendar[0]);
      expect(body2.propertyTimezone).to.equal(propertyTimezone);

      expect(todayCalendar2.slots.length).to.equal(0);
      expect(todayCalendar2.officeClosed).to.be.true;

      expect(tomorrowCalendar2.slots.length).to.equal(23);
      expect(tomorrowCalendar2.officeClosed).to.be.false;
      expect(tomorrowCalendar2.slots).to.not.include(teamLunchEventTime.toISOString());

      expect(dayAfterTomorrowCalendar2.slots.length).to.equal(24);
      expect(dayAfterTomorrowCalendar2.officeClosed).to.be.false;
      /*
      adding a sick leave for the agent b for tomorrow
      */
      const tomorrowInTz = tomorrowStartOfDay.clone();
      const sickLeave = await createUserPersonalEvent({
        userId: agentBId,
        startDate: tomorrowInTz.toISOString(),
        endDate: tomorrowInTz.clone().add(1, 'days').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'sick leave added for agent b' },
      });

      const res = await request(app)
        .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
        .set(header);

      expect(res.status).to.equal(200);
      /*
      after sick leave we have the following configuration
      - today - off for all
      - tomorrow - no agents available  between 1 and 2 pm, 8 and 9 pm,  5 and 6 pm
                 - all agents available the rest of the time
      - day after tomorrow everyone is available
      */
      const body = res.body;
      const todayCalendar = body.calendar.find(c => c.day === todayAsDatePartOnly);
      const tomorrowCalendar = body.calendar.find(c => c.day === tomorrowDatePartOnly);
      const dayAfterTomorrowCalendar = body.calendar.find(c => c.day === dayAfterTomorrowDatePartOnly);

      expect(body).to.have.all.keys(expectedResponseFormat);
      expect(body.calendar.length).to.equal(numberOfDays);
      expect(todayCalendar).to.have.all.keys(expectedResponseFormat.calendar[0]);
      expect(body2.propertyTimezone).to.equal(propertyTimezone);

      expect(todayCalendar.slots.length).to.equal(0);
      expect(todayCalendar.officeClosed).to.be.true;

      expect(tomorrowCalendar.slots.length).to.equal(21);
      expect(tomorrowCalendar.officeClosed).to.be.false;
      expect(tomorrowCalendar.slots).to.not.include(teamLunchEventTime.toISOString());
      expect(tomorrowCalendar.slots).to.not.include(userPrivateEventTime.toISOString());
      expect(tomorrowCalendar.slots).to.not.include(appointmentStartDate.toISOString());

      expect(dayAfterTomorrowCalendar.slots.length).to.equal(24);
      expect(dayAfterTomorrowCalendar.officeClosed).to.be.false;

      /*
      removing the sick leave will return the first configutation again
      */

      await markEventAsDeleted(ctx, sickLeave.id, sickLeave.metadata);

      const res3 = await request(app)
        .get(`/guestCard/availableSlots?from=${nowDateTimeAsISOString}&noOfDays=${numberOfDays}&programEmail=${programEmailIdentifier}`)
        .set(header);

      expect(res3.status).to.equal(200);

      const body3 = res3.body;
      const todayCalendar3 = body3.calendar.find(c => c.day === todayAsDatePartOnly);
      const tomorrowCalendar3 = body3.calendar.find(c => c.day === tomorrowDatePartOnly);
      const dayAfterTomorrowCalendar3 = body3.calendar.find(c => c.day === dayAfterTomorrowDatePartOnly);

      expect(body3).to.have.all.keys(expectedResponseFormat);
      expect(body3.calendar.length).to.equal(numberOfDays);
      expect(todayCalendar3).to.have.all.keys(expectedResponseFormat.calendar[0]);
      expect(body3.propertyTimezone).to.equal(propertyTimezone);

      expect(todayCalendar3.slots.length).to.equal(0);
      expect(todayCalendar3.officeClosed).to.be.true;

      expect(tomorrowCalendar3.slots.length).to.equal(23);
      expect(tomorrowCalendar3.officeClosed).to.be.false;
      expect(tomorrowCalendar3.slots).to.not.include(teamLunchEventTime.toISOString());

      expect(dayAfterTomorrowCalendar3.slots.length).to.equal(24);
      expect(dayAfterTomorrowCalendar3.officeClosed).to.be.false;
    });
  });
});
