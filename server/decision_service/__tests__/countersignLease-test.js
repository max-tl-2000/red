/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import * as sinon from 'sinon';
import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';

const readFile = Promise.promisify(fs.readFile);

const loadParty = async ({
  filename,
  residentStatus = 'not_sent',
  residentStatus1 = 'not_sent',
  guarantorStatus = 'not_sent',
  countersignerStatus = 'not_sent',
  countersignerStatus1 = 'not_sent',
  userId = '',
  leaseStatus = 'submitted',
  leaseStatus1 = 'submitted',
}) => {
  const text = (await readFile(path.join(__dirname, 'data/countersignLease', filename), 'utf8'))
    .replace('RESIDENT_SIGNATURE_STATUS', residentStatus)
    .replace('RESIDENT_SIGNATURE_STATUS_1', residentStatus1)
    .replace('COUNTERSIGNER_SIGNATURE_STATUS', countersignerStatus)
    .replace('COUNTERSIGNER_SIGNATURE_STATUS_1', countersignerStatus1)
    .replace('COUNTERSIGNER_USER_ID', userId)
    .replace('GUARANTOR_SIGNATURE_STATUS', guarantorStatus)
    .replace('LEASE_STATUS_1', leaseStatus1)
    .replace('LEASE_STATUS', leaseStatus);
  const party = JSON.parse(text);
  party.events = [];
  return party;
};

const { mock } = require('test-helpers/mocker').default(jest);

