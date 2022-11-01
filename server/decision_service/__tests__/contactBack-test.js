/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import fs from 'fs';
import path from 'path';
import { promisify } from 'bluebird';
import { expect } from 'chai';

import { DALTypes } from '../../../common/enums/DALTypes';
import { contactBack } from '../tasks/taskDefinitions/contactBack';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/contactBack', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/contactBack', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  const shouldBeCreated = async () => await contactBack.createTasks(ctx, party);
  const shouldBeCompleted = async () => await contactBack.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await contactBack.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.CALL_BACK);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  describe('party created from missed call', () => {
    beforeEach(async () => {
      party = await loadJson('01 one-missed-call.json');
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should not create a Contact Back task', async () => await zeroTasks(await shouldBeCreated()));
    });
    describe('calling completeTasks', () => {
      it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
    });
    describe('calling cancelTasks', () => {
      it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
    });
  });

  describe('the caller requested to be called back', () => {
    beforeEach(async () => {
      party = await loadJson('01 one-missed-call.json');
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
          metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create an Contact Back task', async () => await oneTask(await shouldBeCreated()));
    });
    describe('calling completeTasks', () => {
      it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
    });
    describe('calling cancelTasks', () => {
      it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
    });
  });

  describe('party with a completed Contact Back task', () => {
    describe('when the caller requests to be called back', () => {
      beforeEach(async () => {
        party = await loadJson('07 one-call-and-completed-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' },
          },
        ];
      });

      describe('createTasks', () => {
        it('should create a new task', async () => await oneTask(await shouldBeCreated()));
      });
      describe('completeTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });
  });

  describe('party with an active Contact Back task', () => {
    describe('when there is a missed call', () => {
      beforeEach(async () => {
        party = await loadJson('02 party-with-one-call-and-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when a prior communication (Contact Event) is added', () => {
      beforeEach(async () => {
        party = await loadJson('03 active-task-and-walkin.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_ADDED,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when a communication was sent to the party', () => {
      beforeEach(async () => {
        party = await loadJson('02 party-with-one-call-and-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_SENT,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when a call from the party was answered', () => {
      beforeEach(async () => {
        party = await loadJson('02 party-with-one-call-and-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when a manual task for the party was added', () => {
      beforeEach(async () => {
        party = await loadJson('04 active-task-and-manual-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.TASK_ADDED,
            metadata: { category: DALTypes.TaskCategories.MANUAL },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when an appointment for the party was created', () => {
      beforeEach(async () => {
        party = await loadJson('04 active-task-and-manual-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.TASK_ADDED,
            metadata: { category: DALTypes.TaskCategories.APPOINTMENT },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when the lease is countersigned', () => {
      beforeEach(async () => {
        party = await loadJson('06 active-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED,
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when the lease is voided', () => {
      beforeEach(async () => {
        party = await loadJson('06 active-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED,
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should complete the task', async () => await oneTask(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });

    describe('when the party is closed', () => {
      beforeEach(async () => {
        party = await loadJson('06 active-task.json');
        party.events = [
          {
            event: DALTypes.PartyEventType.PARTY_CLOSED,
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should not complete the task', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should cancel the task', async () => await oneTask(await shouldBeCanceled()));
      });
    });
  });

  describe('when the party is archived', () => {
    beforeEach(async () => {
      party = await loadJson('06 active-task.json');
      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_ARCHIVED,
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should not create new tasks', async () => await zeroTasks(await shouldBeCreated()));
    });
    describe('calling completeTasks', () => {
      it('should not complete the task', async () => await zeroTasks(await shouldBeCompleted()));
    });
    describe('calling cancelTasks', () => {
      it('should cancel the task', async () => await oneTask(await shouldBeCanceled()));
    });
  });

  describe('for a renewal party', () => {
    describe('when the caller requested to be called back', () => {
      beforeEach(async () => {
        party = await loadJson('01 one-missed-call.json');
        party.workflowName = DALTypes.WorkflowName.RENEWAL;
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create an Contact Back task', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });
  });

  describe('for a active lease party', () => {
    describe('when the caller requested to be called back', () => {
      beforeEach(async () => {
        party = await loadJson('01 one-missed-call.json');
        party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create an Contact Back task', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });
  });

  describe('for an archived party', () => {
    describe('when the caller requested to be called back', () => {
      beforeEach(async () => {
        party = await loadJson('01 one-missed-call.json');
        party.workflowState = DALTypes.WorkflowState.ARCHIVED;
        party.events = [
          {
            event: DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
            metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true },
          },
        ];
      });

      describe('calling createTasks', () => {
        it('should not create an Contact Back task', async () => await zeroTasks(await shouldBeCreated()));
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCompleted()));
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => await zeroTasks(await shouldBeCanceled()));
      });
    });
  });
});
