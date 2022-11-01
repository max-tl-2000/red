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
import { now } from '../../../common/helpers/moment-utils';
import { collectEmergencyContact } from '../tasks/taskDefinitions/collectEmergencyContact';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/collectEmergencyContact', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/collectEmergencyConact', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const shouldBeCreated = async () => await collectEmergencyContact.createTasks(ctx, party);
  const shouldBeCompleted = async () => await collectEmergencyContact.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await collectEmergencyContact.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTaskShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('if neither of the LEASE_EXECUTED, LEASE_VOIDED, PARTY_CLOSED, PARTY_ARCHIVED events are triggered', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-executed-lease.json');
      party.events = [];
    });

    describe('calling createTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('if LEASE_EXECUTED event is triggered', () => {
    describe('and the party is a renewal party', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.workflowName = DALTypes.WorkflowName.RENEWAL;
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party is a corporate party with the showEmergencyConact settings turned off', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.leaseType = DALTypes.LeaseType.CORPORATE;
        party.events[0].metadata.showEmergencyContactTask = false;
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party already has a collect emergency contact task', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        const task = {
          id: newId(),
          name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
          category: DALTypes.TaskCategories.FUTURE_RESIDENT,
          partyId: party.id,
          userIds: newId(),
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
          metadata: {},
        };
        party.tasks = [task];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party has no extecuted lease', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.leases = [];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party has all conditions in place to create a task', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
      });

      describe('calling createTasks', () => {
        it('should return one task', oneTaskShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });
  });

  describe('if LEASE_VOIDED event is triggered', () => {
    describe('and the party has no collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.LEASE_VOIDED;
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party has a collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.LEASE_VOIDED;
        const task = {
          id: newId(),
          name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
          category: DALTypes.TaskCategories.FUTURE_RESIDENT,
          partyId: party.id,
          userIds: newId(),
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
          metadata: {},
        };
        party.tasks = [task];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return one task', oneTasksShouldBeCanceled);
      });
    });
  });

  describe('if PARTY_CLOSED event is triggered', () => {
    describe('and the party has no collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.PARTY_CLOSED;
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party has a collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.PARTY_CLOSED;
        const task = {
          id: newId(),
          name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
          category: DALTypes.TaskCategories.FUTURE_RESIDENT,
          partyId: party.id,
          userIds: newId(),
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
          metadata: {},
        };
        party.tasks = [task];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return one task', oneTasksShouldBeCanceled);
      });
    });
  });

  describe('if PARTY_ARCHIVED event is triggered', () => {
    describe('and the party has no collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.PARTY_ARCHIVED;
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCanceled);
      });
    });

    describe('and the party has a collect emergency contact task active', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-executed-lease.json');
        party.events[0].event = DALTypes.PartyEventType.PARTY_ARCHIVED;
        const task = {
          id: newId(),
          name: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
          category: DALTypes.TaskCategories.FUTURE_RESIDENT,
          partyId: party.id,
          userIds: newId(),
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
          metadata: {},
        };
        party.tasks = [task];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCreated);
      });

      describe('calling completeTasks', () => {
        it('should return no tasks', zeroTasksShouldBeCompleted);
      });

      describe('calling cancelTasks', () => {
        it('should return one task', oneTasksShouldBeCanceled);
      });
    });
  });
});
