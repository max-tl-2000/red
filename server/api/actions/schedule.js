/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import map from 'lodash/map';
import pick from 'lodash/pick';
import groupBy from 'lodash/groupBy';
import { ServiceError } from '../../common/errors';
import { loadDaysWithAppointments, loadAppointmentsForUserAndDays } from '../../dal/appointmentRepo';
import { parseAsInTimezone, now, toMoment } from '../../../common/helpers/moment-utils';
import { DATE_ONLY_FORMAT } from '../../../common/date-constants';

async function getTasks(tenantId, salesPersonIds, days, timezone) {
  const tasks = await loadAppointmentsForUserAndDays({ tenantId }, salesPersonIds, days, { timezone });
  const cleanTasks = map(tasks, task => pick(task, ['id', 'partyId', 'state', 'metadata', 'guests', 'units', 'userIds']));
  const groupedTasks = groupBy(cleanTasks, task => toMoment(task.metadata.startDate, { timezone }).format(DATE_ONLY_FORMAT));

  return days.reduce(
    (acc, day) => ({
      ...acc,
      [day]: groupedTasks[day] || [],
    }),
    {},
  );
}

export const getScheduleOverview = async req => {
  const { preloadDays } = req.query;
  // TODO: add a check for the required timezone parameter
  const { users, timezone } = req.body;

  if (!users) {
    throw new ServiceError({
      token: 'USERS_AND_TEAMS_NOT_SPECIFIED',
      status: 400,
    });
  }

  const nowDate = now({ timezone }).startOf('day');

  let daysWithTasks = await loadDaysWithAppointments(req, { salesPersonIds: users, timezone, minDate: nowDate.clone().add(-14, 'd') });

  daysWithTasks = daysWithTasks.map(d => parseAsInTimezone(d, { timezone }));

  const daysInPast = daysWithTasks.filter(d => d.isBefore(nowDate, 'day'));

  const daysInFuture = daysWithTasks.filter(d => !d.isBefore(nowDate, 'day'));

  const daysToPreload = [...daysInPast, ...daysInFuture.slice(0, preloadDays || 0)].map(d => d.format(DATE_ONLY_FORMAT));

  const tasks = await getTasks(req.tenantId, users, daysToPreload, timezone);

  return {
    daysWithTasks: daysWithTasks.map(d => d.format(DATE_ONLY_FORMAT)),
    tasks,
  };
};

export function getScheduleForDays(req) {
  const { query } = req;
  const { timezone } = query;
  const days = [].concat(query.days || []);

  return getTasks(req.tenantId, [req.authUser.id], days, timezone);
}
