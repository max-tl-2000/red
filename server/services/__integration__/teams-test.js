/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { handleUserDeactivationInTeam } from '../teamMembers';
import { loadPartyById } from '../../dal/partyRepo';
import { getTasksByIds } from '../../dal/tasksRepo';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';
import {
  createAUser,
  createATeam,
  createATeamMember,
  createAParty,
  createATask,
  toggleExtCalendarFeature,
  createAnAppointment,
  createAProperty,
} from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';

const ctx = { tenantId: tenant.id };

const dispatcherRole = {
  functionalRoles: [FunctionalRoleDefinition.LD.name],
};

const applicationApproverRole = {
  functionalRoles: [FunctionalRoleDefinition.LAA.name],
};

const contractApproverRole = {
  functionalRoles: [FunctionalRoleDefinition.LCA.name],
};

describe('given a user active in a team, with an open party assigned', () => {
  describe('when deactivating the user in that team', () => {
    it('the party is reassigned to a Leasing Dispatcher from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const partyAfterDeactivation = await loadPartyById(ctx, party.id);
      expect(partyAfterDeactivation.userId).to.equal(teamDispatcher.id);
    });
  });
});

describe('given a user active in a team, with a closed party assigned', () => {
  describe('when deactivating the user in that team', () => {
    describe('if the party was closed less than 30 days ago', () => {
      it('the party is reassigned to a Leasing Dispatcher from the team', async () => {
        const team = await createATeam();
        const partyOwner = await createAUser({ name: 'Joe' });
        const teamDispatcher = await createAUser({ name: 'LD' });
        const property = await createAProperty();

        await createATeamMember({ teamId: team.id, userId: partyOwner.id });
        await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

        const party = await createAParty({
          userId: partyOwner.id,
          ownerTeam: team.id,
          endDate: now().subtract(29, 'day'),
          assignedPropertyId: property.id,
          workflowState: DALTypes.WorkflowState.CLOSED,
        });

        await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

        const partyAfterDeactivation = await loadPartyById(ctx, party.id);
        expect(partyAfterDeactivation.userId).to.equal(teamDispatcher.id);
      });
    });

    describe('if the party was closed more than 30 days ago', () => {
      it('the party is not reassigned to a Leasing Dispatcher from the team', async () => {
        const team = await createATeam();
        const partyOwner = await createAUser({ name: 'Joe' });
        const teamDispatcher = await createAUser({ name: 'LD' });
        const property = await createAProperty();

        await createATeamMember({ teamId: team.id, userId: partyOwner.id });
        await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

        const party = await createAParty({
          userId: partyOwner.id,
          ownerTeam: team.id,
          endDate: now().subtract(31, 'day'),
          workflowState: DALTypes.WorkflowState.CLOSED,
          assignedPropertyId: property.id,
        });

        await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

        const partyAfterDeactivation = await loadPartyById(ctx, party.id);
        expect(partyAfterDeactivation.userId).to.equal(partyOwner.id);
      });
    });
  });
});

describe('given a user active in a team, with a archived party assigned', () => {
  describe('when deactivating the user in that team', () => {
    describe('if the party was archived', () => {
      it('the party is not reassigned to a Leasing Dispatcher from the team', async () => {
        const team = await createATeam();
        const partyOwner = await createAUser({ name: 'Joe' });
        const teamDispatcher = await createAUser({ name: 'LD' });
        const property = await createAProperty();

        await createATeamMember({ teamId: team.id, userId: partyOwner.id });
        await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

        const party = await createAParty({
          userId: partyOwner.id,
          ownerTeam: team.id,
          workflowState: DALTypes.WorkflowState.ARCHIVED,
          archiveDate: now().subtract(29, 'day'),
          assignedPropertyId: property.id,
        });

        await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

        const partyAfterDeactivation = await loadPartyById(ctx, party.id);
        expect(partyAfterDeactivation.userId).to.equal(partyOwner.id);
      });
    });
  });
});

describe('given a user active in a team, with an open party assigned', () => {
  describe('when deactivating the user in that team', () => {
    describe('if the party is assigned to an inactive property', () => {
      it('the party is not reassigned to a Leasing Dispatcher from the team', async () => {
        const team = await createATeam();
        const partyOwner = await createAUser({ name: 'Joe' });
        const teamDispatcher = await createAUser({ name: 'LD' });
        const property = await createAProperty({}, { endDate: now().toISOString() });

        await createATeamMember({ teamId: team.id, userId: partyOwner.id });
        await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

        const party = await createAParty({
          userId: partyOwner.id,
          ownerTeam: team.id,
          workflowState: DALTypes.WorkflowState.ARCHIVED,
          archiveDate: now().subtract(31, 'day'),
          assignedPropertyId: property.id,
        });

        await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

        const partyAfterDeactivation = await loadPartyById(ctx, party.id);
        expect(partyAfterDeactivation.userId).to.equal(partyOwner.id);
      });
    });
  });
});

