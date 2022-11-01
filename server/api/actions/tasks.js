/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import uniq from 'lodash/uniq';
import flattenDeep from 'lodash/flattenDeep';
import { getTasks as getTasksFromDb, getTasksByIds, getTasksByPartyIds, updateTasks as updateTasksInDb } from '../../dal/tasksRepo';
import { userExists } from '../../dal/usersRepo';
import { loadUsersByIds } from '../../services/users';
import { loadPartyMembers, loadPartiesByIds } from '../../dal/partyRepo';
import { ServiceError } from '../../common/errors';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import * as validators from '../helpers/validators';
import { DALTypes } from '../../../common/enums/DALTypes';
import { exists, allIdExists } from '../../database/factory';
import * as tasksService from '../../services/tasks';
import * as calendar from '../../services/calendar';
import * as apptsService from '../../services/appointments';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'actions/tasks' });

const validateTaskExists = async (ctx, taskId) => {
  if (await exists(ctx.tenantId, 'Tasks', taskId)) {
    return;
  }

  throw new ServiceError({
    token: 'TASK_NOT_FOUND',
    status: 404,
  });
};

const validateAllTaskExists = async (ctx, taskIds) => {
  if (await allIdExists(ctx.tenantId, 'Tasks', taskIds)) {
    return;
  }

  throw new ServiceError({
    token: 'TASK_NOT_FOUND',
    status: 404,
  });
};

const validateAppointmentSalesPerson = async (req, appointment) => {
  validators.defined(appointment.salesPersonId, 'MISSING_SALES_PERSON_ID');

  if (await userExists(req, appointment.salesPersonId)) {
    return;
  }

  throw new ServiceError({
    token: 'SALES_PERSON_NOT_FOUND',
    status: 404,
  });
};

const validateAppointmentDates = appointment => {
  if (appointment.startDate && appointment.endDate && appointment.endDate > appointment.startDate) {
    return;
  }

  throw new ServiceError({
    token: 'INVALID_APPOINTMENT_DATES',
    status: 400,
  });
};

const validateTasksCategory = (tasks, category) => {
  if (tasks.every(t => t.category === category)) return;

  throw new ServiceError({
    token: 'ALL_TASKS_SHOULD_HAVE_THE_SAME_CATEGORY',
    status: 400,
  });
};

const validateTasksOnSameParty = (tasks, partyId) => {
  if (tasks.every(t => t.partyId === partyId)) return;

  throw new ServiceError({
    token: 'ALL_TASKS_SHOULD_BE_ON_SAME_PARTY',
    status: 400,
  });
};

const validatePartyMembers = async (req, appointment) => {
  const partyMembers = await loadPartyMembers(req, appointment.partyId);
  const ids = new Set(partyMembers.map(pm => pm.id));

  if (appointment.partyMembers && appointment.partyMembers.some(partyMemberId => !ids.has(partyMemberId))) {
    throw new ServiceError({
      token: 'INVALID_PARTY_MEMBERS',
      status: 400,
    });
  }
};

const validateTaskParty = async (req, task) => {
  validators.defined(task.partyId, 'MISSING_PARTY_ID');
  await validators.party(req, task.partyId);
};

const validateTaskUsers = async (req, task) => {
  if (task.userIds && task.userIds.length) {
    const users = await loadUsersByIds(req, task.userIds);
    if (users.length === task.userIds.length) {
      return;
    }

    throw new ServiceError({
      token: 'USER_NOT_FOUND',
      status: 404,
    });
  }

  throw new ServiceError({
    token: 'MISSING_USER_IDS',
    status: 400,
  });
};

const validateTask = async (req, task) => {
  await validateTaskParty(req, task);
  await validateTaskUsers(req, task);
};

const validateTaskAppointment = async (req, appointment) => {
  await validateAppointmentSalesPerson(req, appointment);
  await validateTaskParty(req, appointment);
  await validatePartyMembers(req, appointment);
  validateAppointmentDates(appointment);
};

export const getTasks = async req => {
  if (req.query && req.query.ids) {
    const ids = req.query.ids.split(',');
    ids.forEach(id => validators.uuid(id, 'INCORRECT_TASK_ID'));
    return await getTasksByIds(req, ids);
  }

  return await getTasksFromDb(req);
};

