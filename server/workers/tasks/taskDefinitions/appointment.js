/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getTasksForPartiesByName } from '../../../dal/tasksRepo';
import { cancelAppointment } from '../../../services/appointments';
import { DALTypes } from '../../../../common/enums/DALTypes';

import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'Appointment' });

const getTasksToUpdate = async (ctx, partyIds) => {
  logger.debug({ ctx, partyIds }, 'Appointment - getTasksToUpdate');
  const appointments = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.APPOINTMENT);
  return appointments.filter(task => task.state === DALTypes.TaskStates.ACTIVE);
};

export const markTasksCanceled = async (ctx, partyId) => {
  const tasksToUpdate = await getTasksToUpdate(ctx, [partyId]);
  return await mapSeries(tasksToUpdate, async task => await cancelAppointment(ctx, { ...task, sendConfirmationMail: true }));
};

export const appointment = {
  name: DALTypes.TaskNames.APPOINTMENT,
  category: DALTypes.TaskCategories.APPOINTMENT,
  markTasksCanceled,
};