describe('given a user active in two teams', () => {
  describe('when deactivating the user in one team', () => {
    it('his parties in the other team are not reassigned', async () => {
      const team1 = await createATeam();
      const team2 = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team1.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team2.id, userId: partyOwner.id, roles: dispatcherRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team1.id,
        assignedPropertyId: property.id,
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team2.id);

      const partyAfterDeactivation = await loadPartyById(ctx, party.id);
      expect(partyAfterDeactivation.userId).to.equal(partyOwner.id);
    });
  });
});

describe('given a user active in a team, with party tasks assigned to parties belonging to that team', () => {
  describe('when deactivating the user in that team', () => {
    it('his tasks with unrestricted access are reassigned to a Leasing Dispatcher from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      const task = await createATask({
        name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
        category: DALTypes.TaskCategories.PARTY,
        partyId: party.id,
        userIds: [partyOwner.id],
      });

      const task2 = await createATask({
        name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
        category: DALTypes.TaskCategories.PARTY,
        partyId: party.id,
        userIds: [partyOwner.id],
      });

      const teamLCA = await createAUser({ name: 'LCA' });
      await createATeamMember({ teamId: team.id, userId: teamLCA.id, roles: contractApproverRole });
      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);
      const tasksAfterDeactivation = await getTasksByIds(ctx, [task.id, task2.id]);

      const introduceYourselfTask = tasksAfterDeactivation.find(t => t.name === task.name);
      expect(introduceYourselfTask.userIds.length).equals(1);
      expect(introduceYourselfTask.userIds[0]).equals(teamDispatcher.id);
      const counterSignTask = tasksAfterDeactivation.find(t => t.name === task2.name);
      expect(counterSignTask.userIds.length).equals(1);
      expect(counterSignTask.userIds[0]).equals(teamLCA.id);
    });

    describe('if the user had calendar integration enabled but the new owner will not', async () => {
      it('his tasks with unrestricted access are reassigned to a LD from the team', async () => {
        const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
        await toggleExtCalendarFeature(true);
        const team = await createATeam();
        const partyOwner = await createAUser(userParams);
        const teamDispatcher = await createAUser({ name: 'LD' });
        const property = await createAProperty();

        const tomorrow = now().startOf('day').add(1, 'days');

        await createATeamMember({ teamId: team.id, userId: partyOwner.id });
        await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

        const party = await createAParty({
          userId: partyOwner.id,
          ownerTeam: team.id,
          assignedPropertyId: property.id,
        });

        const appt1 = await createAnAppointment({
          partyId: party.id,
          salesPersonId: partyOwner.id,
          startDate: tomorrow.clone().add(8, 'hours'),
          endDate: tomorrow.clone().add(9, 'hours'),
        });

        const appt2 = await createAnAppointment({
          partyId: party.id,
          salesPersonId: partyOwner.id,
          startDate: tomorrow.clone().add(1, 'days').add(8, 'hours'),
          endDate: tomorrow.clone().add(1, 'days').add(8, 'hours').add(30, 'minutes'),
        });

        const task = await createATask({
          name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
          category: DALTypes.TaskCategories.PARTY,
          partyId: party.id,
          userIds: [partyOwner.id],
        });

        await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);
        const tasksAfterDeactivation = await getTasksByIds(ctx, [task.id, appt1.id, appt2.id]);

        const introduceYourselfTask = tasksAfterDeactivation.find(t => t.id === task.id);
        expect(introduceYourselfTask.userIds.length).equals(1);
        expect(introduceYourselfTask.userIds[0]).equals(teamDispatcher.id);
        const appointment1Task = tasksAfterDeactivation.find(t => t.id === appt1.id);
        const appointment2Task = tasksAfterDeactivation.find(t => t.id === appt2.id);
        expect(appointment1Task.userIds.length).equals(1);
        expect(appointment1Task.userIds[0]).equals(teamDispatcher.id);
        expect(appointment2Task.userIds.length).equals(1);
        expect(appointment2Task.userIds[0]).equals(teamDispatcher.id);
      });
    });
  });
});