describe('taskDefinitions/countersignLease', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  const LCAUser = newId();
  let party = { id: partyId };
  let countersignLease;
  let task;

  beforeEach(async () => {
    mock('../utils', () => ({
      getUsersWithLCARoleForParty: sinon.stub().returns([LCAUser]),
    }));
    const countersignLeaseModule = require('../tasks/taskDefinitions/countersignLease'); // eslint-disable-line global-require
    countersignLease = countersignLeaseModule.countersignLease;
  });

  describe('regular party', () => {
    describe('when there is 1 lease with 1 envelope', () => {
      describe('when party members did not sign', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'party-with-lease.json' });
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when party members signed', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'party-with-lease.json', residentStatus: DALTypes.LeaseSignatureStatus.SIGNED, userId: LCAUser });
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
          expect(firstTask.metadata.leaseId).to.deep.equal(party.leases[0].id);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when countersinger signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
            userId: LCAUser,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [completeTask] = tasks;
          expect(completeTask.id).to.equal(task.id);
          expect(completeTask.state).to.equal(DALTypes.TaskStates.COMPLETED);
          expect(completeTask.metadata.completedBy).to.equal(LCAUser);
        });

        describe('when task is already completed, calling completeTasks', () => {
          it('should return no task to complete', async () => {
            task.state = DALTypes.TaskStates.COMPLETED;
            const tasks = await countersignLease.completeTasks(ctx, party);
            expect(tasks).to.have.lengthOf(0);
          });
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when lease is voided with COUNTERSIGN Task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
          });

          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task to cancel', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [cancelTask] = tasks;
          expect(cancelTask.id).to.equal(task.id);
          expect(cancelTask.state).to.equal(DALTypes.TaskStates.CANCELED);
        });
      });

      describe('when lease is voided and no task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
          });
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasksshould return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });

    describe('when there is 1 lease with 2 envelopes', () => {
      describe('when party members did not sign', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'party-with-lease-and-2-envelopes.json' });
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when residents signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
          });
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
          expect(firstTask.metadata.leaseId).to.deep.equal(party.leases[0].id);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when guarantor signed but there is already a task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            guarantorStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when guarantor signed but there is a task completed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            guarantorStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.COMPLETED,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
          expect(firstTask.metadata.leaseId).to.deep.equal(party.leases[0].id);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when countersinger signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [completeTask] = tasks;
          expect(completeTask.id).to.equal(task.id);
          expect(completeTask.state).to.equal(DALTypes.TaskStates.COMPLETED);
          expect(completeTask.metadata.completedBy).to.equal(LCAUser);
        });

        describe('when task is already completed, calling completeTasks', () => {
          it('should return no task to complete', async () => {
            task.state = DALTypes.TaskStates.COMPLETED;
            const tasks = await countersignLease.completeTasks(ctx, party);
            expect(tasks).to.have.lengthOf(0);
          });
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when only countersinger for residents signed and the guarantor already signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            guarantorStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        describe('when task is already completed, calling completeTasks', () => {
          it('should return no task to complete', async () => {
            task.state = DALTypes.TaskStates.COMPLETED;
            const tasks = await countersignLease.completeTasks(ctx, party);
            expect(tasks).to.have.lengthOf(0);
          });
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when all countersingers signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            guarantorStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [completeTask] = tasks;
          expect(completeTask.id).to.equal(task.id);
          expect(completeTask.state).to.equal(DALTypes.TaskStates.COMPLETED);
          expect(completeTask.metadata.completedBy).to.equal(LCAUser);
        });

        describe('when task is already completed, calling completeTasks', () => {
          it('should return no task to complete', async () => {
            task.state = DALTypes.TaskStates.COMPLETED;
            const tasks = await countersignLease.completeTasks(ctx, party);
            expect(tasks).to.have.lengthOf(0);
          });
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when lease is voided with COUNTERSIGN Task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            residentStatus1: DALTypes.LeaseSignatureStatus.VOIDED,
            guarantorStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            countersignerStatus1: DALTypes.LeaseSignatureStatus.VOIDED,
          });

          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task to cancel', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [cancelTask] = tasks;
          expect(cancelTask.id).to.equal(task.id);
          expect(cancelTask.state).to.equal(DALTypes.TaskStates.CANCELED);
        });
      });

      describe('when lease is voided and no task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease-and-2-envelopes.json',
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
          });
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });
  });

  describe('corporate party', () => {
    describe('when there are 2 leases with 1 envelopes each', () => {
      describe('when party members did not sign', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'corporate-party-with-2-leases.json' });
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when party member signed first lease', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'corporate-party-with-2-leases.json', residentStatus: DALTypes.LeaseSignatureStatus.SIGNED, userId: LCAUser });
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
        });
      });

      describe('when party member signed both leases', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
          });
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
        });

        describe('calling createTasks when one task is already active', () => {
          beforeEach(() => {
            task = {
              id: newId(),
              name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
              category: DALTypes.TaskCategories.CONTRACT_SIGNING,
              partyId: party.id,
              userIds: [LCAUser],
              state: DALTypes.TaskStates.ACTIVE,
              dueDate: now().toDate(),
            };
            party.tasks.push(task);
          });

          it('should return no task to be created', async () => {
            const tasks = await countersignLease.createTasks(ctx, party, '');
            expect(tasks).to.have.lengthOf(0);
          });
        });
      });

      describe('when user countersigned one lease and the second lease is submitted', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SENT,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
            userId: LCAUser,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });
      });

      describe('when one lease is executed then the second one is signed by residents', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.COMPLETED,
            dueDate: now().toDate(),
            metadata: {
              completedLeases: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
        });

        it('calling completeTasks should return no task', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });
      });

      describe('when user countersigned both leases', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
            leaseStatus1: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);
          const [completeTask] = tasks;
          expect(completeTask.id).to.equal(task.id);
          expect(completeTask.state).to.equal(DALTypes.TaskStates.COMPLETED);
          expect(completeTask.metadata.completedBy).to.equal(LCAUser);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });
      });

      describe('when task is completed and both leases are countersigned', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            residentStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus1: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
            leaseStatus1: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.COMPLETED,
            dueDate: now().toDate(),
            metadata: {
              completedLeases: party.leases.map(lease => lease.id),
            },
          };
          party.tasks.push(task);
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });
      });

      describe('when both leases are voided with task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'corporate-party-with-2-leases.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            residentStatus1: DALTypes.LeaseSignatureStatus.VOIDED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            countersignerStatus1: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
            leaseStatus1: DALTypes.LeaseStatus.VOIDED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED }];
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [cancelledTask] = tasks;
          expect(cancelledTask.id).to.equal(task.id);
          expect(cancelledTask.state).to.equal(DALTypes.TaskStates.CANCELED);
        });
      });
    });
  });

  describe('renewal party', () => {
    describe('when there is 1 lease with 1 envelope', () => {
      describe('when party members signed', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'party-with-lease.json', residentStatus: DALTypes.LeaseSignatureStatus.SIGNED, userId: LCAUser });
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return one task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
          const [firstTask] = tasks;
          expect(firstTask.name).to.deep.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(firstTask.category).to.deep.equal(DALTypes.TaskCategories.CONTRACT_SIGNING);
          expect(firstTask.partyId).to.deep.equal(party.id);
          expect(firstTask.userIds).to.deep.equal([LCAUser]);
          expect(firstTask.state).to.deep.equal(DALTypes.TaskStates.ACTIVE);
          expect(firstTask.metadata.leaseId).to.deep.equal(party.leases[0].id);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when countersinger signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return one task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [completeTask] = tasks;
          expect(completeTask.id).to.equal(task.id);
          expect(completeTask.state).to.equal(DALTypes.TaskStates.COMPLETED);
          expect(completeTask.metadata.completedBy).to.equal(LCAUser);
        });

        describe('when task is already completed, calling completeTasks', () => {
          it('should return no task to complete', async () => {
            task.state = DALTypes.TaskStates.COMPLETED;
            const tasks = await countersignLease.completeTasks(ctx, party);
            expect(tasks).to.have.lengthOf(0);
          });
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when lease is voided with COUNTERSIGN Task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
          });

          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task to cancel', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);

          const [cancelTask] = tasks;
          expect(cancelTask.id).to.equal(task.id);
          expect(cancelTask.state).to.equal(DALTypes.TaskStates.CANCELED);
        });
      });
    });
  });

  describe('archived party', () => {
    describe('when there is 1 lease with 1 envelope', () => {
      describe('when party members signed', () => {
        beforeEach(async () => {
          party = await loadParty({ filename: 'party-with-lease.json', residentStatus: DALTypes.LeaseSignatureStatus.SIGNED, userId: LCAUser });
          party.workflowState = DALTypes.WorkflowState.ARCHIVED;
          party.events = [
            { event: DALTypes.PartyEventType.LEASE_SIGNED, metadata: { leaseId: party.leases[0].id, envelopeId: party.leases[0].signatures[0].envelopeId } },
          ];
        });

        it('calling createTasks should return no tasks', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling completeTasks should return no tasks', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when countersinger signed', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.SIGNED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.EXECUTED,
          });
          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.workflowState = DALTypes.WorkflowState.ARCHIVED;
          party.events = [{ event: DALTypes.PartyEventType.LEASE_COUNTERSIGNED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to be completed', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return no tasks', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('when lease is voided with COUNTERSIGN Task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
          });

          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.workflowState = DALTypes.WorkflowState.ARCHIVED;
          party.events = [{ event: DALTypes.PartyEventType.LEASE_VOIDED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task to cancel', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);
        });
      });

      describe('archiving a party with COUNTERSIGN Task active', () => {
        beforeEach(async () => {
          party = await loadParty({
            filename: 'party-with-lease.json',
            residentStatus: DALTypes.LeaseSignatureStatus.VOIDED,
            userId: LCAUser,
            leaseStatus: DALTypes.LeaseStatus.VOIDED,
            countersignerStatus: DALTypes.LeaseSignatureStatus.VOIDED,
          });

          task = {
            id: newId(),
            name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
            category: DALTypes.TaskCategories.CONTRACT_SIGNING,
            partyId: party.id,
            userIds: [LCAUser],
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              leaseId: party.leases[0].id,
            },
          };
          party.tasks.push(task);
          party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
        });

        it('calling createTasks should return no task to be created', async () => {
          const tasks = await countersignLease.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling completeTasks should return no task to complete', async () => {
          const tasks = await countersignLease.completeTasks(ctx, party);
          expect(tasks).to.have.lengthOf(0);
        });

        it('calling cancelTasks should return one task to cancel', async () => {
          const tasks = await countersignLease.cancelTasks(ctx, party);
          expect(tasks).to.have.lengthOf(1);
        });
      });
    });
  });
});
