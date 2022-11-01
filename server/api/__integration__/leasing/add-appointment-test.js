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
import app, { processDBEvents } from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { setNotificationFunction } from '../../../../common/server/notificationClient';
import eventTypes from '../../../../common/enums/eventTypes';
import {
  createAParty,
  createAPartyMember,
  createAProperty,
  createAUser,
  createAnInventoryItem,
  createAnAppointment,
  createAQuote,
  createATask,
  toggleExtCalendarFeature,
  testCtx,
} from '../../../testUtils/repoHelper';

import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';
import { getActivityLogs, getActLogDisplayNo } from '../../../dal/activityLogRepo';
import { getAllUserEvents } from '../../../dal/calendarEventsRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { LA_TIMEZONE, UTC_TIMEZONE } from '../../../../common/date-constants';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { readFileAsString } from '../../../../common/helpers/file';
import { getExternalCalendarEventDescription } from '../../../services/externalCalendars/cronofyServiceHelper';
import { getPublishedLeaseData, createTestData, publishLease } from '../../../export/__integration__/exportTestHelper';
import { createQuotePrerequisites, pricingSetting } from '../../../testUtils/quoteApiHelper';
import { setGetShortId } from '../../../services/urlShortener';
import { setLeasingApiRequest } from '../../../decision_service/utils';
import { refreshSubscriptions } from '../../../dal/subscriptionsRepo';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/tasks', () => {
  let user;
  let party;
  let selectedProperty;

  beforeEach(async () => {
    user = await createAUser({ externalCalendars: { calendarAccount: 'user@test.com', revaCalendarId: newId() } });
    selectedProperty = await createAProperty();
    party = await createAParty({ assignedPropertyId: selectedProperty.id });
  });
  afterEach(async () => await toggleExtCalendarFeature(false));

  describe('given no sales person id, when creating a new appointment', () => {
    it('has response with status code 400 and MISSING_SALES_PERSON_ID token', async () => {
      const appointment = {
        partyId: party.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('MISSING_SALES_PERSON_ID'));
    });
  });

  describe('given inexisting sales person id, when creating a new appointment', () => {
    it('has response with status code 404 and SALES_PERSON_NOT_FOUND', async () => {
      const appointment = {
        salesPersonId: newId(),
        partyId: party.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('SALES_PERSON_NOT_FOUND'));
    });
  });

  describe('given appointment with missing dates, when creating a new appointment', () => {
    it('has response with status code 400 and INVALID_APPOINTMENT_DATES token', async () => {
      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_APPOINTMENT_DATES'));
    });
  });

  describe('given appointment with endDate before startDate, when creating a new appointment', () => {
    it('has response with status code 400 and INVALID_APPOINTMENT_DATES token', async () => {
      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_APPOINTMENT_DATES'));
    });
  });

  describe('given appointment with missing party id, when creating a new appointment', () => {
    it('has response with status code 400 and MISSING_PARTY_ID token', async () => {
      const appointment = {
        salesPersonId: user.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 15:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('MISSING_PARTY_ID'));
    });
  });

  describe('given appointment with inexisting party id, when creating a new appointment', () => {
    it('has response with status code 404 and PARTY_NOT_FOUND token', async () => {
      const appointment = {
        salesPersonId: user.id,
        partyId: newId(),
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 15:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
    });
  });

  describe('when creating a new appointment', () => {
    it('has the appointment entity keys and the slot is marked as busy in UserCalendarEvents table', async () => {
      const property = await createAProperty();
      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14T08:30:00.000Z', { timezone: UTC_TIMEZONE }),
        endDate: toMoment('2016-12-14T09:30:00.000Z', { timezone: UTC_TIMEZONE }),
        metadata: {
          selectedPropertyId: property.id,
          appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
        },
      };

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
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(200)
        .expect(r => expect(r.body).to.have.all.keys(taskKeys))
        .expect(r => expect(r.body.metadata.appointmentCreatedFrom).to.equal(DALTypes.AppointmentCreatedFrom.REVA));

      const events = await getAllUserEvents({ tenantId: tenant.id }, user.id);
      expect(events.length).to.equal(1);
      const { userId: eventUserId, startDate: eventStartDate, endDate: eventEndDate } = events[0];
      expect(eventUserId).to.equal(user.id);
      expect(toMoment(eventStartDate, { timezone: UTC_TIMEZONE }).isSame(appointment.startDate)).to.equal(true);
      expect(toMoment(eventEndDate, { timezone: UTC_TIMEZONE }).isSame(appointment.endDate)).to.equal(true);
    });
  });

  describe('when adding appointment with guests', () => {
    it('saves the appointment guests', async () => {
      const pm1 = await createAPartyMember(party.id);
      const pm2 = await createAPartyMember(party.id);

      const partyMemberIds = [pm1, pm2].map(pm => pm.id);

      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        partyMembers: partyMemberIds,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

      expect(res.status).to.equal(200);
      expect(res.body.metadata.partyMembers.sort()).to.deep.equal(partyMemberIds.sort());
    });

    describe('and external calendar integration is enabled', () => {
      it('it saves the appointment and makes a request to add the appointment to the Reva calendar in user enterprise email account', async () => {
        await toggleExtCalendarFeature(true);

        const partyOwner = await createAUser({ name: 'the party owner' });
        const theParty = await createAParty({ userId: partyOwner.id }, { tenantId: tenant.id }, { createAssignedProperty: true });

        const appointment = {
          salesPersonId: user.id,
          partyId: theParty.id,
          partyMembers: [],
          category: DALTypes.TaskCategories.APPOINTMENT,
          startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
          endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
          metadata: {
            selectedPropertyId: selectedProperty.id,
          },
        };

        const createEvent = sinon.spy();
        setCalendarOps({ createEvent });

        const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

        expect(res.status).to.equal(200);
        expect(createEvent).to.have.been.calledOnce;
      });
    });
  });

  describe("when adding appointment with guests that are not in the appointment's party", () => {
    it('has response with status code 400 and INVALID_PARTY_MEMBERS token', async () => {
      const aParty = await createAParty();
      const anotherParty = await createAParty();

      const partyMember = await createAPartyMember(anotherParty.id);

      const appointment = {
        salesPersonId: user.id,
        partyId: aParty.id,
        partyMembers: [partyMember.id],
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      await request(app)
        .post('/tasks')
        .set(getAuthHeader(tenant.id, user.id))
        .send(appointment)
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_PARTY_MEMBERS'));
    });
  });

  describe('when adding appointment with properties', () => {
    it('saves the appointment properties', async () => {
      const i1 = await createAnInventoryItem();
      const i2 = await createAnInventoryItem();

      const inventoryIds = [i1, i2].map(i => i.id);

      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        properties: inventoryIds,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

      expect(res.status).to.equal(200);
      expect(res.body.metadata.inventories.sort()).to.deep.equal(inventoryIds.sort());
    });
  });

  describe('when adding appointment with note', () => {
    it('saves the appointment note', async () => {
      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        note: 'first note',
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

      expect(res.status).to.equal(200);
      expect(res.body.metadata.note).to.deep.equal(appointment.note);
    });
  });

  describe('when adding appointment', () => {
    it('saves the party owner, created by and assigned to', async () => {
      const partyOwner = await createAUser({ name: 'the party owner' });
      const theParty = await createAParty({ userId: partyOwner.id });

      const assignee = await createAUser({ name: 'appointment user' });
      const createdBy = await createAUser({ name: 'appointment creator' });

      const appointment = {
        salesPersonId: assignee.id,
        partyId: theParty.id,
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        note: 'first note',
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const res = await request(app).post('/tasks').set(getAuthHeader(tenant.id, createdBy.id)).send(appointment);

      expect(res.status).to.equal(200);

      const data = res.body.metadata;
      expect(data.originalPartyOwner).to.equal(partyOwner.id);
      expect(data.originalAssignees).to.deep.equal([assignee.id]);
      expect(data.createdBy).to.equal(createdBy.id);

      const { details } = (await getActivityLogs({ tenantId: tenant.id })).find(
        l => l.type === ACTIVITY_TYPES.NEW && l.component === COMPONENT_TYPES.APPOINTMENT,
      );

      expect(details.partyOwner).to.equal(partyOwner.fullName);
      expect(details.assignee).to.equal(assignee.fullName);
      expect(details.createdBy).to.equal(createdBy.fullName);
    });
  });

  describe('when two appointments are created for the same party', () => {
    it('both appointments logs will have different displayNo', async () => {
      const firstAppointment = {
        salesPersonId: user.id,
        partyId: party.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const secondAppointment = {
        salesPersonId: user.id,
        partyId: party.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const firstAppointmentRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(firstAppointment);

      expect(firstAppointmentRes.status).to.equal(200);
      const firstAppDisplayNo = await getActLogDisplayNo(testCtx);

      const secondAppointmentRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(secondAppointment);

      expect(secondAppointmentRes.status).to.equal(200);
      const secondAppDisplayNo = await getActLogDisplayNo(testCtx);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      const newAppointmentsLog = logs.filter(p => p.type === ACTIVITY_TYPES.NEW && p.component === COMPONENT_TYPES.APPOINTMENT);
      expect(newAppointmentsLog.length).to.equal(2);
      expect(newAppointmentsLog.map(l => l.details.seqDisplayNo).sort()).to.deep.equal([firstAppDisplayNo, secondAppDisplayNo]);
    });
  });

  describe('when two appointments are created for two different parties', () => {
    it('both appointments logs will have different displayNo', async () => {
      const party2 = await createAParty();

      const firstAppointment = {
        salesPersonId: user.id,
        partyId: party.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const secondAppointment = {
        salesPersonId: user.id,
        partyId: party2.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone: LA_TIMEZONE }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone: LA_TIMEZONE }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const firstAppointmentRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(firstAppointment);

      expect(firstAppointmentRes.status).to.equal(200);
      const firstAppDisplayNo = await getActLogDisplayNo(testCtx);

      const secondAppointmentRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(secondAppointment);

      expect(secondAppointmentRes.status).to.equal(200);
      const secondAppDisplayNo = await getActLogDisplayNo(testCtx);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      const newAppointmentsLog = logs.filter(p => p.type === ACTIVITY_TYPES.NEW && p.component === COMPONENT_TYPES.APPOINTMENT);
      expect(newAppointmentsLog.length).to.equal(2);
      expect(newAppointmentsLog.map(l => l.details.seqDisplayNo).sort()).to.deep.equal([firstAppDisplayNo, secondAppDisplayNo]);
    });
  });

  describe('when an appointment is created for a party', () => {
    it('the assigned user will be notified with the new appointment', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const { timezone } = selectedProperty;
      const appointment = {
        salesPersonId: user.id,
        partyId: party.id,
        note: 'test',
        category: DALTypes.TaskCategories.APPOINTMENT,
        startDate: toMoment('2016-12-14 16:30:00-08:00', { timezone }),
        endDate: toMoment('2016-12-14 17:30:00-08:00', { timezone }),
        metadata: {
          selectedPropertyId: selectedProperty.id,
        },
      };

      const appointmentRes = await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);
      expect(appointmentRes.status).to.equal(200);

      const { userIds, metadata } = appointmentRes.body;
      const { startDate, teamId } = metadata;
      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.LOAD_APPOINTMENTS_EVENT,
          data: { date: startDate, agentId: userIds[0], teamId, timezone },
          routing: { teams: party.teams },
        }),
      );
    });
  });

  describe('when adding appointment to the external calendar', () => {
    describe('the description template should contain', () => {
      const BASE_PATH = 'server/api/__integration__/resources/';
      let appointmentOwner;

      beforeEach(async () => {
        appointmentOwner = await createAUser();
      });

      it('partyMembers, shortenedPartyUrl, inventoryNamesVisiting, notes, previouslyVisitedUnits and a partyOwner if party is prior to application', async () => {
        const partyOwnerName = 'Bill Smith';
        const { id: userId } = await createAUser({ name: partyOwnerName });
        const { id: partyId } = await createAParty({ userId });

        const { id: pm1Id } = await createAPartyMember(partyId);
        const { id: pm2Id } = await createAPartyMember(partyId);
        const { id: pm3Id } = await createAPartyMember(partyId);

        const inventoryName1 = 'inventory name 1';
        const inventoryName2 = 'inventory name 2';
        const { id: inventoryId1 } = await createAnInventoryItem({ inventoryName: inventoryName1 });
        const { id: inventoryId2 } = await createAnInventoryItem({ inventoryName: inventoryName2 });

        await createATask({
          userIds: [userId],
          partyId,
          state: DALTypes.TaskStates.COMPLETED,
          category: DALTypes.TaskCategories.APPOINTMENT,
          metadata: { inventories: [inventoryId1] },
        });

        const appointment = await createAnAppointment({
          partyId,
          partyMembers: [pm1Id, pm2Id, pm3Id],
          properties: [inventoryId2],
          note: 'test',
          salesPersonId: appointmentOwner.id,
          startDate: new Date('10-10-2020 16:30:00'),
        });

        setGetShortId(() => 'short-url');
        const description = await getExternalCalendarEventDescription({ tenantId: tenant.id }, appointment);

        const templateFile = 'calendar-description-prior-application.txt';
        const templateData = await readFileAsString(templateFile, BASE_PATH);

        expect(description).to.contain(templateData);
      });

      it('partyMembers, shortenedPartyUrl, inventoryNamesVisiting, quotedUnits notes and a partyOwner if party is in applicant phase', async () => {
        const partyOwnerName = 'Bill Smith';
        const { inventoryId, partyId } = await createQuotePrerequisites({ ...pricingSetting }, DALTypes.PartyStateType.APPLICANT, partyOwnerName);

        await createAQuote(partyId, { inventoryId });

        const { id: pm1Id } = await createAPartyMember(partyId);
        const { id: pm2Id } = await createAPartyMember(partyId);
        const { id: pm3Id } = await createAPartyMember(partyId);

        const appointment = await createAnAppointment({
          partyId,
          partyMembers: [pm1Id, pm2Id, pm3Id],
          properties: [inventoryId],
          note: 'test',
          salesPersonId: appointmentOwner.id,
          startDate: new Date('10-10-2020 16:30:00'),
        });
        setGetShortId(() => 'short-url');
        const description = await getExternalCalendarEventDescription({ tenantId: tenant.id }, appointment);

        const templateFile = 'calendar-description-post-application.txt';
        const templateData = await readFileAsString(templateFile, BASE_PATH);

        expect(description).to.contain(templateData);
      });

      it('partyMembers, shortenedPartyUrl, inventoryNamesVisiting, leaseInformation, notes and a partyOwner if the party has a published lease', async () => {
        setLeasingApiRequest(() => request(app));
        await enableAggregationTriggers(tenant.id);
        await refreshSubscriptions(tenant);
        const pgClient = await processDBEvents();

        const leaseTestData = await createTestData({
          backendMode: DALTypes.BackendMode.YARDI,
          daysFromNow: 1,
          timezone: LA_TIMEZONE,
          propertyDisplayName: 'Winterfell',
        });
        const { id: partyId } = leaseTestData.party;
        const { matcher, property, concessions } = leaseTestData;

        const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
        await publishLease(matcher, leaseTestData, publishedLease);

        const { id: partyMemberId } = await createAPartyMember(partyId);
        const appointment = await createAnAppointment({
          partyId,
          partyMembers: [partyMemberId],
          note: 'test',
          salesPersonId: appointmentOwner.id,
          startDate: new Date('10-10-2020 16:30:00'),
        });
        setGetShortId(() => 'short-url');
        const description = await getExternalCalendarEventDescription({ tenantId: tenant.id }, appointment);

        const templateFile = 'calendar-description-lease-published.txt';
        const templateData = await readFileAsString(templateFile, BASE_PATH);

        expect(description).to.contain(templateData);

        await pgClient.close();
      });
    });
  });
});
