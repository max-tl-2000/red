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
import { promoteApplication } from '../tasks/taskDefinitions/promoteApplication';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/promoteApplication', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/promoteApplication', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  const shouldBeCreated = async () => await promoteApplication.createTasks(ctx, party);
  const shouldBeCompleted = async () => await promoteApplication.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await promoteApplication.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.PROMOTE_APPLICATION);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTaskShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('party with application status paid', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-application-status-paid.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with application status completed and screening status incomplete', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-incomplete.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with application status completed and screening status complete', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.SCREENING_RESPONSE_PROCESSED }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with lease voided event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED, metadata: { handlePromoteApplicationTask: true } }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with renewal lease voided event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED, metadata: { handlePromoteApplicationTask: false } }];
    });

    describe('calling createTasks', () => {
      it('should not create an Promote Application task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with persons application merged event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.PERSONS_APPLICATION_MERGED, metadata: { handlePromoteApplicationTask: true } }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when the person applications are merged', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-promote-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PERSONS_APPLICATION_MERGED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no tasks', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should cancel an Promote Application task', oneTasksShouldBeCanceled));
  });

  describe('party with merge persons event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.PERSONS_MERGED }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with party lease type changed to traditional event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_UPDATED, metadata: { handlePromoteApplicationTask: true } }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with quote promotion event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-quote-promotion.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete an Promote Application task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('party with party lease type changed to corporate event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-lease-type-changed-to-corporate.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_UPDATED, metadata: { handlePromoteApplicationTask: true } }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel an Promote Application task', oneTasksShouldBeCanceled);
    });
  });

  describe('party with a new party member added event', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-promote-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel an Promote Application task', oneTasksShouldBeCanceled);
    });
  });

  describe('when a party is closed', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-promote-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel an Promote Application task', oneTasksShouldBeCanceled);
    });
  });

  describe('when a party is archived', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-one-promote-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no tasks', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should cancel an Promote Application task', oneTasksShouldBeCanceled));
  });

  describe('party with one member removed who have application status paid, one member active with application status complete and a screening response', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-removed-member.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED }];
    });

    describe('calling createTasks', () => {
      it('should create an Promote Application task', oneTaskShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('renewal party with application status completed and screening status complete', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.SCREENING_RESPONSE_PROCESSED }];
      party.workflowName = DALTypes.WorkflowName.RENEWAL;
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

  describe('archived party with application status completed and screening status complete', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-application-status-complete-and-screening-status-complete.json');
      party.events = [{ event: DALTypes.PartyEventType.SCREENING_RESPONSE_PROCESSED }];
      party.workflowState = DALTypes.WorkflowState.ARCHIVED;
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
});
