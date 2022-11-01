/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from '../../../../common/test-helpers';
import app from '../../api';
import { testCtx as ctx, createAUser, createAParty, createAPartyMember, createAnAppointment } from '../../../testUtils/repoHelper';
import { updateTask } from '../../../dal/tasksRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { runInTransaction } from '../../../database/factory';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { now, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../../common/date-constants';

describe('API/schedule', () => {
  let user;
  let party;
  let partyMember1;
  let partyMember2;
  let partyMember3;
  let nowDate;
  let userAppointments;

  const data = [
    {
      start: { offset: 14, time: '16:30:00' },
      end: { offset: 14, time: '17:30:00' },
    },
    {
      start: { offset: 14, time: '10:30:00' },
      end: { offset: 14, time: '14:30:00' },
    },
    {
      start: { offset: 19, time: '16:30:00' },
      end: { offset: 19, time: '17:30:00' },
    },
    {
      start: { offset: 57, time: '09:30:00' },
      end: { offset: 57, time: '10:30:00' },
    },
  ];

  const getDateFromMeta = (meta, startDate) => {
    const dateOnly = startDate.format('YYYY-MM-DD');
    const date = parseAsInTimezone(`${dateOnly}T${meta.time}`, { timezone: LA_TIMEZONE });
    date.add(meta.offset, 'days');
    return date;
  };

  const getUniqueDates = () => {
    const set = new Set([...userAppointments.map(appointment => appointment.startDate.format('YYYY-MM-DD'))]);
    return Array.from(set).sort();
  };

  const createAppointments = async appointments => {
    const promises = appointments.map(appointment => createAnAppointment(appointment));

    const ids = (await Promise.all(promises)).map(appointment => appointment.id);

    ids.forEach((id, index) => {
      appointments[index].id = id;
    });
  };

  const addGuestsToAppointment = async (appointment, guests) => {
    const metadata = { partyMembers: guests.map(pm => pm.id) };
    await updateTask(ctx, appointment.id, { metadata });
  };

  const seedAsync = async () => {
    user = await createAUser();
    party = await createAParty();
    partyMember1 = await createAPartyMember(party.id, { fullName: 'Foo' });
    partyMember2 = await createAPartyMember(party.id, { fullName: 'Bar' });
    partyMember3 = await createAPartyMember(party.id, { fullName: 'Baz' });

    userAppointments = data.map(appointment => ({
      startDate: getDateFromMeta(appointment.start, nowDate),
      endDate: getDateFromMeta(appointment.end, nowDate),
      salesPersonId: user.id,
      partyId: party.id,
    }));

    await createAppointments(userAppointments);

    await addGuestsToAppointment(userAppointments[0], [partyMember1]);
    await addGuestsToAppointment(userAppointments[1], [partyMember1, partyMember2]);
    await addGuestsToAppointment(userAppointments[2], [partyMember2]);
    await addGuestsToAppointment(userAppointments[3], [partyMember1, partyMember2, partyMember3]);
  };

  beforeEach(async () => {
    nowDate = now({ timezone: LA_TIMEZONE });
    await runInTransaction(seedAsync);
  });

  describe('/overview[?preloadDays=N]', () => {
    it('returns list of daysWithTasks', async () => {
      await request(app)
        .post('/schedule/overview/')
        .set(getAuthHeader(tenant.id, user.id))
        .send({ users: [user.id], timezone: LA_TIMEZONE })
        .expect(200)
        .expect(r => expect(r.body.daysWithTasks).to.eql(getUniqueDates()));
    });

    it('by default does not preload any tasks', async () => {
      await request(app)
        .post('/schedule/overview/')
        .set(getAuthHeader(tenant.id, user.id))
        .send({ users: [user.id], timezone: LA_TIMEZONE })
        .expect(200)
        .expect(r => expect(r.body.tasks).to.eql({}));
    });

    // CPM-4957
    it('returns tasks for the number of days if preloadDays parameter is provided', async () => {
      const expectedPreloadedTasks = {
        [`${userAppointments[0].startDate.format('YYYY-MM-DD')}`]: [
          {
            id: userAppointments[0].id,
            partyId: party.id,
            metadata: {
              appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
              startDate: userAppointments[0].startDate.toISOString(),
              endDate: userAppointments[0].endDate.toISOString(),
              note: '',
              partyMembers: [partyMember1].map(pm => pm.id),
              inventories: [],
            },
            state: DALTypes.TaskStates.ACTIVE,
            guests: ['Foo'],
            units: [],
            userIds: [user.id],
          },
          {
            id: userAppointments[1].id,
            partyId: party.id,
            metadata: {
              appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
              startDate: userAppointments[1].startDate.toISOString(),
              endDate: userAppointments[1].endDate.toISOString(),
              note: '',
              partyMembers: [partyMember1, partyMember2].map(pm => pm.id),
              inventories: [],
            },
            state: DALTypes.TaskStates.ACTIVE,
            guests: ['Foo', 'Bar'],
            units: [],
            userIds: [user.id],
          },
        ],
        [`${userAppointments[2].startDate.format('YYYY-MM-DD')}`]: [
          {
            id: userAppointments[2].id,
            partyId: party.id,
            metadata: {
              appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
              startDate: userAppointments[2].startDate.toISOString(),
              endDate: userAppointments[2].endDate.toISOString(),
              note: '',
              partyMembers: [partyMember2].map(pm => pm.id),
              inventories: [],
            },
            state: DALTypes.TaskStates.ACTIVE,
            guests: ['Bar'],
            units: [],
            userIds: [user.id],
          },
        ],
      };

      const { status, body } = await request(app)
        .post('/schedule/overview/?preloadDays=2')
        .send({ users: [user.id], timezone: LA_TIMEZONE })
        .set(getAuthHeader(tenant.id, user.id));

      expect(status).to.equal(200);
      expect(body.tasks).to.deep.equal(expectedPreloadedTasks);
    });
  });

  describe('/?days[]=YYYY-MM-DD', () => {
    it('returns mapping from day to list of tasks', async () => {
      const expectedPreloadedTasks = {
        [`${userAppointments[2].startDate.format('YYYY-MM-DD')}`]: [
          {
            id: userAppointments[2].id,
            partyId: party.id,
            metadata: {
              appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
              startDate: userAppointments[2].startDate.toISOString(),
              endDate: userAppointments[2].endDate.toISOString(),
              note: '',
              partyMembers: [partyMember2].map(pm => pm.id),
              inventories: [],
            },
            state: DALTypes.TaskStates.ACTIVE,
            guests: ['Bar'],
            units: [],
            userIds: [user.id],
          },
        ],
        [`${userAppointments[3].startDate.format('YYYY-MM-DD')}`]: [
          {
            id: userAppointments[3].id,
            partyId: party.id,
            metadata: {
              appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA,
              startDate: userAppointments[3].startDate.toISOString(),
              endDate: userAppointments[3].endDate.toISOString(),
              note: '',
              partyMembers: [partyMember1, partyMember2, partyMember3].map(pm => pm.id),
              inventories: [],
            },
            state: DALTypes.TaskStates.ACTIVE,
            guests: ['Foo', 'Bar', 'Baz'],
            units: [],
            userIds: [user.id],
          },
        ],
      };

      await request(app)
        .get(`/schedule?days[]=${userAppointments[2].startDate.format('YYYY-MM-DD')}&days[]=${userAppointments[3].startDate.format('YYYY-MM-DD')}`)
        .set(getAuthHeader(tenant.id, user.id))
        .query({ timezone: LA_TIMEZONE })
        .expect(200)
        .expect(r => console.log(JSON.stringify(r.body, null, 2)))
        .expect(expectedPreloadedTasks);
    });
  });
});