export const getNextAgentForAppointment = async req => {
  const { teamId } = req.params;
  validators.team(req, teamId);

  const { timezone, startDate, slotDuration } = req.body;
  if (!startDate || !slotDuration || !timezone) {
    throw new ServiceError({
      token: 'INVALID_APPOINTMENT_PARAMS',
      status: 400,
    });
  }

  return await apptsService.getNextAgentForAppointment(req, { teamId, timezone, startDate, slotDuration });
};

export const getTasksForParty = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  return getTasksByPartyIds(req, [partyId]);
};

export const addTask = async req => {
  const task = req.body;
  logger.trace({ ctx: req, task }, 'addTask action - input params');

  if (task.category === DALTypes.TaskCategories.APPOINTMENT) {
    await validateTaskAppointment(req, task);
  } else {
    await validateTask(req, task);
  }

  return await tasksService.addTask(req, task);
};

export const getDayEventsForUserAndTeam = async req => {
  const { query, params } = req;
  const { tz } = query;
  const { userId, teamId, year, month, day } = params;
  const date = `${year}-${month}-${day}`;

  validators.uuid(userId, 'INCORRECT_USER_ID');
  validators.uuid(teamId, 'INCORRECT_TEAM_ID');
  validators.validDate(date, 'INCORRECT_DATE');
  // TODO add a validator for a timezone to force it to be
  // a required parameter
  // validators.timezone(tz, 'INCORRECT_TIMEZONE');

  return await calendar.getUserAndTeamDayEvents(req, { userId, teamId, date, timezone: tz });
};

export const getTeamCalendarSlots = async req => {
  const { params, query } = req;
  const { teamId, year, month, day, numberOfDays, slotDuration } = params;
  const { timezone } = query;
  const date = `${year}-${month}-${day}`;
  logger.trace({ ctx: req, teamId, date, numberOfDays, slotDuration, timezone }, 'getTeamCalendarSlots action - input params');
  const parsedDuration = parseInt(slotDuration, 10);

  validators.uuid(teamId, 'INCORRECT_TEAM_ID');
  validators.validDate(date, 'INCORRECT_DATE');
  validators.validTimezone(timezone, 'INCORRECT_TIMEZONE');
  validators.validCalendarSlotDuration(parsedDuration, 'INCORRECT_SLOT_DURATION');

  return await calendar.getTeamCalendarSlots(req, { teamId, date, numberOfDays, slotDuration: parsedDuration, timezone });
};

export const updateTask = async req => {
  const id = req.params.taskId;
  const taskDelta = req.body;
  logger.trace({ ctx: req, id, taskDelta }, 'updateTask action - input params');

  validators.uuid(id, 'INVALID_TASK_ID');
  await validateTaskExists(req, id);

  return await tasksService.updateTask(req, id, taskDelta);
};

export const updateTasks = async req => {
  const tasksData = req.body.map(td => (td.state === DALTypes.TaskStates.COMPLETED ? { ...td, completionDate: new Date() } : td));

  const taskIds = tasksData.map(taskData => taskData.id);

  await validateAllTaskExists(req, taskIds);
  const tasksPrevState = await getTasksByIds(req, taskIds);
  validateTasksCategory(tasksPrevState, tasksPrevState[0].category);
  validateTasksOnSameParty(tasksPrevState, tasksPrevState[0].partyId);

  const areAppointments = tasksPrevState[0].category === DALTypes.TaskCategories.APPOINTMENT;
  const updatedTasks = areAppointments ? await apptsService.updateAppointments(req, tasksData) : await updateTasksInDb(req, tasksData);

  if (updatedTasks.length && !areAppointments) {
    await mapSeries(updatedTasks, async task => {
      await tasksService.logTaskUpdated(req, task);
    });
  }

  const partyIds = uniq(updatedTasks.map(t => t.partyId));
  const parties = await loadPartiesByIds(req, partyIds);
  const teams = uniq(flattenDeep(parties.map(party => party.teams)));

  const notificationPayload = updatedTasks.map(t => ({
    taskId: t.id,
    partyId: t.partyId,
  }));
  notify({
    ctx: req,
    event: eventTypes.PROCESS_TASK_EVENT,
    data: { tasks: notificationPayload, partyIds },
    routing: { teams },
  });

  return updatedTasks;
};
