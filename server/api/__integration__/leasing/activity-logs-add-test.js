/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable camelcase */
import { expect } from 'chai';
import request from 'supertest';
import uuid from 'uuid/v4';
import { setupConsumers } from '../../../workers/consumer';
import app from '../../api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAUser, createAParty, createATeam, createATeamMember, createAProperty } from '../../../testUtils/repoHelper';
import { getActivityLogs, getActLogDisplayNo } from '../../../dal/activityLogRepo';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import sleep from '../../../../common/helpers/sleep';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { revaAdminEmail } from '../../../../common/helpers/database';
import config from '../../../config';

describe('API/activityLogs', () => {
  let adminUser;

  beforeEach(async () => {
    adminUser = await createAUser({ ctx, email: 'admin@reva.tech' });
  });
  describe('generate logs when saving new appointments', () => {
    const DELAY_FOR_AMQ_MS = 1000;

    describe('if the appointment entity is valid', () => {
      it('a new activity log is saved for that appointment', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const property = await createAProperty();

        const appointment = {
          salesPersonId: user.id,
          partyId: party.id,
          note: 'test',
          category: DALTypes.TaskCategories.APPOINTMENT,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
          metadata: {
            selectedPropertyId: property.id,
          },
        };

        await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

        await sleep(DELAY_FOR_AMQ_MS);

        const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        const newAppointmentsLog = res.body.filter(p => p.type === ACTIVITY_TYPES.NEW && p.component === COMPONENT_TYPES.APPOINTMENT);
        expect(newAppointmentsLog.length).to.equal(1);
      });
    });

    describe('if the appointment entity is not valid', () => {
      it('no activity log is saved for that appointment', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });

        const appointmentWithInvalidSalesPersonId = {
          salesPersonId: 'some-invalid-id',
          partyId: party.id,
          note: 'test',
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        };

        await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointmentWithInvalidSalesPersonId);

        const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        expect(res.body.length).to.equal(0);
      });
    });

    describe('when an appointment entity is created', () => {
      it('the generated activity log contains all appointments keys in the details field', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const property = await createAProperty();

        const taskKeys = [
          'seqDisplayNo',
          'id',
          'createdByType',
          'unitNames',
          'partyMembers',
          'note',
          'startDate',
          'endDate',
          'salesPerson',
          'partyId',
          'state',
          'appointmentResult',
          'partyOwner',
          'assignee',
          'createdBy',
          'closingNote',
          'displayNo',
        ];

        const appointment = {
          salesPersonId: user.id,
          partyId: party.id,
          note: 'test',
          category: DALTypes.TaskCategories.APPOINTMENT,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
          metadata: {
            selectedPropertyId: property.id,
          },
        };

        await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

        await sleep(DELAY_FOR_AMQ_MS);

        const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        expect(res.body[0].details).to.have.all.keys(taskKeys);
      });
    });
  });

  describe('generate logs for parties', () => {
    const DELAY_FOR_AMQ_MS = 1000;

    describe('new party is created', () => {
      it('a new activity log is saved for that party', async () => {
        const user = await createAUser();
        const team = await createATeam({
          name: 'testTeam',
          module: 'leasing',
          email: 'leasing_email',
          phone: '12025550190',
        });
        await createATeamMember({
          teamId: team.id,
          userId: user.id,
        });
        const party = {
          id: uuid(),
          userId: user.id,
          state: DALTypes.PartyStateType.CONTACT,
        };

        await request(app).post('/parties').set(getAuthHeader(tenant.id, user.id)).send(party);

        await sleep(DELAY_FOR_AMQ_MS);

        const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        const newPartyLogs = res.body.filter(p => p.type === ACTIVITY_TYPES.NEW && p.component === COMPONENT_TYPES.PARTY);
        expect(newPartyLogs.length).to.equal(1);
      });
    });

    describe('new party is created by an incoming communication', () => {
      const setupMessageQueueForEmail = async msgId => {
        const condition = m => m.Key === msgId;
        const { resolvers, promises } = waitFor([condition]);
        const matcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), matcher, ['mail']);

        return { task: Promise.all(promises) };
      };

      it('a new activity log is saved and has createdByType is SYSTEM', async () => {
        const user = await createAUser();
        const team = await createATeam({
          name: 'testTeam',
          module: 'leasing',
          email: 'leasing_email',
          phone: '12025550190',
        });

        const teamMember = await createATeamMember({
          teamId: team.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
          directEmailIdentifier: 'teamMember1',
        });
        const messageId = uuid().toString();
        const mailData = { Bucket: 'test', Key: messageId };

        const emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${teamMember.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            cc: [],
            from_email: 'guest@test.com',
            from_name: 'the_guest',
            text: 'email-body',
            subject: 'email-subject',
            messageId,
          },
        };

        setDeleteS3MailFunction(() => true);
        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(`/webhooks/email?api-token=${config.tokens.api}`).send(mailData).expect(200);
        await task;
        const activityLogs = await getActivityLogs(ctx);
        expect(activityLogs.length).to.equal(1);
        expect(activityLogs[0].details.createdByType).to.equal(DALTypes.CreatedByType.SYSTEM);
      });
    });

    describe('a party transition is triggered', () => {
      it('a new activity log is saved for party transition', async () => {
        const user = await createAUser();
        const property = await createAProperty();

        const team = await createATeam();
        const partyData = {
          id: uuid(),
          userId: user.id,
          state: DALTypes.PartyStateType.CONTACT,
          teams: [team.id],
          ownerTeam: team.id,
        };

        const party = await createAParty(partyData);
        const appointment = {
          salesPersonId: user.id,
          partyId: party.id,
          note: 'test',
          category: DALTypes.TaskCategories.APPOINTMENT,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
          metadata: {
            selectedPropertyId: property.id,
          },
        };

        await request(app).post('/tasks').set(getAuthHeader(tenant.id, user.id)).send(appointment);

        await sleep(DELAY_FOR_AMQ_MS);

        const res = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        const newPartyStateLogs = res.body.filter(p => p.type === ACTIVITY_TYPES.UPDATE && p.component === COMPONENT_TYPES.PARTY);
        expect(newPartyStateLogs.length).to.equal(1);
        expect(newPartyStateLogs[0].details.state).to.equal(DALTypes.PartyStateType.LEAD);
      });
    });
  });

  describe('POST', () => {
    describe('Given a valid request', () => {
      it('will return 200 and the new activity log', async () => {
        const team = await createATeam();
        const party = await createAParty({ userId: adminUser.id, teams: [team.id], ownerTeam: team.id });

        const logData = {
          entity: { id: party.id, notes: 'test' },
          activityType: ACTIVITY_TYPES.MANUAL,
        };

        const { status, body } = await request(app)
          .post('/activityLog')
          .set(getAuthHeader(tenant.id, adminUser.id, null, false, { email: revaAdminEmail }))
          .send(logData);

        expect(status).to.equal(200);

        const seqDisplayNo = await getActLogDisplayNo(ctx);
        const expectedResponseFormat = {
          created_at: '',
          updated_at: '',
          id: '',
          type: '',
          component: '',
          details: { id: '', notes: '', seqDisplayNo, createdByType: '' },
          context: { users: [], parties: [] },
          subComponent: null,
        };
        expect(body).to.have.all.keys(expectedResponseFormat);
        expect(body.type).to.equal(ACTIVITY_TYPES.MANUAL);
        expect(body.component).to.equal(COMPONENT_TYPES.PARTY);
        expect(body.context.users[0]).to.equal(adminUser.id);
        expect(body.context.parties[0]).to.equal(party.id);
      });
    });
    describe('Given a different auth user than reva admin', () => {
      it('will return 401 and unauthorized token', async () => {
        const party = await createAParty({ userId: adminUser.id });

        const logData = {
          entity: { id: party.id, notes: 'test' },
          activityType: ACTIVITY_TYPES.MANUAL,
        };

        const { status, body } = await request(app).post('/activityLog').set(getAuthHeader()).send(logData);

        expect(status).to.equal(401);
        expect(body.token).to.equal('UNAUTHORIZED');
      });
    });

    describe('Given an party id that is not a uuid', () => {
      it('will return 400 and INVALID_PARTY_ID token', async () => {
        const logData = {
          entity: { id: '123', notes: 'test' },
          activityType: ACTIVITY_TYPES.MANUAL,
        };

        const { status, body } = await request(app).post('/activityLog').set(getAuthHeader()).send(logData);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_PARTY_ID');
      });
    });
  });
});
