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
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { createATask, createAUser, createAParty, createATeam, createAProperty, createATeamProperty, createATeamMember } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';

const readFile = promisify(fs.readFile);

const loadJson = async filename => {
  const text = await readFile(path.join(__dirname, '../__tests__/data/sendContract', filename), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/sendContract', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = tenant;

  const shouldBeCreated = async () => await sendContract.createTasks(ctx, party);

  const oneTask = tasks => {
    expect(tasks).to.have.lengthOf(1);
    expect(tasks[0].name).to.equal(DALTypes.TaskNames.SEND_CONTRACT);
  };

  const zeroTasks = tasks => expect(tasks).to.deep.equal([]);

  const zeroTasksShouldBeCreated = async () => zeroTasks(await shouldBeCreated());
  const oneTaskShouldBeCreated = async () => oneTask(await shouldBeCreated());

  describe('creating a quote promotion, if the status is approved', () => {
    describe('calling createTasks', () => {
      beforeEach(async () => {
        party = await loadJson('party-with-quote-promotion.json');
        party.events = [{ event: DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED, metadata: { quotePromotionId: 'testId', leaseId: 'leaseTestId1' } }];
      });

      describe('when a Send Contract task already exists', () => {
        it('should return no tasks', async () => {
          const { id: userId } = await createAUser();
          const { id: partyIdTest } = await createAParty({
            leaseType: DALTypes.LeaseType.CORPORATE,
          });
          party.id = partyIdTest;
          party.userId = userId;

          const task = await createATask({
            userIds: [party.userId],
            partyId: party.id,
            name: DALTypes.TaskNames.SEND_CONTRACT,
            state: DALTypes.TaskStates.ACTIVE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            metadata: { leases: ['leaseTestId2'] },
          });
          party.tasks = [task];
          await zeroTasksShouldBeCreated();
        });
      });

      describe('when a Send Contract task do not exist,', () => {
        it('should create a Send Contract task', async () => {
          const { id: userId } = await createAUser();

          const { id: teamId } = await createATeam();

          await createATeamMember({
            teamId,
            userId,
            roles: {
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
            },
          });
          const { id: propertyId } = await createAProperty();
          await createATeamProperty(teamId, propertyId);

          party.assignedPropertyId = propertyId;
          await oneTaskShouldBeCreated();
        });
      });

      describe('for a renewal party,', () => {
        it('should create a Send Contract task', async () => {
          const { id: userId } = await createAUser();

          const { id: teamId } = await createATeam();

          await createATeamMember({
            teamId,
            userId,
            roles: {
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
            },
          });
          const { id: propertyId } = await createAProperty();
          await createATeamProperty(teamId, propertyId);

          party.assignedPropertyId = propertyId;
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          await oneTaskShouldBeCreated();
        });
      });

      describe('for an archived party,', () => {
        it('should not create a Send Contract task', async () => {
          const { id: userId } = await createAUser();

          const { id: teamId } = await createATeam();

          await createATeamMember({
            teamId,
            userId,
            roles: {
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
            },
          });
          const { id: propertyId } = await createAProperty();
          await createATeamProperty(teamId, propertyId);

          party.workflowState = DALTypes.WorkflowState.ARCHIVED;
          party.assignedPropertyId = propertyId;
          await zeroTasksShouldBeCreated();
        });
      });
    });
  });
});
