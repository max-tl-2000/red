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
import { introduceYourself } from '../tasks/taskDefinitions/introduceYourself';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/introduceYourself', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/introduceYourself', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  const shouldBeCreated = async () => await introduceYourself.createTasks(ctx, party);
  const shouldBeCompleted = async () => await introduceYourself.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await introduceYourself.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.INTRODUCE_YOURSELF);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTaskShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('party with no tasks and received email', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-email.json');
      // the communicationId is referenced in the JSON
      party.events = [
        { event: DALTypes.PartyEventType.COMMUNICATION_RECEIVED, metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff', isLeadCreated: true } },
      ];
    });

    describe('calling createTasks', () => {
      it('should create an Introduce Yourself task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with existing Introduce Yourself task for the party and received email', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-comm-and-task.json');
      // the communicationId is referenced in the JSON
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_RECEIVED, metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' } }];
    });

    describe('calling createTasks', () => {
      it('should create no new tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('new lease workflow with no tasks and created from a missed call', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-call.json');
      // the communicationId is referenced in the JSON
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          metadata: { communicationId: '2a0f7c8a-299e-4263-8cdf-5e601bf1c22e' },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create an Introduce Yourself task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('active lease workflow with no tasks and created from a missed call', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-call.json');
      party = {
        ...party,
        workflowName: 'activeLease',
        workflowState: 'active',
      };
      // the communicationId is referenced in the JSON
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          metadata: { communicationId: '2a0f7c8a-299e-4263-8cdf-5e601bf1c22e' },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create no Introduce Yourself task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with no tasks, existing comms and a missed call', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-2-calls.json');
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          metadata: { communicationId: '59e62e34-126c-4803-8391-01fae48c035d' },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should not create a task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with existing Introduce Yourself task for the party and sent email', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-comm-and-task.json');
      // the communicationId is referenced in the JSON
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_SENT, metadata: { communicationId: 'a8380dff-bf68-4377-8375-7569f2cad7ff' } }];
    });

    describe('calling createTasks', () => {
      it('should create no new tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return 1 task to be completed', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with existing Introduce Yourself task for the party and an added ContactEvent', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-contact-event-and-task.json');
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_ADDED, metadata: { communicationId: '0d86e1da-3c30-4208-9323-63f8f4db6f86' } }];
    });

    describe('calling createTasks', () => {
      it('should create no new tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return 1 task to be completed', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('closed party with existing Introduce Yourself task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-comm-and-task.json');
      // the communicationId is referenced in the JSON
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
    });

    describe('calling createTasks', () => {
      it('should create no new tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', oneTasksShouldBeCanceled);
    });
  });

  describe('archived party with existing Introduce Yourself task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-comm-and-task.json');
      // the communicationId is referenced in the JSON
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
    });

    describe('calling createTasks', () => it('should create no new tasks', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no tasks', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should return no tasks', oneTasksShouldBeCanceled));
  });

  describe('party with an active Introduce Yourself task and one answered phone call', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-call-and-task.json');
      // the communicationId is referenced in the JSON
      party.events = [
        {
          event: DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL,
          metadata: { communicationId: '2a0f7c8a-299e-4263-8cdf-5e601bf1c22e' },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete the task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });
});
