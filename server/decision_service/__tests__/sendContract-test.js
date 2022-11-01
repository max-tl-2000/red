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
import { sendContract } from '../tasks/taskDefinitions/sendContract';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/sendContract', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/sendContract', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const shouldBeCreated = async () => await sendContract.createTasks(ctx, party);
  const shouldBeCompleted = async () => await sendContract.completeTasks(ctx, party);
  const shouldBeCanceled = async () => await sendContract.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.SEND_CONTRACT);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());

  const zeroTasksShouldBeCompleted = async () => zeroTasks(await shouldBeCompleted());
  const oneTaskShouldBeCompleted = async () => oneTask(await shouldBeCompleted());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('creating a quote promotion, if the status is canceled', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-quote-promotion.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', leaseId: 'leaseTestId1' } }];
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

  describe('creating a quote promotion, if the status is approved', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-quote-promotion.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', leaseId: 'leaseTestId1' } }];
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('creating a second quote promotion, if the status is approved', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-quote-promotion.json');
      party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', leaseId: 'leaseTestId1' } }];
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when a lease is voided, and we have any signature mailed', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED, metadata: { leaseId: 'leaseTestId' } }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete a Send Contract task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when a lease is sent', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_SENT, metadata: { leaseId: 'leaseTestId' } }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete a Send Contract task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when a lease is signed', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: 'leaseTestId' } }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should complete a Send Contract task', oneTaskShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCanceled);
    });
  });

  describe('when a lease is voided and the send contract task was not created for the voided lease', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED, metadata: { leaseId: 'anotherLeaseId' } }];
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

  describe('when a lease is sent and the send contract task was not created for the sended lease', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_SENT, metadata: { leaseId: 'anotherLeaseId' } }];
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

  describe('when a lease is signed and the send contract task was not created for the signed lease', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: 'anotherLeaseId' } }];
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

  describe('when a lease is voided, and we do not have any signature mailed', () => {
    beforeEach(async () => {
      party = await loadJson('party-without-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED, metadata: { leaseId: 'leaseTestId' } }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel a Send Contract task', oneTasksShouldBeCanceled);
    });
  });

  describe('when a party is closed', () => {
    beforeEach(async () => {
      party = await loadJson('party-without-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
    });

    describe('calling createTasks', () => {
      it('should return no task', zeroTasksShouldBeCreated);
    });

    describe('calling completeTasks', () => {
      it('should return no tasks', zeroTasksShouldBeCompleted);
    });

    describe('calling cancelTasks', () => {
      it('should cancel a Send Contract task', oneTasksShouldBeCanceled);
    });
  });

  describe('when a party is archived', () => {
    beforeEach(async () => {
      party = await loadJson('party-without-signature-mailed.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling completeTasks', () => it('should return no tasks', zeroTasksShouldBeCompleted));

    describe('calling cancelTasks', () => it('should cancel a Send Contract task', oneTasksShouldBeCanceled));
  });
});
