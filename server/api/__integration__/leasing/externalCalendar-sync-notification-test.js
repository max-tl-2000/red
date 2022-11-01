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
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';
import {
  testCtx,
  createAUser,
  createAParty,
  createAPartyMember,
  createAnAppointment,
  toggleExtCalendarFeature,
  createAUserAndTeam,
} from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { getAllUserEvents, saveUserEvent, getAllTeamEvents, saveTeamEvent } from '../../../dal/calendarEventsRepo';
import { getRecurringJobByName, updateRecurringJob } from '../../../dal/jobsRepo';
import config from '../../../config';
import { toMoment, now, DATE_ISO_FORMAT } from '../../../../common/helpers/moment-utils';
import { UTC_TIMEZONE, LA_TIMEZONE } from '../../../../common/date-constants';
import { CalendarUserEventType } from '../../../../common/enums/calendarTypes';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getExternalCalendarEventDescription, getCalendarSummary } from '../../../services/externalCalendars/cronofyServiceHelper';
import { setGetShortId } from '../../../services/urlShortener';
import { getDateRangeForSync, NUMBER_OF_DAYS_SYNC, TIMEZONE_SYNC as TIMEZONE } from '../../../services/helpers/calendarHelpers';

chai.use(sinonChai);
const expect = chai.expect;

