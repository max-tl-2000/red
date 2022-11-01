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
import { sendRenewalReminder } from '../tasks/taskDefinitions/sendRenewalReminder';
import { now } from '../../../common/helpers/moment-utils';
import { readJSON } from '../../../common/helpers/xfs';

describe('taskDefinitions/sendRenewalReminder', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const filename = 'renewal-party.json';
  const file = path.join(__dirname, 'data/sendRenewalReminder', filename);

  const shouldBeCompleted = async () => sendRenewalReminder.completeTasks(ctx, party);
  const shouldBeCanceled = async () => sendRenewalReminder.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('when the PARTY_CLOSED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return one task', oneTasksShouldBeCanceled);
    });
  });

  describe('when the PARTY_ARCHIVED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return one task', oneTasksShouldBeCanceled);
    });
  });

  describe('when the LEASE_RENEWAL_MOVING_OUT event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return one task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the QUOTE_SENT event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_SENT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return one task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the COMMUNICATION_SENT event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_SENT, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return one task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the COMMUNICATION_ADDED event is triggered', () => {
    beforeEach(async () => {
      party = await readJSON(file);
      party.events = [{ event: DALTypes.PartyEventType.COMMUNICATION_ADDED, metadata: {} }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    describe('calling completeTasks', () => {
      it('should return one task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });
});
