/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import { mapSeries } from 'bluebird';
import stringify from 'json-stringify-safe';
import { getActiveTasksForTeamMember, updateTasksBulk } from '../dal/tasksRepo';
import { getPartiesToReassignFromInactiveUser, getOwnersForPartiesWithNames } from '../dal/partyRepo';
import { getUsersWithRoleFromTeam, getUserById } from '../dal/usersRepo';
import { getTeamById } from '../dal/teamsRepo';
import { assignParty } from './party';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { tasksForLAA, tasksForLCA, isTaskUnrestricted } from '../workers/tasks/taskDefinitions/taskDefinitions';
import logger from '../../common/helpers/logger';
import { bulkCreateEvents } from './externalCalendars/cronofyService';
import { DALTypes } from '../../common/enums/DALTypes';
import { toMoment, now } from '../../common/helpers/moment-utils';
import { updateUserCalendarEvent } from './appointments';
import { logEntity } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';

const getFutureAppointmentsFromTasks = tasks =>
  tasks.filter(t => t.name === DALTypes.TaskNames.APPOINTMENT && toMoment(t.metadata.startDate).isAfter(now({ timezone: 'UTC' }), 'hour'));

const addReassignedAppointmentsToExternalCalendars = async (ctx, tasks, dispatcherId) => {
  const activeAppointments = getFutureAppointmentsFromTasks(tasks).map(t => ({ ...t, userIds: [dispatcherId] }));
  await bulkCreateEvents(ctx, activeAppointments);
};

const updateCalendarEventsForReassignedAppointments = async (ctx, tasks, dispatcherId) => {
  const activeAppointments = getFutureAppointmentsFromTasks(tasks).map(t => ({ ...t, userIds: [dispatcherId] }));
  await mapSeries(activeAppointments, async appointment => await updateUserCalendarEvent(ctx, appointment));
};

const addGenericInactivationActivityLog = async (ctx, userId, teamId, partyIds) => {
  logger.trace({ ctx, userId, teamId, partyIdsForActivityLog: stringify(partyIds) }, 'addGenericInactivationActivityLog');
  const { fullName } = await getUserById(ctx, userId);
  const { displayName } = await getTeamById(ctx, teamId);
  const activityLog = {
    inactiveUser: fullName,
    inactiveUserId: userId,
    deactivatedInTeam: displayName,
    teamId,
    createdByType: DALTypes.CreatedByType.SYSTEM,
    shouldUpdateCollaborators: false,
    isAdminUser: true,
  };
  await mapSeries(
    partyIds,
    async partyId =>
      await logEntity(ctx, { entity: { ...activityLog, partyId }, activityType: ACTIVITY_TYPES.DEACTIVATE, component: COMPONENT_TYPES.LEASINGTEAM }),
  );
};

export const updateTasksAndLogChanges = async (ctx, tasks, users) => {
  await updateTasksBulk(
    ctx,
    tasks.map(t => t.id),
    { userIds: users.map(u => u.userId) },
  );
  const activityLog = {
    createdByType: DALTypes.CreatedByType.SYSTEM,
    shouldUpdateCollaborators: false,
    isAdminUser: true,
  };
  await mapSeries(tasks, async task => {
    if (task.name === DALTypes.TaskNames.APPOINTMENT) {
      await logEntity(ctx, {
        entity: { ...activityLog, partyId: task.partyId, id: task.id, taskName: task.name, salesPerson: users[0].fullName },
        activityType: ACTIVITY_TYPES.UPDATE,
        component: COMPONENT_TYPES.APPOINTMENT,
      });
    } else {
      await logEntity(ctx, {
        entity: {
          ...activityLog,
          partyId: task.partyId,
          id: task.id,
          taskName: task.name,
          taskCategory: task.category,
          assignee: users.map(u => u.fullName).join(', '),
        },
        activityType: ACTIVITY_TYPES.UPDATE,
        component: COMPONENT_TYPES.TASK,
      });
    }
  });
};

const reassignActiveTasksToDispatcher = async (ctx, activeTasks, teamDispatchers) => {
  const activeTasksForLD = activeTasks.filter(t => isTaskUnrestricted(t) && t.name !== DALTypes.TaskNames.SEND_CONTRACT);
  if (activeTasksForLD.length) {
    logger.trace({ ctx, dispatcherId: teamDispatchers[0].userId, taskIds: activeTasksForLD.map(t => t.id) }, 'reassignActiveTasksToDispatcher');
    await updateTasksAndLogChanges(ctx, activeTasksForLD, teamDispatchers);
    await addReassignedAppointmentsToExternalCalendars(ctx, activeTasksForLD, teamDispatchers[0].userId);
    await updateCalendarEventsForReassignedAppointments(ctx, activeTasksForLD, teamDispatchers[0].userId);
  }
};

