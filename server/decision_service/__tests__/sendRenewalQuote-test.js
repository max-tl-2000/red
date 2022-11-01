/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import path from 'path';
import { expect } from 'chai';
import { DALTypes } from '../../../common/enums/DALTypes';
import { sendRenewalQuote } from '../tasks/taskDefinitions/sendRenewalQuote';
import { now } from '../../../common/helpers/moment-utils';
import { readJSON } from '../../../common/helpers/xfs';

describe('taskDefinitions/sendRenewalQuote', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const filename = 'party-with-lease-renewals.json';
  const file = path.join(__dirname, 'data/sendRenewalQuote', filename);

  const shouldBeCreated = async () => sendRenewalQuote.createTasks(ctx, party);
  const shouldBeCompleted = async () => sendRenewalQuote.completeTasks(ctx, party);
  const shouldBeCanceled = async () => sendRenewalQuote.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.SEND_RENEWAL_QUOTE);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTasksShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('when the LEASE_RENEWAL_CREATED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_CREATED, metadata: {} }];
    });

    describe('calling createTasks', () => {
      it('should return one task', oneTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the QUOTE_PUBLISHED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PUBLISHED, metadata: {} }];
    });

    describe('calling createTasks', () => {
      it('should return one task', oneTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the LEASE_CREATED event is triggered and we already have an active send renewal letter task', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_CREATED, metadata: {} }];

      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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

  describe('when the QUOTE_PUBLISHED event is triggered and we already have an active send renewal letter task', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PUBLISHED, metadata: {} }];

      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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

  describe('when the LEASE_RENEWAL_CANCEL_MOVE_OUT event is triggered and we do not have a completed SEND RENEWAL LETTER task', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT, metadata: {} }];
    });

    describe('calling createTasks', () => {
      it('should return one task', oneTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the LEASE_RENEWAL_CANCEL_MOVE_OUT event is triggered and we have a completed SEND RENEWAL LETTER task', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.COMPLETED,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return one task', zeroTasksShouldBeCompleted);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the QUOTE PRINTED event is triggered and we have an active SEND RENEWAL LETTER task', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PRINTED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return one task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the COMMUNICATION_ADDED event is triggered and not all the residents received the renewal letter', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_ADDED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
      party.comms = [
        {
          id: newId(),
          type: DALTypes.CommunicationMessageType.SMS,
          userId: party.userId,
          parties: [party.id],
          persons: [party.members[0].partyMember.personId],
          message: { quoteId: 'testId' },
          category: DALTypes.CommunicationCategory.QUOTE,
          direction: DALTypes.CommunicationDirection.OUT,
        },
      ];
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

  describe('when the COMMUNICATION_ADDED event is triggered and all the residents received the renewal letter', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_ADDED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
      party.comms = [
        {
          id: newId(),
          type: DALTypes.CommunicationMessageType.SMS,
          userId: party.userId,
          parties: [party.id],
          persons: [party.members[0].partyMember.personId, party.members[1].partyMember.personId],
          message: { quoteId: 'testId' },
          category: DALTypes.CommunicationCategory.QUOTE,
          direction: DALTypes.CommunicationDirection.OUT,
        },
      ];
    });

    describe('calling createTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the LEASE_RENEWAL_MOVING_OUT event is triggered and the active lease state is moving out', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.activeLeaseData[0].state = DALTypes.ActiveLeaseState.MOVING_OUT;
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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

  describe('when the LEASE_RENEWAL_MOVING_OUT event is triggered and the active lease state is not moving out', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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

  describe('when the PARTY_ARCHIVED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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

  describe('when the PARTY_CLOSED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
          category: DALTypes.TaskCategories.QUOTE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
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
