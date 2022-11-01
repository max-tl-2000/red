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
import { reviewApplication } from '../tasks/taskDefinitions/reviewApplication';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/reviewApplication', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/reviewApplication', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const shouldBeCreated = async () => await reviewApplication.createTasks(ctx, party);
  const shouldBeCompleted = async () => await reviewApplication.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await reviewApplication.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.REVIEW_APPLICATION);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTasksShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('requesting review application on a party with pending quote promotion', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-pending-promoted-quote.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', handleReviewApplicationTask: true } }];
    });

    describe('calling createTasks', () => {
      it('should return one tasks', oneTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('requesting review application on a party without pending quote promotion', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-pending-promoted-quote.json');
      party.promotions = [];
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', handleReviewApplicationTask: true } }];
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

  describe('requesting review application on a party with quote promotion that is not in pending state', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-pending-promoted-quote.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', handleReviewApplicationTask: true } }];
      party.promotions[0].promotionStatus = 'canceled';
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

  describe('when requesting demote application', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-review-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.DEMOTE_APPLICATION }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return one tasks', oneTasksShouldBeCanceled);
    });
  });

  describe('when application is updated by an agent', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-review-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED, userId: 'userId' }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return one tasks', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when application is updated but not by an agent', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-review-application-task.json');
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

  describe('archiving a party with an active task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-review-application-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no tasks', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should return one task', oneTasksShouldBeCanceled));
  });
});
