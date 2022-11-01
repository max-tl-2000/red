/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, clickOnElement, expectVisible, getPartyIdFromUrl, reloadURL } from '../../helpers/helpers';
import { createAParty } from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import { checkActivityLogEntryByIndex } from '../../helpers/activityLogHelpers';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import { now } from '../../../common/helpers/moment-utils';
import { knex } from '../../../server/database/factory.js';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { updateTask, getActiveTasksForPartyByCategory } from '../../../server/dal/tasksRepo';
import { DALTypes } from '../../../common/enums/DALTypes';

setHooks(fixture('Create Party From Lease Application').meta({}), {
  fixtureName: 'createParty',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

const ctx = { tenantId: TEST_TENANT_ID, dbKnex: knex };

test.skip('TEST-1822 TEST-1823 Verify the user is able to create and edit Manual Reminder Task', async t => {
  // create party
  const userInfo = { user: 'felicia@reva.tech', fullName: 'Felicia Sutton', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const timezone = partyInfo.properties[0].timezone;
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // create task and check activity log
  await partyDetailPage.createManualTask();
  const remindMeTaskCreationActivityLog = `Reminder; Assignee: ${userInfo.fullName}; CreatedBy: ${userInfo.fullName}; Owner: ${userInfo.fullName}; Task category: Manual reminder`;
  const cleanText = true;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'new', component: 'task (#1)', details: remindMeTaskCreationActivityLog }, cleanText);
  const partyPhaseOne = new PartyPhaseOne(t);
  await partyPhaseOne.clickOnBackButton();

  // edit task name and notes
  const editedTask = {
    taskNewName: 'Renamed task',
    taskNotes: 'Test',
    assignedAgentName: 'JoshHelpman',
    reassignedAgentName: 'DannyGogood',
    assignedAgentNameFormated: 'Josh Helpman',
    markAsDoneNotes: 'Marked as Done',
    unmarkAsDoneNotes: 'Marked as Done again',
  };
  await partyDetailPage.editManualTaskNameAndNotes(editedTask.taskNewName, editedTask.taskNotes);

  // edit task dueDate
  const date = now({ timezone }).add(3, 'day');
  await partyDetailPage.editManualTaskDueDate(date);

  // edit task assign agent and check activity log
  await partyDetailPage.editManulTaskAssignAgent(editedTask.assignedAgentName);
  await clickOnElement(t, { selector: partyDetailPage.selectors.saveEditTaskDialog });
  const day = date.format('MMM DD');
  const remindMeTaskEditActivityLog = `${editedTask.taskNewName} ; Assignee: ${editedTask.assignedAgentNameFormated}; Notes: ${editedTask.taskNotes}; Due date: ${day} 11:59 pm`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'update', component: 'task (#1)', details: remindMeTaskEditActivityLog });
  await partyPhaseOne.clickOnBackButton();

  // reasign task and check activity log
  await partyDetailPage.reassignManualTask(editedTask.reassignedAgentName);
  const remindMeTaskReassignActivityLog = `Assignee: ${editedTask.reassignedAgentName};`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'update', component: 'task (#1)', details: remindMeTaskReassignActivityLog }, cleanText);
  await partyPhaseOne.clickOnBackButton();

  // mark task as Done, add notes and check activity log
  await partyDetailPage.markTaskDoneAndAddNotes(editedTask.markAsDoneNotes);
  const remindMeTaskMarkAsDoneActivityLog = `Completed By: ${userInfo.fullName}; Closing note:${editedTask.markAsDoneNotes}`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'completed', component: 'task (#1)', details: remindMeTaskMarkAsDoneActivityLog }, cleanText);
  await partyPhaseOne.clickOnBackButton();

  // unmark task as done and mark as done again
  await partyDetailPage.unmarkTaskDoneAndAddNotes(editedTask.unmarkAsDoneNotes);
  const remindMeTaskMarkAsDoneAgainActivityLog = `Completed By: ${userInfo.fullName}; Closing note:${editedTask.unmarkAsDoneNotes}`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'completed', component: 'task (#1)', details: remindMeTaskMarkAsDoneAgainActivityLog }, cleanText);
  await partyPhaseOne.clickOnBackButton();

  // create a new task and verify if the new task is removed when the party is closed
  await partyDetailPage.createManualTask();
  const partyId = await getPartyIdFromUrl();
  const closedPartyUrl = 'party/'.concat(partyId);
  const closeReason = DALTypes.ClosePartyReasons.NO_LONGER_MOVING;
  await partyDetailPage.closeParty(closeReason);
  await t.navigateTo(closedPartyUrl);
  const remindMeTaskClosedPartyActivityLog = `Reminder; Assignee: ${userInfo.fullName};`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'update', component: 'task (#2)', details: remindMeTaskClosedPartyActivityLog }, cleanText);
  await partyPhaseOne.clickOnBackButton();

  // reopen party, create a new task and change due date to tomorrow
  await partyDetailPage.reopenParty();
  await partyDetailPage.createManualTask();
  await expectVisible(t, { selector: '[data-component="text"]', text: 'By today' });
  await partyDetailPage.editManualTask();
  const dateTomorrow = now({ timezone }).add(1, 'day');
  await partyDetailPage.editManualTaskDueDate(dateTomorrow);
  await clickOnElement(t, { selector: partyDetailPage.selectors.saveEditTaskDialog });
  await expectVisible(t, { selector: '[data-component="text"]', text: 'By tomorrow' });

  // open DB and change due date in the past
  const category = DALTypes.TaskCategories.MANUAL_REMINDER;
  const [task] = await getActiveTasksForPartyByCategory(ctx, partyId, category);
  await updateTask(ctx, task.id, { dueDate: now({ timezone }).add(-5, 'day') });
  await reloadURL();
  await expectVisible(t, { selector: '[data-component="text"]', text: '5 days overdue' });
});