describe('external calendars webhooks', () => {
  const toMomentUTC = date => toMoment(date, { timezone: UTC_TIMEZONE });
  const changeDate = now({ timezone: TIMEZONE }).add(-1, 'days').format(DATE_ISO_FORMAT);

  const notification = {
    type: 'change',
    changes_since: toMomentUTC(changeDate).format(),
  };

  const setLastRunAtForSyncJob = async lastJobRunDateUtc => {
    const { id } = await getRecurringJobByName(testCtx, DALTypes.Jobs.SyncExternalCalendarEvents);
    await updateRecurringJob(testCtx, id, { lastRunAt: lastJobRunDateUtc });
  };

  const condition = msg => msg.notificationData.type === notification.type && msg.notificationData.changes_since === notification.changes_since;

  beforeEach(async () => await toggleExtCalendarFeature(true));
  afterEach(async () => await toggleExtCalendarFeature(false));

  describe('/webhooks/userPersonalCalendarEventUpdated', () => {
    const userPersonalCalendarNotificationUrl = `/webhooks/userPersonalCalendarEventUpdated?api-token=${config.tokens.api}`;

    const personalEvent = {
      start: '2018-09-06T08:00:00Z',
      end: '2018-09-06T08:30:00Z',
      event_uid: 'user=personal-event-uid',
      free_busy_status: 'busy',
    };

    describe('when the notification type is different than "change"', () => {
      it('should ignore the notification', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam();

        const getEvents = sinon.spy(() => ({ pages: {}, events: [personalEvent] }));
        setCalendarOps({ getEvents });

        const notificationToBeIgnored = { type: 'verification' };

        const conditionToMatch = msg => msg.notificationData.type === notificationToBeIgnored.type;

        const { task } = await setupQueueToWaitFor([conditionToMatch], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification: notificationToBeIgnored })
          .expect(200);

        await task;

        expect(getEvents).to.not.have.been.called;
      });
    });

    describe('when the event does not exists in UserCalendarEvents table', () => {
      it('should save the event to UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [personalEvent] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(1);
        const { startDate, endDate, metadata } = userEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(personalEvent.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(personalEvent.end))).to.equal(true);
        expect(metadata.type).to.equal(CalendarUserEventType.PERSONAL);
        expect(metadata.id).to.equal(personalEvent.event_uid);
      });
    });

    describe('when the event does not exists in UserCalendarEvents table, but has no duration', () => {
      it('should not be saved in UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam();

        const noDurationEvent = { ...personalEvent, end: personalEvent.start };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [noDurationEvent] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(0);
      });
    });

    describe('when the event already exists, but the dates are not the same', () => {
      it('should update the event in UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [personalEvent] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          userId,
          startDate: '2014-09-06T09:00:00Z',
          endDate: '2014-09-06T09:30:00Z',
          metadata: {
            type: CalendarUserEventType.PERSONAL,
            id: personalEvent.event_uid,
          },
        };
        await saveUserEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(1);
        const { startDate, endDate, metadata } = userEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(personalEvent.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(personalEvent.end))).to.equal(true);
        expect(metadata.type).to.equal(CalendarUserEventType.PERSONAL);
        expect(metadata.id).to.equal(personalEvent.event_uid);
      });
    });

    describe('when the event already exists, but it was marked as deleted in the external calendar', () => {
      it('should remove it from UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const deletedEvent = { ...personalEvent, deleted: true };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [deletedEvent] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          userId,
          startDate: personalEvent.start,
          endDate: personalEvent.end,
          metadata: {
            type: CalendarUserEventType.PERSONAL,
            id: personalEvent.event_uid,
          },
        };
        await saveUserEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(0);
      });
    });

    describe('when the sick leave already exists, but the dates are not the same', () => {
      it('should update the sick leave in UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const tomorrow = now().startOf('day').add(1, 'days');

        const sickLeave = {
          userId,
          startDate: tomorrow.clone().add(8, 'hours').toISOString(),
          endDate: tomorrow.clone().add(12, 'hours').toISOString(),
          metadata: {
            type: CalendarUserEventType.SICK_LEAVE,
          },
        };

        const resSickLeave = await saveUserEvent({ tenantId: tenant.id }, sickLeave);

        const baseSickLeave = {
          start: tomorrow.clone().add(7, 'hours').toISOString(),
          end: tomorrow.clone().add(10, 'hours').toISOString(),
          event_id: resSickLeave.id,
          free_busy_status: 'busy',
        };

        const getEvents = sinon.spy(() => ({ pages: {}, events: [baseSickLeave] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(1);
        const { startDate, endDate, metadata } = userEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(baseSickLeave.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(baseSickLeave.end))).to.equal(true);
        expect(metadata.type).to.equal(CalendarUserEventType.SICK_LEAVE);
        expect(metadata.id).to.equal(baseSickLeave.event_id);
      });
    });

    describe('when the sick leave exists already, but it was marked as deleted in the external calendar', () => {
      it('should mark it as removed in the UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const tomorrow = now().startOf('day').add(1, 'days');

        const sickLeave = {
          userId,
          startDate: tomorrow.clone().add(7, 'hours').toISOString(),
          endDate: tomorrow.clone().add(10, 'hours').toISOString(),
          metadata: {
            type: CalendarUserEventType.SICK_LEAVE,
          },
        };

        const resSickLeave = await saveUserEvent({ tenantId: tenant.id }, sickLeave);

        const baseSickLeave = {
          start: tomorrow.clone().add(7, 'hours').toISOString(),
          end: tomorrow.clone().add(10, 'hours').toISOString(),
          event_id: resSickLeave.id,
          free_busy_status: 'busy',
          deleted: true,
        };

        const getEvents = sinon.spy(() => ({ pages: {}, events: [baseSickLeave] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId, true);
        expect(userEvents.length).to.equal(1);
        const { startDate, endDate, metadata, isDeleted } = userEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(baseSickLeave.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(baseSickLeave.end))).to.equal(true);
        expect(isDeleted).to.be.true;
        expect(metadata.type).to.equal(CalendarUserEventType.SICK_LEAVE);
        expect(metadata.id).to.equal(baseSickLeave.event_id);
      });
    });

    describe('when the event already exists, but has no duration now in the external calendar', () => {
      it('should remove it from UserCalendarEvents table', async () => {
        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams: { externalCalendars: { primaryCalendarId: newId(), revaCalendarId: newId() } } });

        const noDurationEvent = { ...personalEvent, end: personalEvent.start };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [noDurationEvent] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          userId,
          startDate: personalEvent.start,
          endDate: personalEvent.end,
          metadata: {
            type: CalendarUserEventType.PERSONAL,
            id: personalEvent.event_uid,
          },
        };
        await saveUserEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification })
          .expect(200);

        await task;

        const userEvents = await getAllUserEvents({ tenantId: tenant.id }, userId);
        expect(userEvents.length).to.equal(0);
      });
    });

    describe('when there are two pages of events', () => {
      it('should call getEvents two times', async () => {
        const primaryCalendarId = newId();
        const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId, access_token: 'EwW4L3QcDCnxSBqwNggSys7SdPaq5abc' } };

        await setLastRunAtForSyncJob('2018-09-06T00:00:00Z');
        const notificationData = { type: 'change', changes_since: '2018-09-08T00:00:00Z' };

        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams });

        let currentPageNo = 0;
        const totalPageNo = 2;
        const nextPageUrl = 'next-page-url';

        const getEvents = sinon.spy(() => {
          currentPageNo++;
          const pageUrl = currentPageNo !== totalPageNo ? nextPageUrl : '';
          return { pages: { current: currentPageNo, total: totalPageNo, next_page: pageUrl }, events: [personalEvent] };
        });

        setCalendarOps({ getEvents });

        const existingEvent = {
          userId,
          startDate: personalEvent.start,
          endDate: personalEvent.end,
          metadata: {
            type: CalendarUserEventType.PERSONAL,
            id: personalEvent.event_uid,
          },
        };
        await saveUserEvent({ tenantId: tenant.id }, existingEvent);

        const msgCondition = msg =>
          msg.notificationData.type === notificationData.type && msg.notificationData.changes_since === notificationData.changes_since;

        const { task } = await setupQueueToWaitFor([msgCondition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification: notificationData })
          .expect(200);

        await task;

        const { from, to } = getDateRangeForSync(notificationData.changes_since, NUMBER_OF_DAYS_SYNC);

        const getEventsParams = {
          calendar_ids: [primaryCalendarId],
          from,
          to,
          last_modified: notificationData.changes_since,
          include_managed: true,
          include_deleted: true,
          include_free: true,
          accessToken: userParams.externalCalendars.access_token,
        };

        expect(getEvents).to.have.been.called.twice;
        // check the arguments for the first call
        expect(getEvents).to.have.been.calledWith(getEventsParams);
        // check the arguments for the second call
        expect(getEvents).to.have.been.calledWith({ next_page: nextPageUrl, accessToken: userParams.externalCalendars.access_token });
      });
    });

    describe('when the notification date is older than last run of external calendar sync', () => {
      it('should be used last sync date', async () => {
        const primaryCalendarId = newId();
        const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId, access_token: 'EwW4L3QcDCnxSBqwNggSys7SdPaq5abc' } };

        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [personalEvent] }));
        setCalendarOps({ getEvents });
        const lastJobRunDate = '2018-09-06T00:00:00Z';
        await setLastRunAtForSyncJob(lastJobRunDate);
        const notificationWithOldDate = { type: 'change', changes_since: '2018-09-04T00:00:00Z' };

        const msgCondition = msg =>
          msg.notificationData.type === notificationWithOldDate.type && msg.notificationData.changes_since === notificationWithOldDate.changes_since;

        const { task } = await setupQueueToWaitFor([msgCondition], ['externalCalendars']);

        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification: notificationWithOldDate })
          .expect(200);

        await task;

        const { from, to } = getDateRangeForSync(lastJobRunDate, NUMBER_OF_DAYS_SYNC);
        const getEventsArguments = {
          accessToken: userParams.externalCalendars.access_token,
          calendar_ids: [primaryCalendarId],
          include_deleted: true,
          include_free: true,
          include_managed: true,
          last_modified: from,
          from,
          to,
        };

        expect(getEvents).to.have.been.calledOnce;
        expect(getEvents).to.have.been.calledWith(getEventsArguments);
      });
    });
    describe('when the notification date is newer than last run of external calendar sync', () => {
      it('should be used the notification date', async () => {
        const primaryCalendarId = newId();
        const userParams = {
          externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId, access_token: 'EwW4L3QcDCnxSBqwNggSys7SdPaq5abc' },
        };

        const {
          user: { id: userId },
        } = await createAUserAndTeam({ userParams });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [personalEvent] }));
        setCalendarOps({ getEvents });

        await setLastRunAtForSyncJob('2018-09-06T00:00:00Z');
        const notificationData = { type: 'change', changes_since: '2018-09-08T00:00:00Z' };

        const msgCondition = msg =>
          msg.notificationData.type === notificationData.type && msg.notificationData.changes_since === notificationData.changes_since;

        const { task } = await setupQueueToWaitFor([msgCondition], ['externalCalendars']);
        await request(app)
          .post(`${userPersonalCalendarNotificationUrl}&userId=${userId}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ notification: notificationData })
          .expect(200);

        await task;

        const { from: fromForNewerEvent, to: toForNewerEvent } = getDateRangeForSync(notificationData.changes_since, NUMBER_OF_DAYS_SYNC);
        const getEventsArgumentsForNewerEvent = {
          accessToken: userParams.externalCalendars.access_token,
          calendar_ids: [primaryCalendarId],
          include_deleted: true,
          include_free: true,
          include_managed: true,
          last_modified: fromForNewerEvent,
          from: fromForNewerEvent,
          to: toForNewerEvent,
        };

        expect(getEvents).to.have.been.calledOnce;
        expect(getEvents).to.have.been.calledWith(getEventsArgumentsForNewerEvent);
      });
    });
  });

  describe('/webhooks/teamCalendarEventUpdated', () => {
    const teamCalendarNotificationUrl = `/webhooks/teamCalendarEventUpdated?api-token=${config.tokens.api}`;

    const teamEvent = {
      start: '2018-09-06T10:00:00Z',
      end: '2018-09-06T10:30:00Z',
      event_uid: 'team-event-uid',
      free_busy_status: 'busy',
    };

    describe('when the event does not exists in TeamCalendarEvents table', () => {
      it('should save the event to TeamCalendarEvents table', async () => {
        const {
          user: { id: userId },
          team: { id: teamId },
        } = await createAUserAndTeam({ teamParams: { externalCalendars: { teamCalendarId: newId() } } });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [teamEvent] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app).post(`${teamCalendarNotificationUrl}&teamId=${teamId}`).set(getAuthHeader(tenant.id, userId)).send({ notification }).expect(200);

        await task;

        const teamEvents = await getAllTeamEvents({ tenantId: tenant.id }, teamId);
        expect(teamEvents.length).to.equal(1);
        const { startDate, endDate, externalId } = teamEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(teamEvent.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(teamEvent.end))).to.equal(true);
        expect(externalId).to.equal(teamEvent.event_uid);
      });
    });

    describe('when the event does not exists in TeamCalendarEvents table, but has no duration', () => {
      it('should not save the event in TeamCalendarEvents table', async () => {
        const {
          user: { id: userId },
          team: { id: teamId },
        } = await createAUserAndTeam({ teamParams: { externalCalendars: { teamCalendarId: newId() } } });

        const eventWithNoDuration = { ...teamEvent, end: teamEvent.start };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [eventWithNoDuration] }));
        setCalendarOps({ getEvents });

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app).post(`${teamCalendarNotificationUrl}&teamId=${teamId}`).set(getAuthHeader(tenant.id, userId)).send({ notification }).expect(200);

        await task;

        const teamEvents = await getAllTeamEvents({ tenantId: tenant.id }, teamId);
        expect(teamEvents.length).to.equal(0);
      });
    });

    describe('when the event already exists, but the dates are not the same', () => {
      it('should update the event in TeamCalendarEvents table', async () => {
        const {
          user: { id: userId },
          team: { id: teamId },
        } = await createAUserAndTeam({ teamParams: { externalCalendars: { teamCalendarId: newId() } } });

        const getEvents = sinon.spy(() => ({ pages: {}, events: [teamEvent] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          teamId,
          startDate: '2014-09-06T09:00:00Z',
          endDate: '2014-09-06T09:30:00Z',
          externalId: teamEvent.event_uid,
        };
        await saveTeamEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app).post(`${teamCalendarNotificationUrl}&teamId=${teamId}`).set(getAuthHeader(tenant.id, userId)).send({ notification }).expect(200);

        await task;

        const teamEvents = await getAllTeamEvents({ tenantId: tenant.id }, teamId);
        expect(teamEvents.length).to.equal(1);
        const { startDate, endDate, externalId } = teamEvents[0];
        expect(toMomentUTC(startDate).isSame(toMomentUTC(teamEvent.start))).to.equal(true);
        expect(toMomentUTC(endDate).isSame(toMomentUTC(teamEvent.end))).to.equal(true);
        expect(externalId).to.equal(teamEvent.event_uid);
      });
    });

    describe('when the event already exists, but it was marked as deleted in the external calendar', () => {
      it('should remove it from TeamCalendarEvents table', async () => {
        const {
          user: { id: userId },
          team: { id: teamId },
        } = await createAUserAndTeam({ teamParams: { externalCalendars: { teamCalendarId: newId() } } });

        const deletedEvent = { ...teamEvent, deleted: true };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [deletedEvent] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          teamId,
          startDate: teamEvent.start,
          endDate: teamEvent.end,
          externalId: teamEvent.event_uid,
        };
        await saveTeamEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app).post(`${teamCalendarNotificationUrl}&teamId=${teamId}`).set(getAuthHeader(tenant.id, userId)).send({ notification }).expect(200);

        await task;

        const teamEvents = await getAllTeamEvents({ tenantId: tenant.id }, teamId);
        expect(teamEvents.length).to.equal(0);
      });
    });

    describe('when the event already exists, but has no duration now in the external calendar', () => {
      it('should remove it from TeamCalendarEvents table', async () => {
        const {
          user: { id: userId },
          team: { id: teamId },
        } = await createAUserAndTeam({ teamParams: { externalCalendars: { teamCalendarId: newId() } } });

        const eventWithNoDuration = { ...teamEvent, end: teamEvent.start };
        const getEvents = sinon.spy(() => ({ pages: {}, events: [eventWithNoDuration] }));
        setCalendarOps({ getEvents });

        const existingEvent = {
          teamId,
          startDate: teamEvent.start,
          endDate: teamEvent.end,
          externalId: teamEvent.event_uid,
        };
        await saveTeamEvent({ tenantId: tenant.id }, existingEvent);

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app).post(`${teamCalendarNotificationUrl}&teamId=${teamId}`).set(getAuthHeader(tenant.id, userId)).send({ notification }).expect(200);

        await task;

        const teamEvents = await getAllTeamEvents({ tenantId: tenant.id }, teamId);
        expect(teamEvents.length).to.equal(0);
      });
    });
  });

  describe('/webhooks/userRevaCalendarEventUpdated', () => {
    describe('when external calendar integration is enabled and an appointment is updated in Reva-Appointments external calendar', () => {
      it('should push back the original values', async () => {
        const { id: partyOwnerId } = await createAUser({ name: 'Bill Smith' });
        const party = await createAParty({ userId: partyOwnerId }, { tenantId: tenant.id }, { createAssignedProperty: true });
        const { id: partyMemberId } = await createAPartyMember(party.id);

        const appointmentOwner = await createAUser({
          externalCalendars: { calendarAccount: 'user1@reva.tech', revaCalendarId: newId(), access_token: 'VGhlZtvocBMqHPgGyeBU6LghZvGlvdls' },
        });
        const appointment = await createAnAppointment({
          partyId: party.id,
          partyMembers: [partyMemberId],
          salesPersonId: appointmentOwner.id,
          startDate: new Date('10-10-2020 16:30:00'),
        });

        const notificationUrl = `/webhooks/userRevaCalendarEventUpdated?api-token=${config.tokens.api}`;

        const createEvent = sinon.spy();
        const getEvents = sinon.spy(() => ({ pages: {}, events: [{ event_id: appointment.id }] }));
        setCalendarOps({ createEvent, getEvents });
        setGetShortId(() => 'short-url');

        const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

        await request(app)
          .post(`${notificationUrl}&userId=${appointmentOwner.id}`)
          .set(getAuthHeader(tenant.id, appointmentOwner.id))
          .send({ notification })
          .expect(200);

        await task;

        const description = await getExternalCalendarEventDescription({ tenantId: tenant.id }, appointment);
        const summary = await getCalendarSummary({ tenantId: tenant.id }, appointment);

        const eventData = {
          eventId: appointment.id,
          event_id: appointment.id,
          calendarId: appointmentOwner.externalCalendars.revaCalendarId,
          description,
          start: appointment.metadata.startDate,
          end: appointment.metadata.endDate,
          location: {
            description: '',
          },
          summary,
          accessToken: appointmentOwner.externalCalendars.access_token,
          tzid: LA_TIMEZONE,
        };

        expect(createEvent).to.have.been.calledWith(eventData);
      });
    });
  });
});
