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
import { contactPartyDeclinedDecision } from '../tasks/taskDefinitions/contactPartyDeclinedDecision';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/contactPartyDeclinedDecision', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/contactPartyDeclinedDecision', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const createdTasks = async () => await contactPartyDeclinedDecision.createTasks(ctx, party);
  const cancelledTasks = async () => await contactPartyDeclinedDecision.cancelTasks(ctx, party);

  const expectToHaveOneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION);
  };

  const expectToHaveNoTask = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => expectToHaveNoTask(await createdTasks());
  const oneTasksShouldBeCreated = async () => expectToHaveOneTask(await createdTasks());

  const zeroTasksShouldBeCanceled = async () => expectToHaveNoTask(await cancelledTasks());
  const oneTasksShouldBeCanceled = async () => expectToHaveOneTask(await cancelledTasks());

  describe('receiving a declined application without an event that triggers the task creation', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.SCREENING_RESPONSE_PROCESSED }];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('receiving a declined application on a renewal party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.workflowName = DALTypes.WorkflowName.RENEWAL;
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED, metadata: { createDeclinedTask: true, skipEmail: true } }];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('receiving a declined application on a traditional party without requesting to create the declined task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED, metadata: { createDeclinedTask: false, skipEmail: true } }];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('receiving a declined application on a traditional party with an active contact party declined application task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED, metadata: { createDeclinedTask: true, skipEmail: true } }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
          category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('receiving a declined application on a traditional party requesting to create declined task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED, metadata: { createDeclinedTask: true, skipEmail: true } }];
    });

    it('calling createTasks should return one task', oneTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('reopening a party with a declined application requesting to not create the contact party for declined decision', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_REOPENED, metadata: { createDeclinedTask: false, skipEmail: true } }];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('reopening a party with a declined application requesting to create the contact party for declined decision', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_REOPENED, metadata: { createDeclinedTask: true, skipEmail: true } }];
    });

    it('calling createTasks should return one task', oneTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('closing a party with no contact party declined decision task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return no task', zeroTasksShouldBeCanceled);
  });

  describe('closing a party with contact party declined decision task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
          category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return one task', oneTasksShouldBeCanceled);
  });

  describe('archiving a party with contact party declined decision task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-declined-application.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
      party.tasks = [
        {
          id: newId(),
          name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
          category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
          partyId: party.id,
          userIds: [party.userId],
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
        },
      ];
    });

    it('calling createTasks should return no task', zeroTasksShouldBeCreated);

    it('calling cancelTasks should return one task', oneTasksShouldBeCanceled);
  });
});
