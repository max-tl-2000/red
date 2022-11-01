/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getUsersWithAssignedTasksForParties } from '../tasksRepo';
import { testCtx as ctx, createAParty, createATask } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('dal/tasksRepo', () => {
  const createFollowupPartyTask = partyId => ({
    name: DALTypes.TaskNames.FOLLOWUP_PARTY,
    category: DALTypes.TaskCategories.INACTIVE,
    partyId,
  });

  const createIntroduceYourselfTask = partyId => ({
    name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
    partyId,
  });

  describe('when having a party with a task created for it', () => {
    it('should return the user', async () => {
      const party1 = await createAParty();
      const task = await createATask(createFollowupPartyTask(party1.id));

      const users = await getUsersWithAssignedTasksForParties(ctx, [party1.id]);
      expect(users.length).to.equal(1);
      expect(users).to.deep.equal(task.userIds);
    });
  });

  describe('when having a party with multiple tasks created for it', () => {
    it('should return all the tasks', async () => {
      const party1 = await createAParty();
      const party2 = await createAParty();
      const firstTask = await createATask(createFollowupPartyTask(party1.id));
      const secondTask = await createATask(createIntroduceYourselfTask(party2.id));
      const users = await getUsersWithAssignedTasksForParties(ctx, [party1.id, party2.id]);

      expect(users.length).to.equal(2);
      expect(users).to.include(firstTask.userIds[0]);
      expect(users).to.include(secondTask.userIds[0]);
    });
  });
});
