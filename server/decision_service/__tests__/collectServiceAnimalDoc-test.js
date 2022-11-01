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
import { collectServiceAnimalDoc } from '../tasks/taskDefinitions/collectServiceAnimalDoc';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, 'data/collectServiceAnimalDoc', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/collectServiceAnimalDoc', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = { tenantId: newId() };

  const shouldBeCreated = async () => await collectServiceAnimalDoc.createTasks(ctx, party);
  const shouldBeCanceled = async () => await collectServiceAnimalDoc.cancelTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.COLLECT_SERVICE_ANIMAL_DOC);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTasksShouldBeCreated = async () => oneTask(await shouldBeCreated());

  const zeroTasksShouldBeCanceled = async () => zeroTasks(await shouldBeCanceled());
  const oneTasksShouldBeCanceled = async () => oneTask(await shouldBeCanceled());

  describe('adding a service animal in a party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-no-collect-service-animal-doc-task.json');
      party.events = [{ event: DALTypes.PartyEventType.SERVICE_ANIMAL_ADDED }];
    });

    describe('calling createTasks', () => it('should return one task', oneTasksShouldBeCreated));

    describe('calling cancelTasks', () => it('should return no task', zeroTasksShouldBeCanceled));
  });

  describe('removing all service animals from a party', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-collect-service-animal-doc-task.json');
      party.events = [{ event: DALTypes.PartyEventType.ALL_SERVICE_ANIMALS_REMOVED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling cancelTasks', () => it('should return one task', oneTasksShouldBeCanceled));
  });

  describe('archiving a party with an active task', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-collect-service-animal-doc-task.json');
      party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling cancelTasks', () => it('should return one task', oneTasksShouldBeCanceled));
  });

  describe('when a task is already created', () => {
    beforeEach(async () => {
      party = await loadJson('party-with-collect-service-animal-doc-task.json');
      party.events = [{ event: DALTypes.PartyEventType.SERVICE_ANIMAL_ADDED }];
    });

    describe('calling createTasks', () => it('should return no task', zeroTasksShouldBeCreated));

    describe('calling cancelTasks', () => it('should return no task', zeroTasksShouldBeCanceled));
  });
});