describe('given a user active in a team, with a sign contract task assigned to a party belonging to that team', () => {
  describe('when deactivating the user in that team', () => {
    it('his task is reassigned to the LCA from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLCA = await createAUser({ name: 'LCA' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: teamLCA.id, roles: contractApproverRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      const task = await createATask({
        name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
        category: DALTypes.TaskCategories.CONTRACT_SIGNING,
        partyId: party.id,
        userIds: [partyOwner.id],
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const taskAfterDeactivation = (await getTasksByIds(ctx, [task.id]))[0];
      expect(taskAfterDeactivation.userIds.length).equals(1);
      expect(taskAfterDeactivation.userIds[0]).equals(teamLCA.id);
    });

    it('his task is reassigned to all LCA from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLCA = await createAUser({ name: 'LCA' });
      const teamLCA2 = await createAUser({ name: 'LCA2' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: teamLCA.id, roles: contractApproverRole });
      await createATeamMember({ teamId: team.id, userId: teamLCA2.id, roles: contractApproverRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      const task = await createATask({
        name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
        category: DALTypes.TaskCategories.CONTRACT_SIGNING,
        partyId: party.id,
        userIds: [partyOwner.id],
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const taskAfterDeactivation = (await getTasksByIds(ctx, [task.id]))[0];
      expect(taskAfterDeactivation.userIds.length).equals(2);
      expect(taskAfterDeactivation.userIds.includes(teamLCA.id)).to.be.true;
      expect(taskAfterDeactivation.userIds.includes(teamLCA2.id)).to.be.true;
    });
  });
});

describe('given a user active in a team, with an approve application task assigned to a party belonging to that team', () => {
  describe('when deactivating the user in that team', () => {
    it('his task is reassigned to the LAA from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLAA = await createAUser({ name: 'LAA' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: teamLAA.id, roles: applicationApproverRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      const task = await createATask({
        name: DALTypes.TaskNames.REVIEW_APPLICATION,
        category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
        partyId: party.id,
        userIds: [partyOwner.id],
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const taskAfterDeactivation = (await getTasksByIds(ctx, [task.id]))[0];
      expect(taskAfterDeactivation.userIds.length).equals(1);
      expect(taskAfterDeactivation.userIds[0]).equals(teamLAA.id);
    });

    it('his task is reassigned to all LAAs from the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLAA = await createAUser({ name: 'LAA' });
      const teamLAA2 = await createAUser({ name: 'LAA2' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: teamLAA.id, roles: applicationApproverRole });
      await createATeamMember({ teamId: team.id, userId: teamLAA2.id, roles: applicationApproverRole });

      const party = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
      });

      const task = await createATask({
        name: DALTypes.TaskNames.REVIEW_APPLICATION,
        category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
        partyId: party.id,
        userIds: [partyOwner.id],
        assignedPropertyId: property.id,
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const taskAfterDeactivation = (await getTasksByIds(ctx, [task.id]))[0];
      expect(taskAfterDeactivation.userIds.length).equals(2);
      expect(taskAfterDeactivation.userIds.includes(teamLAA.id)).to.be.true;
      expect(taskAfterDeactivation.userIds.includes(teamLAA2.id)).to.be.true;
    });
  });
});

describe('given a user active in two teams, with multiple tasks assigned to a party belonging to one team', () => {
  describe('when deactivating the user in that team', () => {
    it('all his tasks are reassigned to users with correct roles in the team', async () => {
      const team = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLAA = await createAUser({ name: 'LAA' });
      const teamLCA = await createAUser({ name: 'LCA' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: teamLAA.id, roles: applicationApproverRole });
      await createATeamMember({ teamId: team.id, userId: teamLCA.id, roles: contractApproverRole });

      const partyOnTeam1 = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
      });

      const task1 = await createATask({
        name: DALTypes.TaskNames.REVIEW_APPLICATION,
        category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      const task2 = await createATask({
        name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
        category: DALTypes.TaskCategories.CONTRACT_SIGNING,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      const task3 = await createATask({
        name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
        category: DALTypes.TaskCategories.PARTY,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team.id);

      const task1AfterDeactivation = (await getTasksByIds(ctx, [task1.id]))[0];
      const task2AfterDeactivation = (await getTasksByIds(ctx, [task2.id]))[0];
      const task3AfterDeactivation = (await getTasksByIds(ctx, [task3.id]))[0];

      expect(task1AfterDeactivation.userIds[0]).equals(teamLAA.id);
      expect(task2AfterDeactivation.userIds[0]).equals(teamLCA.id);
      expect(task3AfterDeactivation.userIds[0]).equals(teamDispatcher.id);
    });
  });

  describe('when deactivating the user in the other team', () => {
    it('his tasks in the first team are not reassigned', async () => {
      const team1 = await createATeam();
      const team2 = await createATeam();
      const partyOwner = await createAUser({ name: 'Joe' });
      const teamDispatcher = await createAUser({ name: 'LD' });
      const teamLAA = await createAUser({ name: 'LAA' });
      const property = await createAProperty();

      await createATeamMember({ teamId: team1.id, userId: partyOwner.id });
      await createATeamMember({ teamId: team1.id, userId: teamDispatcher.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team1.id, userId: teamLAA.id, roles: applicationApproverRole });

      const partyOnTeam1 = await createAParty({
        userId: partyOwner.id,
        ownerTeam: team1.id,
        assignedPropertyId: property.id,
      });

      const task1 = await createATask({
        name: DALTypes.TaskNames.REVIEW_APPLICATION,
        category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      const task2 = await createATask({
        name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
        category: DALTypes.TaskCategories.CONTRACT_SIGNING,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      const task3 = await createATask({
        name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
        category: DALTypes.TaskCategories.PARTY,
        partyId: partyOnTeam1.id,
        userIds: [partyOwner.id],
      });

      await handleUserDeactivationInTeam(ctx, partyOwner.id, team2.id);

      const tasksAfterDeactivation = await getTasksByIds(ctx, [task1.id, task2.id, task3.id]);
      expect(tasksAfterDeactivation.every(t => t.userIds.length === 1 && t.userIds[0] === partyOwner.id)).to.be.true;
    });
  });
});