const reassignActiveTasksToLAA = async (ctx, activeTasks, teamId, userId, teamDispatcherId) => {
  const activeTasksForLAA = activeTasks.filter(t => tasksForLAA.some(taskForLAA => taskForLAA.name === t.name));
  const sendContractTasks = activeTasks.filter(t => t.name === DALTypes.TaskNames.SEND_CONTRACT);
  const teamLeasingApprovers = await getUsersWithRoleFromTeam(ctx, teamId, FunctionalRoleDefinition.LAA.name);

  if (activeTasksForLAA.length && teamLeasingApprovers) {
    logger.trace({ ctx, userIds: teamLeasingApprovers.map(u => u.userId), taskIds: activeTasksForLAA.map(t => t.id) }, 'reassignActiveTasksToLAA');
    await updateTasksAndLogChanges(ctx, activeTasksForLAA, teamLeasingApprovers);
  }
  if (sendContractTasks.length) {
    logger.trace({ ctx, userIds: teamLeasingApprovers.map(u => u.userId), taskIds: activeTasksForLAA.map(t => t.id) }, 'reassignSendContractActiveTasksToLAA');
    const partiesForSendContract = sendContractTasks.map(t => t.partyId);
    const partyOwners = await getOwnersForPartiesWithNames(ctx, partiesForSendContract);
    const tasksWithOwnerInactiveOrDispatcher = sendContractTasks.filter(t =>
      partyOwners.some(po => po.id === t.partyId && (po.userId === userId || po.userId === teamDispatcherId)),
    );
    teamLeasingApprovers && (await updateTasksAndLogChanges(ctx, tasksWithOwnerInactiveOrDispatcher, teamLeasingApprovers));

    const remainingTasks = sendContractTasks.filter(t => !tasksWithOwnerInactiveOrDispatcher.some(tsk => t.id === tsk.id));
    const groupedTasksByParty = groupBy(remainingTasks, t => t.partyId);

    await mapSeries(Object.keys(groupedTasksByParty), async group => {
      const partyOwner = partyOwners.find(po => po.id === group);
      const users = Array.from(new Set([...teamLeasingApprovers, { userId: partyOwner.userId, fullName: partyOwner.fullName }]));
      users && users.length && (await updateTasksAndLogChanges(ctx, groupedTasksByParty[group], users));
    });
  }
};

const reassignActiveTasksToLCA = async (ctx, activeTasks, teamId) => {
  const activeTasksForLCA = activeTasks.filter(t => tasksForLCA.some(taskForLCA => taskForLCA.name === t.name));
  if (activeTasksForLCA.length) {
    const teamContractApprovers = await getUsersWithRoleFromTeam(ctx, teamId, FunctionalRoleDefinition.LCA.name);
    logger.trace({ ctx, userIds: teamContractApprovers.map(u => u.userId), taskIds: activeTasksForLCA.map(t => t.id) }, 'reassignActiveTasksToLCA');
    teamContractApprovers && (await updateTasksAndLogChanges(ctx, activeTasksForLCA, teamContractApprovers));
  }
};

const checkConflictingAppointments = false;
const reassingReason = '';
const isSystemActivity = true;

const getTeamDispatcher = async (ctx, teamId) => {
  const teamDispatchers = await getUsersWithRoleFromTeam(ctx, teamId, FunctionalRoleDefinition.LD.name);
  const teamDispatcherId = teamDispatchers.length && teamDispatchers[0].userId;

  if (!teamDispatcherId) {
    logger.warn({ ctx, teamId }, 'No leasing dispatcher found in team');
  }
  return { teamDispatcherId, teamDispatchers };
};

const reassignTasks = async ({ ctx, activeTasks, dispatcherData, teamId, userId }) => {
  await reassignActiveTasksToDispatcher(ctx, activeTasks, dispatcherData.teamDispatchers);
  await reassignActiveTasksToLAA(ctx, activeTasks, teamId, userId, dispatcherData.teamDispatcherId);
  await reassignActiveTasksToLCA(ctx, activeTasks, teamId);
};

export const reassignPartyAndTasksForInactiveTeamMember = async (ctx, teamMember, party) => {
  const { userId = party.userId, teamId = party.ownerTeam } = teamMember || {};
  logger.trace({ ctx, userId, teamId, partyId: party.id }, 'Reassigning party from inactive user in team');

  const dispatcherData = await getTeamDispatcher(ctx, teamId);
  if (!dispatcherData.teamDispatcherId) return;

  // Assign all tasks/appointments of the team member to the team LD (or higher functional roles if required by the tasks type)
  const activeTasks = await getActiveTasksForTeamMember(ctx, userId, teamId, party.id);

  await addGenericInactivationActivityLog(ctx, userId, teamId, [party.id]);
  await reassignTasks({ ctx, userId, teamId, dispatcherData, activeTasks });

  await assignParty(ctx, party, { userId: dispatcherData.teamDispatcherId }, checkConflictingAppointments, reassingReason, isSystemActivity);
};

export const handleUserDeactivationInTeam = async (ctx, userId, teamId) => {
  logger.trace({ ctx, userId, teamId }, 'User was deactivated in team: ');

  const dispatcherData = await getTeamDispatcher(ctx, teamId);
  if (!dispatcherData.teamDispatcherId) return;

  // Assign all tasks/appointments of the team member to the team LD (or higher functional roles if required by the tasks type)
  const activeTasks = await getActiveTasksForTeamMember(ctx, userId, teamId);

  // Assign parties open parties and parties closed/archived in the last 30 days to the LD of the team
  const partiesToReassign = await getPartiesToReassignFromInactiveUser(ctx, userId, teamId);

  const partyIdsForTasks = activeTasks.map(t => t.partyId);
  const partyIds = partiesToReassign.map(t => t.id);

  const partyIdsForActivityLog = new Set([...partyIds, ...partyIdsForTasks]);
  await addGenericInactivationActivityLog(ctx, userId, teamId, partyIdsForActivityLog);

  await reassignTasks({ ctx, userId, teamId, dispatcherData, activeTasks });

  await mapSeries(
    partiesToReassign,
    async party => await assignParty(ctx, party, { userId: dispatcherData.teamDispatcherId }, checkConflictingAppointments, reassingReason, isSystemActivity),
  );
};
