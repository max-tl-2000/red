/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import { completeContactInfo } from '../tasks/taskDefinitions/completeContactInfo';
import { now } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';

const readFile = Promise.promisify(fs.readFile);

const loadParty = async () => {
  const text = await readFile(path.join(__dirname, 'data', 'party-with-2-residents-without-contact-info.json'), 'utf8');
  return JSON.parse(text);
};

describe('taskDefinitions/completeContactInfo', () => {
  const partyId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  describe('party with 2 party members with incomplete contact info', () => {
    describe('when both members are active', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.events = [];
      });

      describe('calling createTasks', () => {
        it('should return two tasks', async () => {
          party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(2);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });

    describe('when one of the members is removed from the party', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.members[0].partyMember.endDate = now().toDate();
        party.events = [];
      });

      describe('calling createTasks', () => {
        it('should return one task', async () => {
          party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });

    describe('for a renewal party', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.members[0].partyMember.endDate = now().toDate();
        party.workflowName = DALTypes.WorkflowName.RENEWAL;
        party.events = [];
      });

      describe('calling createTasks', () => {
        it('should return one task', async () => {
          party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });

    describe('for a active lease party', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.members[0].partyMember.endDate = now().toDate();
        party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
        party.events = [];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', async () => {
          party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
    });

    describe('for a archived party', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.members[0].partyMember.endDate = now().toDate();
        party.workflowState = DALTypes.WorkflowState.ARCHIVED;
        party.events = [];
      });

      describe('calling createTasks', () => {
        it('should return no tasks', async () => {
          party.events = [{ event: DALTypes.PartyEventType.PARTY_MEMBER_ADDED }];
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });

      describe('archiving a party with an active complete contact info task', () => {
        beforeEach(async () => {
          party = await loadParty();
          party.members[0].partyMember.endDate = now().toDate();
          party.events = [{ event: DALTypes.PartyEventType.PARTY_ARCHIVED }];
          const task = {
            id: newId(),
            name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
            category: DALTypes.TaskCategories.DRAFT,
            partyId: party.id,
            userIds: newId(),
            state: DALTypes.TaskStates.ACTIVE,
            dueDate: now().toDate(),
            metadata: {
              personId: party.members[0].person.id,
            },
          };
          party.tasks.push(task);
        });

        describe('calling createTasks', () => {
          it('should return no tasks', async () => {
            const tasks = await completeContactInfo.createTasks(ctx, party, '');
            expect(tasks).to.deep.equal([]);
          });
        });
        describe('calling completeTasks', () => {
          it('should return no tasks', async () => {
            const tasks = await completeContactInfo.completeTasks(ctx, party, '');
            expect(tasks).to.deep.equal([]);
          });
        });
        describe('calling cancelTasks', () => {
          it('should return one task', async () => {
            const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
            expect(tasks).to.have.lengthOf(1);
          });
        });
      });
    });

    describe('for a closed party', () => {
      beforeEach(async () => {
        party = await loadParty();
        party.events = [{ event: DALTypes.PartyEventType.PARTY_CLOSED }];
        const task = {
          id: newId(),
          name: DALTypes.TaskNames.COMPLETE_CONTACT_INFO,
          partyId: party.id,
          state: DALTypes.TaskStates.ACTIVE,
          dueDate: now().toDate(),
          metadata: {
            personId: party.members[0].person.id,
          },
        };
        party.tasks.push(task);
      });

      describe('calling createTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.createTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling completeTasks', () => {
        it('should return no tasks', async () => {
          const tasks = await completeContactInfo.completeTasks(ctx, party, '');
          expect(tasks).to.deep.equal([]);
        });
      });
      describe('calling cancelTasks', () => {
        it('should return one tasks', async () => {
          const tasks = await completeContactInfo.cancelTasks(ctx, party, '');
          expect(tasks).to.have.lengthOf(1);
        });
      });
    });
  });
});
