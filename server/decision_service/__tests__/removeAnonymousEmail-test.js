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
import { removeAnonymousEmail } from '../tasks/taskDefinitions/removeAnonymousEmail';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/removeAnonymousEmail', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/removeAnonymousEmail', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  const shouldBeCreated = async () => await removeAnonymousEmail.createTasks(ctx, party);
  const shouldBeCompleted = async () => await removeAnonymousEmail.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await removeAnonymousEmail.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTaskShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('for a traditional party with an anonymous email resident added to the party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-noActiveTask-and-anonymousEmail.json');

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create an RemoveAnonymousEmail task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a party with an active task and the anonymous email removed from the resident contact info', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-noAnonymousEmail.json');

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete the active task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a party with an active task and the anonymous email removed from the resident contact info', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-noAnonymousEmail.json');

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_REMOVED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete the active task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a party with an active task and the resident with an anonymous email removed from party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-anonymousEmail.json');
      party.members = [];

      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          partyMemberId: 'cff4009d-ae1d-4334-8d05-13205b19f0a0',
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no task', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel the active task', oneTasksShouldBeCanceled);
    });
  });

  describe('for a corporate party with no active task and the anonymous email still present, when updated to traditional', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-anonymousEmail.json');
      party.tasks = [];

      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_UPDATED,
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create the task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no task', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no task', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a renewal party with an anonymous email resident added to the party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-noActiveTask-and-anonymousEmail.json');
      party.workflowName = DALTypes.WorkflowName.RENEWAL;
      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create an RemoveAnonymousEmail task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a renewal party with an active task and the anonymous email removed from the resident contact info', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-noAnonymousEmail.json');
      party.workflowName = DALTypes.WorkflowName.RENEWAL;

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete the active task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a renewal party with an active task and the anonymous email removed from the resident contact info', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-noAnonymousEmail.json');
      party.workflowName = DALTypes.WorkflowName.RENEWAL;

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_REMOVED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete the active task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for a renewal party with an active task and the resident with an anonymous email removed from party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-anonymousEmail.json');
      party.workflowName = DALTypes.WorkflowName.RENEWAL;
      party.members = [];

      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          partyMemberId: 'cff4009d-ae1d-4334-8d05-13205b19f0a0',
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no task', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel the active task', oneTasksShouldBeCanceled);
    });
  });

  describe('for a resident party with an anonymous email resident added to the party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-noActiveTask-and-anonymousEmail.json');
      party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('for an archived party with an anonymous email resident added to the party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-noActiveTask-and-anonymousEmail.json');
      party.workflowState = DALTypes.WorkflowState.ARCHIVED;

      party.events = [
        {
          event: DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          metadata: { personId: '22c1c2b1-a917-467f-a6cd-428c2abdeb8d', contactInfoIds: ['0448a5cc-db5b-4528-a895-f1ef1b383f0e'] },
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should create no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('archiving a party with an active task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-anonymousEmail.json');
      party.members = [];

      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
        },
      ];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no task', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should cancel the active task', oneTasksShouldBeCanceled));
  });

  describe('closing a party with an active task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-activeTask-and-anonymousEmail.json');
      party.workflowState = DALTypes.WorkflowState.CLOSED;

      party.events = [
        {
          event: DALTypes.PartyEventType.PARTY_CLOSED,
        },
      ];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no task', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should cancel the active task', oneTasksShouldBeCanceled));
  });
});
