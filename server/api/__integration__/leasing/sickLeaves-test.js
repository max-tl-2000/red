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
import {
  testCtx as ctx,
  toggleExtCalendarFeature,
  createAUser,
  createAnAppointment,
  createUserEvent,
  createAPartyMember,
  createAParty,
} from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { now, DATE_ISO_FORMAT } from '../../../../common/helpers/moment-utils';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';

import { getUserEventsByDateAndType } from '../../../dal/calendarEventsRepo';
import '../../../testUtils/setupTestGlobalContext';
import { CalendarUserEventType } from '../../../../common/enums/calendarTypes';
import { UTC_TIMEZONE } from '../../../../common/date-constants';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/sickLeaves', () => {
  describe('GET', () => {
    let user;
    let appointment1;
    let appointment2;
    let appointment3;
    let appointment4;

    beforeEach(async () => {
      const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', revaCalendarId: newId() } };
      user = await createAUser(userParams);

      const today = now().startOf('day');
      const tomorrow = today.clone().add(1, 'days');
      const inTwoDays = today.clone().add(2, 'days');
      const inThreeDays = today.clone().add(3, 'days');
      const inFourDays = today.clone().add(4, 'days');

      const { id: partyId } = await createAParty({ userId: user.id });

      const { id: pm1Id } = await createAPartyMember(partyId);

      appointment1 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: tomorrow.clone().add(10, 'hours').toISOString(),
        endDate: tomorrow.clone().add(15, 'hours').toISOString(),
      });
      await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: today.clone().add(15, 'hours').toISOString(),
        endDate: today.clone().add(20, 'hours').toISOString(),
      });

      appointment2 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: inThreeDays.clone().add(3, 'hours').toISOString(),
        endDate: inThreeDays.clone().add(5, 'hours').toISOString(),
      });

      appointment3 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: inThreeDays.clone().add(13, 'hours').toISOString(),
        endDate: inThreeDays.clone().add(15, 'hours').toISOString(),
      });

      appointment4 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: inFourDays.clone().add(12, 'hours').toISOString(),
        endDate: inFourDays.clone().add(13, 'hours').toISOString(),
      });

      await toggleExtCalendarFeature(true);

      await createUserEvent({
        userId: user.id,
        startDate: today.clone().add(10, 'hours').toISOString(),
        endDate: today.clone().add(13, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note1' },
      });
      await createUserEvent({
        userId: user.id,
        startDate: tomorrow.clone().add(10, 'hours').toISOString(),
        endDate: tomorrow.clone().add(13, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note2' },
      });

      await createUserEvent({
        userId: user.id,
        startDate: inTwoDays.toISOString(),
        endDate: inFourDays.clone().add(15, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note3' },
      });
    });

    afterEach(async () => await toggleExtCalendarFeature(false));

    describe('given invalid user id, when requesting the user sick leaves', () => {
      it('has response with status code 400 and INVALID_USER_ID token', async () => {
        await request(app)
          .get('/sickLeaves/user/some-invalid-uuid/')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_USER_ID'));
      });
    });

    describe("when the target user doesn't exist", () => {
      it('responds with status code 404 and USER_NOT_FOUND token', async () => {
        const id = newId();
        await request(app)
          .get(`/sickLeaves/user/${id}/`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'));
      });
    });

    describe('given valid user id, when requesting the user sick leaves', () => {
      it('returns the valid sick leaves and conflicts', async () => {
        const res = await request(app).get(`/sickLeaves/user/${user.id}?timezone=${UTC_TIMEZONE}`).set(getAuthHeader()).expect(200);

        expect(res.body).to.have.length(5);

        const startOfDay = now().startOf('day').format(DATE_ISO_FORMAT);
        const events = await getUserEventsByDateAndType(ctx, user.id, startOfDay, CalendarUserEventType.SICK_LEAVE);

        expect(events).to.have.length(3);

        const todayResult = res.body[0];
        expect(todayResult.startHour).to.equal('10:00 am');
        expect(todayResult.endHour).to.equal('01:00 pm');
        expect(todayResult.notes).to.equal('note1');
        expect(todayResult.conflictEvents.length).to.equal(0);
        expect(todayResult.isAllDay).to.be.false;
        const tomorrowResult = res.body[1];
        expect(tomorrowResult.startHour).to.equal('10:00 am');
        expect(tomorrowResult.endHour).to.equal('01:00 pm');
        expect(tomorrowResult.notes).to.equal('note2');
        expect(tomorrowResult.conflictEvents.length).to.equal(1);
        expect(tomorrowResult.conflictEvents[0].id).to.equal(appointment1.id);
        expect(tomorrowResult.isAllDay).to.be.false;
        const in2DaysResult = res.body[2];
        expect(in2DaysResult.startHour).to.equal('12:00 am');
        expect(in2DaysResult.endHour).to.equal('12:00 am');
        expect(in2DaysResult.notes).to.equal('note3');
        expect(in2DaysResult.conflictEvents.length).to.equal(0);
        expect(in2DaysResult.isAllDay).to.be.true;
        const in3DaysResult = res.body[3];
        expect(in3DaysResult.startHour).to.equal('12:00 am');
        expect(in3DaysResult.endHour).to.equal('12:00 am');
        expect(in3DaysResult.notes).to.equal('note3');
        expect(in3DaysResult.conflictEvents.length).to.equal(2);
        expect(in3DaysResult.conflictEvents.find(e => e.id === appointment2.id)).to.not.be.undefined;
        expect(in3DaysResult.conflictEvents.find(e => e.id === appointment3.id)).to.not.be.undefined;
        expect(in3DaysResult.isAllDay).to.be.true;
        const in4DaysResult = res.body[4];
        expect(in4DaysResult.startHour).to.equal('12:00 am');
        expect(in4DaysResult.endHour).to.equal('03:00 pm');
        expect(in4DaysResult.notes).to.equal('note3');
        expect(in4DaysResult.conflictEvents.length).to.equal(1);
        expect(in4DaysResult.conflictEvents[0].id).to.equal(appointment4.id);
        expect(in4DaysResult.isAllDay).to.be.false;
      });
    });
  });

  describe('POST', () => {
    let user;
    let appointment1;
    let appointment3;
    let today;
    let tomorrow;
    let inThreeDays;
    let inTwoDays;

    beforeEach(async () => {
      const revaCalendarId = newId();
      const primaryCalendarId = newId();
      const calendars = [
        {
          calendar_id: primaryCalendarId,
          calendar_name: 'Calendar',
          permission_level: 'unrestricted',
        },
      ];
      const userParams = { externalCalendars: { calendars, calendarAccount: 'user1@reva.tech', revaCalendarId, primaryCalendarId } };
      user = await createAUser(userParams);

      today = now().startOf('day');
      tomorrow = today.clone().add(1, 'days');
      inTwoDays = today.clone().add(2, 'days');
      inThreeDays = today.clone().add(3, 'days');

      const { id: partyId } = await createAParty({ userId: user.id });

      const { id: pm1Id } = await createAPartyMember(partyId);

      appointment1 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: tomorrow.clone().add(10, 'hours').toISOString(),
        endDate: tomorrow.clone().add(15, 'hours').toISOString(),
      });
      await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: today.clone().add(15, 'hours').toISOString(),
        endDate: today.clone().add(20, 'hours').toISOString(),
      });

      await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: inThreeDays.clone().add(3, 'hours').toISOString(),
        endDate: inThreeDays.clone().add(5, 'hours').toISOString(),
      });

      appointment3 = await createAnAppointment({
        partyId,
        partyMembers: [pm1Id],
        properties: [],
        note: 'test appointment1',
        salesPersonId: user.id,
        startDate: inTwoDays.clone().add(13, 'hours').toISOString(),
        endDate: inTwoDays.clone().add(15, 'hours').toISOString(),
      });

      await toggleExtCalendarFeature(true);
    });

    const getPayload = (startDate, endDate, userId, timezone = 'America/Denver') => ({
      startDate,
      endDate,
      userId,
      notes: 'Default notes',
      timezone,
    });

    afterEach(async () => await toggleExtCalendarFeature(false));

    describe('given invalid user id, when adding a sick leave', () => {
      it('has response with status code 400 and INVALID_USER_ID token', async () => {
        await request(app)
          .post('/sickLeaves')
          .set(getAuthHeader())
          .send(getPayload(tomorrow.toISOString(), inTwoDays.toISOString(), 'some-invalid-uuid'))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_USER_ID'));
      });
    });

    describe("when the target user doesn't exist", () => {
      it('responds with status code 404 and USER_NOT_FOUND token', async () => {
        const id = newId();

        await request(app)
          .post('/sickLeaves')
          .set(getAuthHeader())
          .send(getPayload(tomorrow.toISOString(), inTwoDays.toISOString(), id))
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'));
      });
    });

    describe('given valid user id, when adding a sick leave for a user', () => {
      it.skip('returns the added sick leaves split by days and conflicts', async () => {
        // skipped for now because of DST time
        const createEvent = sinon.spy();
        setCalendarOps({ createEvent });

        const res = await request(app)
          .post('/sickLeaves')
          .set(getAuthHeader())
          .send(getPayload(tomorrow.toISOString(), inThreeDays.toISOString(), user.id))
          .expect(200);

        expect(res.body).to.have.length(3);
        const events = await getUserEventsByDateAndType(ctx, user.id, today.toISOString(), CalendarUserEventType.SICK_LEAVE);

        expect(events).to.have.length(1);

        expect(createEvent).to.have.been.calledOnce;
        // since denver is (GMT-7) that means
        // start date for our event is tomorrow at start of day in utc => (GMT-7) that means today at 5 pm in denver time
        // end date for our event is in 2 days at start of day in utc => (GMT-7) that means in 2 days  at 5 pm in denver time
        // since the requirements say that we need to split this event into calendaristic days for the timezone it was added to
        // => we will have 3 events -> one for today from 5pm to midnight in (GMT-7) and one from midnight to 5p.m in 2 days, and one full day event for tomorrow
        const eventKeys = ['id', 'day', 'dayOfWeek', 'isAllDay', 'startDate', 'startHour', 'endHour', 'notes', 'conflictEvents'];

        const day1 = res.body[0];
        const day2 = res.body[1];
        const day3 = res.body[2];

        expect(day1).to.have.all.keys(eventKeys);
        expect(day2).to.have.all.keys(eventKeys);
        expect(day3).to.have.all.keys(eventKeys);

        expect(day1.startHour).to.equal('05:00 pm');
        expect(day1.endHour).to.equal('12:00 am');
        expect(day1.notes).to.equal('Default notes');
        expect(day1.conflictEvents.length).to.equal(0);
        expect(day1.isAllDay).to.be.false;

        expect(day2.startHour).to.equal('12:00 am');
        expect(day2.endHour).to.equal('12:00 am');
        expect(day2.notes).to.equal('Default notes');
        expect(day2.conflictEvents.length).to.equal(1);
        expect(day2.isAllDay).to.be.true;
        const conflictEventDay2 = day2.conflictEvents[0];
        expect(conflictEventDay2.id).to.equal(appointment1.id);

        expect(day3.endHour).to.equal('05:00 pm');
        expect(day3.startHour).to.equal('12:00 am');
        expect(day3.notes).to.equal('Default notes');
        expect(day3.conflictEvents.length).to.equal(1);
        expect(day3.isAllDay).to.be.false;
        const conflictEventDay3 = day3.conflictEvents[0];
        expect(conflictEventDay3.id).to.equal(appointment3.id);
      });
    });

    describe('given valid user id, when adding a one day sick leave for a user', () => {
      it('returns one day sick leave with conflict information', async () => {
        const createEvent = sinon.spy();
        setCalendarOps({ createEvent });

        const res = await request(app)
          .post('/sickLeaves')
          .set(getAuthHeader())
          .send(getPayload(tomorrow.toISOString(), inTwoDays.toISOString(), user.id, UTC_TIMEZONE))
          .expect(200);

        expect(res.body).to.have.length(1);
        const events = await getUserEventsByDateAndType(ctx, user.id, today.toISOString(), CalendarUserEventType.SICK_LEAVE);

        expect(events).to.have.length(1);

        expect(createEvent).to.have.been.calledOnce;
        // start date for our event is tomorrow at start of day in utc
        // end date for our event is in 2 days at start of day in utc
        // since the requirements say that we need to split this event into calendaristic days for the timezone it was added to
        // => we will have 1 event -> one all day event for tomorrow
        const eventKeys = ['id', 'day', 'dayOfWeek', 'isAllDay', 'startDate', 'startHour', 'endHour', 'notes', 'conflictEvents'];

        const day1 = res.body[0];

        expect(day1).to.have.all.keys(eventKeys);

        expect(day1.startHour).to.equal('12:00 am');
        expect(day1.endHour).to.equal('12:00 am');
        expect(day1.notes).to.equal('Default notes');
        expect(day1.conflictEvents.length).to.equal(1);
        expect(day1.isAllDay).to.be.true;
        const conflictEvent = day1.conflictEvents[0];
        expect(conflictEvent.id).to.equal(appointment1.id);
      });
    });
  });

  describe('PATCH', () => {
    let user;
    let sickLeave;
    let today;

    beforeEach(async () => {
      const revaCalendarId = newId();
      const primaryCalendarId = newId();
      const calendars = [
        {
          calendar_id: primaryCalendarId,
          calendar_name: 'Calendar',
          permission_level: 'unrestricted',
        },
      ];
      const userParams = { externalCalendars: { calendars, calendarAccount: 'user1@reva.tech', revaCalendarId, primaryCalendarId } };
      user = await createAUser(userParams);

      today = now().startOf('day');
      const tomorrow = today.clone().add(1, 'days');
      const inTwoDays = today.clone().add(2, 'days');
      const inFourDays = today.clone().add(4, 'days');

      await toggleExtCalendarFeature(true);

      await createUserEvent({
        userId: user.id,
        startDate: today.clone().add(10, 'hours').toISOString(),
        endDate: today.clone().add(13, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note1' },
      });
      sickLeave = await createUserEvent({
        userId: user.id,
        startDate: tomorrow.clone().add(10, 'hours').toISOString(),
        endDate: tomorrow.clone().add(13, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note2' },
      });

      await createUserEvent({
        userId: user.id,
        startDate: inTwoDays.toISOString(),
        endDate: inFourDays.clone().add(15, 'hours').toISOString(),
        metadata: { type: CalendarUserEventType.SICK_LEAVE, notes: 'note3' },
      });
    });

    afterEach(async () => await toggleExtCalendarFeature(false));

    describe('given invalid sick leave id, when trying to remove a sick leave', () => {
      it('has response with status code 400 and INVALID_SICK_LEAVE_ID token', async () => {
        await request(app)
          .patch('/sickLeaves/some-invalid-uuid/')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_SICK_LEAVE_ID'));
      });
    });

    describe("when the target sick leave doesn't exist", () => {
      it('responds with status code 404 and SICK_LEAVE_NOT_FOUND token', async () => {
        const id = newId();
        await request(app)
          .patch(`/sickLeaves/${id}/`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('SICK_LEAVE_NOT_FOUND'));
      });
    });

    describe('given valid sick leave id, when removing the sick leave', () => {
      it('returns 202 and the sick leave is marked as deleted', async () => {
        const eventsBefore = await getUserEventsByDateAndType(ctx, user.id, today.toISOString(), CalendarUserEventType.SICK_LEAVE);
        expect(eventsBefore).to.have.length(3);

        await request(app).patch(`/sickLeaves/${sickLeave.id}`).set(getAuthHeader()).expect(200);
        const removeEvent = sinon.spy();
        setCalendarOps({ removeEvent });

        const events = await getUserEventsByDateAndType(ctx, user.id, today.toISOString(), CalendarUserEventType.SICK_LEAVE);

        expect(events).to.have.length(2);
        const deletedEvents = eventsBefore.filter(eb => !events.map(e => e.id).includes(eb.id));
        expect(deletedEvents).to.have.length(1);
        const deletedEvent = deletedEvents[0];
        expect(deletedEvent.id).to.equal(sickLeave.id);
      });
    });

    describe('given valid sick leave id, after removing the sick leave and sick leaves are retrieved', () => {
      it('returns the sick leaves without the deleted one', async () => {
        const res1 = await request(app).get(`/sickLeaves/user/${user.id}?timezone=${UTC_TIMEZONE}`).set(getAuthHeader()).expect(200);

        expect(res1.body).to.have.length(5);

        const startOfDay = now().startOf('day').format(DATE_ISO_FORMAT);
        const events1 = await getUserEventsByDateAndType(ctx, user.id, startOfDay, CalendarUserEventType.SICK_LEAVE);

        expect(events1).to.have.length(3);

        await request(app).patch(`/sickLeaves/${sickLeave.id}`).set(getAuthHeader()).expect(200);
        const removeEvent = sinon.spy();
        setCalendarOps({ removeEvent });

        const res2 = await request(app).get(`/sickLeaves/user/${user.id}?timezone=${UTC_TIMEZONE}`).set(getAuthHeader()).expect(200);

        expect(res2.body).to.have.length(4);

        const events2 = await getUserEventsByDateAndType(ctx, user.id, startOfDay, CalendarUserEventType.SICK_LEAVE);

        expect(events2).to.have.length(2);

        const deletedEvents = events1.filter(eb => !events2.map(e => e.id).includes(eb.id));
        expect(deletedEvents).to.have.length(1);

        const deletedEvent = deletedEvents[0];
        expect(deletedEvent).to.not.be.undefined;
        expect(deletedEvent.id).to.equal(sickLeave.id);
      });
    });
  });
});
