/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import app from '../../api';
import { testCtx as ctx, createAParty, createATask, createAUser, createATeam, createATeamMember } from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenantId } from '../../../testUtils/test-tenant';
import '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getActivityLogs } from '../../../dal/activityLogRepo';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';

const createIntroduceYourselfTask = partyId => ({
  name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
  partyId,
});

const createFollowupPartyTask = partyId => ({
  name: DALTypes.TaskNames.FOLLOWUP_PARTY,
  category: DALTypes.TaskCategories.INACTIVE,
  partyId,
});

const createManualTask = (partyId, userIds) => ({
  name: 'Manual task',
  category: DALTypes.TaskCategories.MANUAL,
  partyId,
  userIds,
});

describe('API/tasks', () => {
  let party;
  let user;

  beforeEach(async () => {
    user = await createAUser();
    party = await createAParty({ userId: user.id });
  });

  describe('when the tasks endpoint is called', () => {
    it('should return 401 when not authorized', async () => {
      await createATask(createIntroduceYourselfTask(party.id));
      await request(app).get('/tasks').expect(401);
    });
  });

  describe('when the tasks endpoint is called', () => {
    it('the response should contain an array of tasks and each contains all the keys', async () => {
      const tasksKeys = [
        'id',
        'category',
        'partyId',
        'dueDate',
        'state',
        'name',
        'userIds',
        'metadata',
        'created_at',
        'updated_at',
        'completionDate',
        'modified_by',
        'createdFromCommId',
      ];
      await createATask(createIntroduceYourselfTask(party.id));
      const res = await request(app).get('/tasks').set(getAuthHeader()).expect(200);
      expect(res.body.length).to.equal(1);
      expect(res.body[0]).to.have.all.keys(tasksKeys);
    });

    describe('when the requests does not contain any query', () => {
      it('should return all the tasks', async () => {
        const { id } = await createATask(createIntroduceYourselfTask(party.id));

        const { body } = await request(app).get('/tasks').set(getAuthHeader()).expect(200);

        expect(body.length).to.equal(1);
        expect(body[0].id).to.equal(id);
      });
    });

    describe("when the requests contains 'ids' query with invalid UUIDs", () => {
      it('should respond with status code 400 and INCORRECT_TASK_ID token', async () => {
        const { body } = await request(app).get('/tasks?ids=not-a-uuid').set(getAuthHeader()).expect(400);

        expect(body.token).to.equal('INCORRECT_TASK_ID');
      });
    });

    describe("when the requests contains 'ids' query", () => {
      it('should return only the tasks with the specified ids', async () => {
        const { id: task1Id } = await createATask(createIntroduceYourselfTask(party.id));
        const { id: task2Id } = await createATask(createIntroduceYourselfTask(party.id));
        await createATask(createIntroduceYourselfTask(party.id));

        const { body } = await request(app).get(`/tasks?ids=${task1Id},${task2Id}`).set(getAuthHeader()).expect(200);

        expect(body.length).to.equal(2);
        expect(body.map(task => task.id).sort()).to.deep.equal([task1Id, task2Id].sort());
      });
    });

    describe('given no user ids, when creating a new task', () => {
      it('has response with status code 400 and MISSING_USER_IDS token', async () => {
        const task = {
          partyId: party.id,
          userIds: [],
        };

        await request(app)
          .post('/tasks')
          .set(getAuthHeader())
          .send(task)
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('MISSING_USER_IDS'));
      });
    });

    describe('given inexisting user id, when creating a new task', () => {
      it('has response with status code 404 and USER_NOT_FOUND', async () => {
        const task = {
          partyId: party.id,
          userIds: [getUUID()],
        };

        await request(app)
          .post('/tasks')
          .set(getAuthHeader())
          .send(task)
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('USER_NOT_FOUND'));
      });
    });

    describe('given no party id, when creating a new task', () => {
      it('has response with status code 400 and MISSING_PARTY_ID token', async () => {
        const task = {
          userIds: [user.id],
        };

        await request(app)
          .post('/tasks')
          .set(getAuthHeader())
          .send(task)
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('MISSING_PARTY_ID'));
      });
    });

    describe('given inexisting party id, when creating a new task', () => {
      it('has response with status code 404 and PARTY_NOT_FOUND token', async () => {
        const task = {
          partyId: getUUID(),
          userIds: [user.id],
        };

        await request(app)
          .post('/tasks')
          .set(getAuthHeader())
          .send(task)
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when creating a new task', () => {
      it('has the task entity keys ', async () => {
        const task = {
          partyId: party.id,
          userIds: [user.id],
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
          .set(getAuthHeader())
          .send(task)
          .expect(200)
          .expect(r => expect(r.body).to.have.all.keys(taskKeys));
      });
    });

    describe('when creating a new task', () => {
      it('saves and logs the party owner, created by and assigned to', async () => {
        const partyOwner = await createAUser({ name: 'the party owner' });
        const theParty = await createAParty({ userId: partyOwner.id });

        const assignee = await createAUser({ name: 'appointment user' });
        const createdBy = await createAUser({ name: 'appointment creator' });

        const task = {
          partyId: theParty.id,
          userIds: [assignee.id],
        };

        const res = await request(app).post('/tasks').set(getAuthHeader(tenantId, createdBy.id)).send(task);

        expect(res.status).to.equal(200);

        const data = res.body.metadata;
        expect(data.originalPartyOwner).to.equal(partyOwner.id);
        expect(data.originalAssignees).to.deep.equal([assignee.id]);
        expect(data.createdBy).to.equal(createdBy.id);

        const { details } = (await getActivityLogs(ctx)).find(l => l.type === ACTIVITY_TYPES.NEW && l.component === COMPONENT_TYPES.TASK);

        expect(details.partyOwner).to.equal(partyOwner.fullName);
        expect(details.assignee).to.equal(assignee.fullName);
        expect(details.createdBy).to.equal(createdBy.fullName);
      });
    });

    describe('when completing a task', () => {
      it('saves and logs the party owner, created by and assigned to', async () => {
        const completedBy = await createAUser({ name: 'completed by user' });
        const existingTask = await createATask(createManualTask(party.id, [user.id]));

        const res = await request(app)
          .patch(`/tasks/${existingTask.id}`)
          .set(getAuthHeader(tenantId, completedBy.id))
          .send({ state: DALTypes.TaskStates.COMPLETED });

        expect(res.status).to.equal(200);

        const data = res.body.metadata;
        expect(data.completedBy).to.equal(completedBy.id);

        const { details } = (await getActivityLogs(ctx)).find(l => l.component === COMPONENT_TYPES.TASK);

        expect(details.completedBy).to.equal(completedBy.fullName);
      });
    });
  });

  describe('API/parties/{partyId}/tasks', () => {
    describe('when loading tasks for a party', () => {
      describe('with a partyId that is not valid', () => {
        it('should respond with a status code of 400 and INCORRECT_PARTY_ID token', async () => {
          const res = await request(app).get('/parties/some-invalid-uuid/tasks').set(getAuthHeader()).expect(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_ID');
        });
      });

      describe('with an unknown party id', () => {
        it('should respond with a status code of 404 and PARTY_NOT_FOUND token', async () => {
          const res = await request(app).get(`/parties/${getUUID()}/tasks`).set(getAuthHeader(tenantId, user.id)).expect(404);
          expect(res.body.token).to.equal('PARTY_NOT_FOUND');
        });
      });

      describe('with a valid party id', () => {
        it('should respond with a status code of 200 and return the task in the body', async () => {
          const party2 = await createAParty();
          await createATask(createFollowupPartyTask(party.id));
          await createATask(createFollowupPartyTask(party2.id));
          const res = await request(app).get(`/parties/${party.id}/tasks`).set(getAuthHeader(tenantId, user.id)).expect(200);
          expect(res.body.length).to.equal(1);
          expect(res.body.every(t => t.partyId === party.id)).to.be.true;
        });
      });
    });
  });

  describe('when retrieving next agent for appointment', () => {
    it('returns the next available agent', async () => {
      const { id: teamId } = await createATeam();
      const { id: userId } = await createAUser();

      await createATeamMember({ teamId, userId });

      const tomorrowNoon = now().startOf('day').add(36, 'hours');

      const res = await request(app)
        .post(`/tasks/${teamId}/nextAgentForAppointment`)
        .set(getAuthHeader())
        .send({ timezone: LA_TIMEZONE, startDate: tomorrowNoon, slotDuration: 60 });

      expect(res.status).to.equal(200);

      const { userId: nextAgent } = res.body;
      expect(nextAgent).to.equal(userId);
    });
  });
});
