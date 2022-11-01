/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import config from '../config';
import { waitFor, setupQueueToWaitFor } from '../../testUtils/apiHelper';
import { setupConsumers, clean } from '../consumer';
import { chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { APP_EXCHANGE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import * as partyService from '../../services/party';
import { DALTypes } from '../../../common/enums/DALTypes';
import {
  testCtx as ctx,
  createAParty,
  createAPerson,
  createACommunicationEntry,
  createATask,
  createAPartyMember,
  createAnAppointment,
  createAUser,
  createATeam,
  createAProperty,
  createActiveLeaseData,
} from '../../testUtils/repoHelper';
import { getTasks, getTasksByName, updateTasks } from '../../dal/tasksRepo';
import { updateParty } from '../../dal/partyRepo';
import { getActivityLogs } from '../../dal/activityLogRepo';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { now } from '../../../common/helpers/moment-utils';
import { saveRecurringJob, updateRecurringJob } from '../../dal/jobsRepo';

const createFollowupPartyTask = partyId => ({
  name: DALTypes.TaskNames.FOLLOWUP_PARTY,
  category: DALTypes.TaskCategories.INACTIVE,
  partyId,
});

const createIntroduceYourselfPartyTask = partyId => ({
  name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
  category: DALTypes.TaskCategories.PARTY,
  partyId,
});

const createSendRenewalQuoteTask = partyId => ({
  name: DALTypes.TaskNames.SEND_RENEWAL_QUOTE,
  category: DALTypes.TaskCategories.INACTIVE,
  partyId,
});

const createSendRenewalReminderTask = partyId => ({
  name: DALTypes.TaskNames.SEND_RENEWAL_REMINDER,
  category: DALTypes.TaskCategories.INACTIVE,
  partyId,
});

const createNotifyConditionalApproval = partyId => ({
  name: DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL,
  category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
  partyId,
  metadata: {
    conditions: {
      additionalNotes: 'notes',
    },
  },
});

const inventoryHoldMetadata = {
  inventoryName: '1009',
  holdDepositPayer: { preferredName: 'Anna', fullName: 'Anna Clark' },
};

const createPlaceInventoryHoldTask = partyId => ({
  name: DALTypes.TaskNames.HOLD_INVENTORY,
  category: DALTypes.TaskCategories.PARTY,
  partyId,
  metadata: { ...inventoryHoldMetadata },
});

describe('/taskHandler', () => {
  const tasksWorkerConfig = config.workerConfig.tasks;
  const PROCESS_ON_DEMAND = Object.keys(tasksWorkerConfig.topics)[0];
  const COMPLETE_ON_DEMAND = Object.keys(tasksWorkerConfig.topics)[1];
  const CANCEL_ON_DEMAND = Object.keys(tasksWorkerConfig.topics)[2];
  const moveoutNoticePeriod = 60;
  let thePromises;
  let party;
  let person;
  let activeLeaseWorkflowParty;
  let taskFollowupRecurringJob;

  beforeEach(async () => {
    const { id } = await createAUser();

    taskFollowupRecurringJob = await saveRecurringJob(ctx, { name: DALTypes.Jobs.TasksFollowupParty, inactiveSince: null });
    const property = await createAProperty({ residentservices: { moveoutNoticePeriod } });
    party = await createAParty({ userId: id, assignedPropertyId: property.id });
    person = await createAPerson();
    const condition = msg => msg.id === 'test';
    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    thePromises = promises;
    await setupConsumers(chan(), matcher, ['tasks']);
  });

  const updatePartyForFollowUpTask = async () => {
    const team = await createATeam({
      name: 'TestTeam',
      module: 'leasing',
      email: 'leasing_email',
      phone: '16504375757',
      metadata: {},
    });
    const partyCreationDate = now().add(-2, 'days').toDate();
    await updateParty(ctx, {
      id: party.id,
      created_at: partyCreationDate,
      teams: [team.id],
      workflowName: DALTypes.WorkflowName.NEW_LEASE,
      workflowState: DALTypes.WorkflowState.ACTIVE,
    });
  };

  const createActiveLeaseWfParty = async (leaseEndDate = now()) => {
    activeLeaseWorkflowParty = await createAParty({ workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
    await createActiveLeaseData({ partyId: activeLeaseWorkflowParty.id, leaseData: { leaseEndDate } });
  };

  const updatePartyForSendRenewalTask = async leaseEndDate => {
    const team = await createATeam({
      name: 'TestTeam',
      module: 'leasing',
      email: 'leasing_email',
      phone: '16504375757',
      metadata: {},
    });

    await createActiveLeaseWfParty(leaseEndDate);

    await updateParty(ctx, {
      id: party.id,
      teams: [team.id],
      seedPartyId: activeLeaseWorkflowParty.id,
      workflowName: DALTypes.WorkflowName.RENEWAL,
      workflowState: DALTypes.WorkflowState.ACTIVE,
    });
  };

  const updateActiveLeaseData = async leaseEndDate => await createActiveLeaseData({ partyId: activeLeaseWorkflowParty.id, leaseData: { leaseEndDate } });

  const cancelAllTasks = async tasks =>
    await updateTasks(
      ctx,
      tasks.map(task => ({ id: task.id, state: DALTypes.TaskStates.CANCELED })),
    );

  const completeAllTasks = async tasks =>
    await updateTasks(
      ctx,
      tasks.map(task => ({ id: task.id, state: DALTypes.TaskStates.COMPLETED })),
    );

  const assertTask = async (tasks, partyId, name, existingTaskId, state = DALTypes.TaskStates.ACTIVE) => {
    expect(tasks.length).to.equal(1);
    expect(tasks[0].name).to.equal(name);
    expect(tasks[0].partyId).to.equal(partyId);
    expect(tasks[0].state).to.equal(state);

    existingTaskId && expect(tasks[0].id).to.equal(existingTaskId);
  };

  const setupTasks = async message => {
    await sendMessage({ ...message });
    await Promise.all(thePromises);
    return await getTasks(ctx);
  };

  const buildTasksMessage = ({ partyId, tasks, msgMetadata = {}, userId, key = PROCESS_ON_DEMAND }) => ({
    exchange: APP_EXCHANGE,
    key,
    message: {
      id: 'test',
      tenantId: ctx.tenantId,
      userId,
      tasks: [...tasks],
      partyIds: [partyId],
      metadata: { ...msgMetadata },
    },
  });

  describe('given a request to process the tasks', () => {
    it('the task engine will be called', async () => {
      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });

      const result = await Promise.all(thePromises);
      expect(result.every(p => p)).to.be.true;
    });
  });

  describe('given a request to process the tasks', () => {
    it('saves and logs the party owner, created by and assigned to', async () => {
      const partyOwner = await createAUser({ name: 'the party owner' });
      const theParty = await createAParty({ userId: partyOwner.id });

      const createdBy = await createAUser({ name: 'task creator' });

      const taskMessage = buildTasksMessage({ partyId: theParty.id, tasks: [DALTypes.TaskNames.HOLD_INVENTORY], userId: createdBy.id });
      const tasks = await setupTasks(taskMessage);
      const [{ metadata: data }] = tasks;

      expect(data.originalPartyOwner).to.equal(partyOwner.id);
      expect(data.originalAssignees).to.deep.equal([partyOwner.id]);
      expect(data.createdBy).to.equal(createdBy.id);

      const { details } = (await getActivityLogs(ctx)).find(l => l.type === ACTIVITY_TYPES.NEW && l.component === COMPONENT_TYPES.TASK);

      expect(details.partyOwner).to.equal(partyOwner.fullName);
      expect(details.assignee).to.equal(partyOwner.fullName);
      expect(details.createdBy).to.equal(createdBy.fullName);
    });
  });

  describe('given the Followup with Party task', () => {
    it('a new task will be created when we have no communications or appointments', async () => {
      await updatePartyForFollowUpTask();

      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }));

      await assertTask(allTasks, party.id, DALTypes.TaskNames.FOLLOWUP_PARTY);
    });
  });

  describe('given the Followup with Party task', () => {
    it('a new task will not be created when we have a recent communication', async () => {
      await updatePartyForFollowUpTask();

      await createACommunicationEntry({
        parties: [party.id],
        persons: [person.id],
      });
      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }));

      expect(allTasks.length).to.equal(0);
    });
  });

  describe('given the Followup with Party task', () => {
    it('a new task will not be created when we have a recent appointment', async () => {
      const user = await createAUser();
      await updatePartyForFollowUpTask();

      await createAnAppointment({
        salesPersonId: user.id,
        partyId: party.id,
        state: DALTypes.TaskStates.ACTIVE,
      });
      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });
  });

  describe('given the Followup with Party task', () => {
    it('a new task will not be created when the party is in future resident state', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        state: DALTypes.PartyStateType.FUTURERESIDENT,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party is in RESIDENT state', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        state: DALTypes.PartyStateType.RESIDENT,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party has any other active tasks', async () => {
      await updatePartyForFollowUpTask();
      const existingTask = await createATask(createFollowupPartyTask(party.id));

      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }));
      expect(allTasks.length).to.equal(1);
      expect(allTasks[0].id).to.equal(existingTask.id);
    });

    it('a new task will not be created for a corporate party', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        leaseType: DALTypes.LeaseType.CORPORATE,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party workflow name is renewal', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        workflowName: DALTypes.WorkflowName.RENEWAL,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party workflow name is resident', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party workflow state is archived', async () => {
      await updatePartyForFollowUpTask();
      await updateParty(ctx, {
        id: party.id,
        workflowName: DALTypes.WorkflowName.NEW_LEASE,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
      });

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.FOLLOWUP_PARTY);
      expect(allTasks.length).to.equal(0);
    });
  });

  describe('archiving an existing active workflow with an active Followup party task', () => {
    it('the task will be marked as canceled when the corresponding event is triggered', async () => {
      await clean(chan(), true);
      await updatePartyForFollowUpTask();
      const existingTask = await createATask(createFollowupPartyTask(party.id));

      const authUser = await createAUser();
      const newCtx = { ...ctx, authUser };
      const condition = msg => msg.partyId === party.id;

      const { task } = await setupQueueToWaitFor([condition], ['tasks']);

      await partyService.archiveParty(newCtx, { partyId: party.id, archiveReasonId: DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY });

      await task;

      const allTasks = await getTasks(newCtx);
      await assertTask(allTasks, party.id, DALTypes.TaskNames.FOLLOWUP_PARTY, existingTask.id, DALTypes.TaskStates.CANCELED);
      expect(allTasks.length).to.equal(1);
    });
  });

  describe('given an existing active Followup with Party task', () => {
    it('a new task will not be created for the same party', async () => {
      await updatePartyForFollowUpTask();

      const existingTask = await createATask(createFollowupPartyTask(party.id));
      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY] }));

      expect(allTasks.length).to.equal(1);
      expect(allTasks[0].id).to.equal(existingTask.id);
    });
  });

  describe('given an existing active Followup with Party task', () => {
    it('the task will be marked as completed when the corresponding event is triggered', async () => {
      await updatePartyForFollowUpTask();

      const existingTask = await createATask(createFollowupPartyTask(party.id));
      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY], key: COMPLETE_ON_DEMAND }));

      await assertTask(allTasks, party.id, DALTypes.TaskNames.FOLLOWUP_PARTY, existingTask.id, DALTypes.TaskStates.COMPLETED);
      expect(allTasks[0].completionDate).to.not.be.null;
    });

    it('the task will be ignored when the event completed or canceled event is triggered when the TasksFollowupParty recurring job is inactive', async () => {
      await updateRecurringJob(ctx, taskFollowupRecurringJob.id, { ...taskFollowupRecurringJob, inactiveSince: now().toJSON() });

      await updatePartyForFollowUpTask();

      const existingTask = await createATask(createFollowupPartyTask(party.id));
      let allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY], key: COMPLETE_ON_DEMAND }));

      await assertTask(allTasks, party.id, DALTypes.TaskNames.FOLLOWUP_PARTY, existingTask.id, DALTypes.TaskStates.ACTIVE);
      expect(allTasks[0].completionDate).to.be.null;

      const introduceYourselfTask = await createATask(createIntroduceYourselfPartyTask(party.id));

      allTasks = await setupTasks(
        buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.INTRODUCE_YOURSELF, DALTypes.TaskNames.FOLLOWUP_PARTY], key: CANCEL_ON_DEMAND }),
      );

      await assertTask([allTasks[0]], party.id, DALTypes.TaskNames.FOLLOWUP_PARTY, existingTask.id, DALTypes.TaskStates.ACTIVE);
      await assertTask([allTasks[1]], party.id, DALTypes.TaskNames.INTRODUCE_YOURSELF, introduceYourselfTask.id, DALTypes.TaskStates.ACTIVE);
      expect(allTasks.length).to.equal(2);
    });
  });

  describe('given the Notify Conditional Approval task', () => {
    describe('given the create event ', () => {
      it('a new task will be created when the corresponding event is triggered', async () => {
        const allTasks = await setupTasks(
          buildTasksMessage({
            partyId: party.id,
            tasks: [DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL],
            msgMetadata: { conditions: { additonalNotes: 'approved conditions' } },
          }),
        );

        await assertTask(allTasks, party.id, DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL);
      });
    });

    describe('given an existing Notify Conditional Approval task', () => {
      it('a new task will NOT be created for the same party', async () => {
        const existingTask = await createATask(createNotifyConditionalApproval(party.id));
        const allTasks = await setupTasks(
          buildTasksMessage({
            partyId: party.id,
            tasks: [DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL],
            msgMetadata: { conditions: { additonalNotes: 'approved conditions' } },
          }),
        );

        await assertTask(allTasks, party.id, DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL, existingTask.id);
      });
    });

    describe('given an existing active Notify Conditional Approval task', () => {
      it('the task will be marked as completed when the corresponding event is triggered', async () => {
        const existingTask = await createATask(createNotifyConditionalApproval(party.id));
        const allTasks = await setupTasks(
          buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL], key: COMPLETE_ON_DEMAND }),
        );

        await assertTask(allTasks, party.id, DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL, existingTask.id, DALTypes.TaskStates.COMPLETED);
        expect(allTasks[0].completionDate).to.not.be.null;
      });
    });

    describe('archiving an existing active workflow with an active Notify Conditional Approval party task', () => {
      it('the task will be marked as canceled when the corresponding event is triggered', async () => {
        await clean(chan(), true);
        const existingTask = await createATask(createNotifyConditionalApproval(party.id));

        const authUser = await createAUser();
        const newCtx = { ...ctx, authUser };
        const condition = msg => msg.partyId === party.id;

        const { task } = await setupQueueToWaitFor([condition], ['tasks']);

        await partyService.archiveParty(newCtx, { partyId: party.id, archiveReasonId: DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY });
        await task;

        const allTasks = await getTasks(newCtx);
        await assertTask(allTasks, party.id, DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL, existingTask.id, DALTypes.TaskStates.CANCELED);
        expect(allTasks.length).to.equal(1);
      });
    });
  });

  describe('given the tasks(followupParty, appointment, notifyConditionalApproval) that belong to the same party', () => {
    it('the tasks will be marked as canceled when the corresponding event is triggered', async () => {
      const user = await createAUser();
      await createAPartyMember(party.id, {
        fullName: 'Oliver Queen',
      });
      await createATask(createFollowupPartyTask(party.id));
      await createATask(createNotifyConditionalApproval(party.id));
      await createAnAppointment({
        salesPersonId: user.id,
        partyId: party.id,
        state: DALTypes.TaskStates.ACTIVE,
        startDate: new Date('12-14-2025 16:30:00'),
        endDate: new Date('12-14-2025 17:30:00'),
      });

      let allTasks = await getTasks(ctx);
      expect(allTasks.length).to.equal(3);

      await sendMessage({
        exchange: APP_EXCHANGE,
        key: CANCEL_ON_DEMAND,
        message: {
          id: 'test',
          tenantId: ctx.tenantId,
          tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY, DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL, DALTypes.TaskNames.APPOINTMENT],
          partyId: party.id,
        },
      });
      await Promise.all(thePromises);

      allTasks = await getTasks(ctx);
      expect(allTasks.length).to.equal(3);
      allTasks.forEach(t => expect(t.state).to.equal(DALTypes.TaskStates.CANCELED));
    });
  });

  describe('given the Place Inventory Hold task', () => {
    it('a new task will be created when the corresponding event is triggered', async () => {
      const allTasks = await setupTasks(
        buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.HOLD_INVENTORY], msgMetadata: inventoryHoldMetadata }),
      );

      await assertTask(allTasks, party.id, DALTypes.TaskNames.HOLD_INVENTORY);

      expect(allTasks[0].metadata.inventoryName).to.equal(inventoryHoldMetadata.inventoryName);
      expect(allTasks[0].metadata.holdDepositPayer.fullName).to.equal(inventoryHoldMetadata.holdDepositPayer.fullName);
      expect(allTasks[0].metadata.holdDepositPayer.preferredName).to.equal(inventoryHoldMetadata.holdDepositPayer.preferredName);
    });

    describe('given an existing Place Inventory Hold task', () => {
      it('a new task will NOT be created for the same party', async () => {
        const existingTask = await createATask(createPlaceInventoryHoldTask(party.id));
        const allTasks = await setupTasks(
          buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.HOLD_INVENTORY], msgMetadata: inventoryHoldMetadata }),
        );

        await assertTask(allTasks, party.id, DALTypes.TaskNames.HOLD_INVENTORY, existingTask.id);
      });
    });

    describe('given an existing active Place Inventory Hold task', () => {
      it('the task will be marked as completed when the corresponding event is triggered', async () => {
        const existingTask = await createATask(createPlaceInventoryHoldTask(party.id));
        const allTasks = await setupTasks(
          buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.HOLD_INVENTORY], msgMetadata: inventoryHoldMetadata, key: COMPLETE_ON_DEMAND }),
        );

        await assertTask(allTasks, party.id, DALTypes.TaskNames.HOLD_INVENTORY, existingTask.id, DALTypes.TaskStates.COMPLETED);
        expect(allTasks[0].completionDate).to.not.be.null;
      });
    });

    describe('archiving an existing active workflow with an active Hold Inventory task', () => {
      it('the task will be marked as canceled when the corresponding event is triggered', async () => {
        // the beforeEach block above already bind consumers, since we are also using setupQueueToWaitFor here
        // it is better to remove the previous consumers or the message will be consumed by the wrong handler and this test will never end
        await clean(chan(), true);
        const existingTask = await createATask(createPlaceInventoryHoldTask(party.id));

        const authUser = await createAUser();
        const newCtx = { ...ctx, authUser };

        const condition = payload => payload.partyId === party.id;

        const { task } = await setupQueueToWaitFor([condition], ['tasks']);

        await partyService.archiveParty(newCtx, { partyId: party.id, archiveReasonId: DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY });

        await task;

        const allTasks = await getTasks(newCtx);
        await assertTask(allTasks, party.id, DALTypes.TaskNames.HOLD_INVENTORY, existingTask.id, DALTypes.TaskStates.CANCELED);
        expect(allTasks.length).to.equal(1);
      });
    });
  });

  describe('given a party that is updated to a different lease type', () => {
    const makePartyEligibleForFollowup = async eligibleParty => {
      const team = await createATeam({
        name: 'TestTeam',
        module: 'leasing',
        email: 'leasing_email',
        phone: '16504375757',
        metadata: {},
      });
      const partyCreationDate = now().add(-1, 'day').toDate();
      await updateParty(ctx, {
        id: eligibleParty.id,
        created_at: partyCreationDate,
        teams: [team.id],
      });
    };

    it('no FOLLOWUP tasks should be created', async () => {
      const { id } = await createAUser();
      const newCtx = { ...ctx, authUser: {} };
      // this party will change from corporate to traditional to trigger the tasks
      const party1 = await createAParty({
        userId: id,
        qualificationQuestions: {
          groupProfile: DALTypes.QualificationQuestions.GroupProfile.CORPORATE,
        },
        leaseType: DALTypes.LeaseType.CORPORATE,
      });
      // these 2 party will be eligible for task creation
      const party2 = await createAParty({
        userId: id,
        qualificationQuestions: {
          groupProfile: {},
        },
      });
      const party3 = await createAParty({
        userId: id,
        qualificationQuestions: {
          groupProfile: {},
        },
      });
      await makePartyEligibleForFollowup(party1);
      await makePartyEligibleForFollowup(party2);
      await makePartyEligibleForFollowup(party3);

      await partyService.updateParty(newCtx, {
        id: party1.id,
        qualificationQuestions: {
          groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
        },
      });

      const allTasks = await getTasks(ctx);
      allTasks.forEach(t => expect(t.name).to.equal(DALTypes.TaskNames.FOLLOWUP_PARTY));
      // FOLLOWUP tasks are not allowed on corporate parties !!!
      expect(allTasks.length).to.equal(0);
    });
  });

  describe('given the Send Renewal Reminder task', () => {
    it('a new task will not be created when the party workflow is not Renewal', async () => {
      await createActiveLeaseWfParty();

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when the party is in renewal workflow but the lease end date is after moveoutNoticePeriod', async () => {
      const leaseEndDate = now().add(moveoutNoticePeriod, 'days').add(2, 'days').toISOString();

      await updatePartyForSendRenewalTask(leaseEndDate);

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(0);
    });

    it('a new task will not be created when an active send renewal quote task exists', async () => {
      await updatePartyForSendRenewalTask();

      const existingTask = await createATask(createSendRenewalQuoteTask(party.id));

      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }));
      await Promise.all(thePromises);

      expect(allTasks.length).to.equal(1);
      expect(allTasks[0].id).to.equal(existingTask.id);
    });

    it('a new task will not be created when already exists one send renewal reminder task', async () => {
      const existingTask = await createATask(createSendRenewalReminderTask(party.id));

      await updatePartyForSendRenewalTask();

      const allTasks = await setupTasks(buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }));
      await Promise.all(thePromises);

      expect(allTasks.length).to.equal(1);
      expect(allTasks[0].id).to.equal(existingTask.id);
    });

    it('a new task will be created when the party is in renewal workflow and the lease end date is 3 days before moveoutNoticePeriod', async () => {
      const leaseEndDate = now().add(moveoutNoticePeriod, 'days').add(3, 'days').toISOString();

      await updatePartyForSendRenewalTask(leaseEndDate);

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      const allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(1);
    });

    it('a new task will be created when the party is in renewal workflow and the lease end date is equal to follow up reminder cadence', async () => {
      const FIFTY_DAYS_BEFORE_LEASE_END_DATE = moveoutNoticePeriod - 10;
      const THIRTY_FIVE_DAYS_BEFORE_LEASE_END_DATE = moveoutNoticePeriod - 25;
      const TWENTY_DAYS_BEFORE_LEASE_END_DATE = moveoutNoticePeriod - 40;
      const FIVE_DAYS_BEFORE_LEASE_END_DATE = moveoutNoticePeriod - 55;

      let leaseEndDate = now().add(FIFTY_DAYS_BEFORE_LEASE_END_DATE, 'days').toISOString();

      await updatePartyForSendRenewalTask(leaseEndDate);

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      let allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(1);
      expect(allTasks.filter(t => t.state === DALTypes.TaskStates.ACTIVE).length).to.equal(1);

      leaseEndDate = now().add(THIRTY_FIVE_DAYS_BEFORE_LEASE_END_DATE, 'days').toISOString();

      await updateActiveLeaseData(leaseEndDate);
      await cancelAllTasks(await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER));

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(2);
      expect(allTasks.filter(t => t.state === DALTypes.TaskStates.ACTIVE).length).to.equal(1);

      leaseEndDate = now().add(TWENTY_DAYS_BEFORE_LEASE_END_DATE, 'days').toISOString();

      await updateActiveLeaseData(leaseEndDate);
      await cancelAllTasks(await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER));

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(3);
      expect(allTasks.filter(t => t.state === DALTypes.TaskStates.ACTIVE).length).to.equal(1);

      leaseEndDate = now().add(FIVE_DAYS_BEFORE_LEASE_END_DATE, 'days').toISOString();

      await updateActiveLeaseData(leaseEndDate);
      await completeAllTasks(await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER));

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(4);
      expect(allTasks.filter(t => t.state === DALTypes.TaskStates.ACTIVE).length).to.equal(1);

      leaseEndDate = now().add(1, 'days').toISOString();

      await updateActiveLeaseData(leaseEndDate);
      await cancelAllTasks(await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER));

      await sendMessage({ ...buildTasksMessage({ partyId: party.id, tasks: [DALTypes.TaskNames.SEND_RENEWAL_REMINDER] }) });
      await Promise.all(thePromises);

      allTasks = await getTasksByName(ctx, DALTypes.TaskNames.SEND_RENEWAL_REMINDER);
      expect(allTasks.length).to.equal(4);
      expect(allTasks.filter(t => t.state === DALTypes.TaskStates.ACTIVE).length).to.equal(0);
    });
  });
});
