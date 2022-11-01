/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fromPairs from 'lodash/fromPairs';
import logger from '../../common/helpers/logger';
import { toMoment, DATE_ISO_FORMAT, isSameDay } from '../../common/helpers/moment-utils';
import { getUsersAvailabilities, saveAvailability, deleteUserAvailability } from '../dal/floatingAgentsRepo';
import { getTeamMembersByUserId, getTeamsWhereUserIsAgent } from '../dal/teamsRepo';
import { DALTypes } from '../../common/enums/DALTypes';

const formatDay = dayAsDateTime => toMoment(dayAsDateTime).format(DATE_ISO_FORMAT);

export const isFloatingAgent = async (ctx, userId) => {
  const allAgentTeams = await getTeamsWhereUserIsAgent(ctx, userId);
  const agentTeams = allAgentTeams.filter(t => t.module !== DALTypes.ModuleType.RESIDENT_SERVICES);
  return agentTeams.length > 1;
};

export const getAgentAvailability = async (ctx, { userId, startDate, endDate }) => {
  logger.trace({ ctx, userId, startDate, endDate }, 'getAgentAvailability');
  const agentAvailabilities = await getUsersAvailabilities(ctx, [userId], startDate, endDate);
  return fromPairs(agentAvailabilities.map(({ day, teamId }) => [formatDay(day), teamId]));
};

export const getAgentsAvailabilityForTeam = async (ctx, { userIds, teamId, startDate, endDate }) => {
  logger.trace({ ctx, userIds, teamId, startDate, endDate }, 'getAgentsAvailabilityForTeam');
  const agentsAvailabilities = (await getUsersAvailabilities(ctx, userIds, startDate, endDate)).filter(av => av.teamId === teamId);
  return agentsAvailabilities.map(av => ({ ...av, day: formatDay(av.day) }));
};

export const deleteAgentAvailability = async (ctx, userId, day) => {
  logger.trace({ ctx, userId, day }, 'deleteAgentAvailability');
  const teamMemberIds = (await getTeamMembersByUserId(ctx, userId)).map(t => t.id);

  return await deleteUserAvailability(ctx, teamMemberIds, day);
};

export const saveAgentAvailability = async (ctx, { teamMemberId, day, modifiedBy, userId }) => {
  logger.trace({ ctx, teamMemberId, day, modifiedBy, userId }, 'saveAgentAvailability');
  await deleteAgentAvailability(ctx, userId, day);

  return await saveAvailability(ctx, { teamMemberId, day, modifiedBy });
};

const isDayAvailable = (day, availabilities) => availabilities.some(av => isSameDay(day, av.day));

export const getAvailabilitiesForDays = async (ctx, { userId, teamId, dateInterval }) => {
  const floatingAgent = await isFloatingAgent(ctx, userId);
  if (floatingAgent) {
    const startInterval = toMoment(dateInterval.startDate).startOf('day');
    const endInterval = startInterval.clone().add(dateInterval.noOfDays, 'days');
    const availabilities = (await getUsersAvailabilities(ctx, [userId], startInterval.toISOString(), endInterval.toISOString())).filter(
      av => av.teamId === teamId,
    );
    return dateInterval.allDays.map(d => ({ day: d, available: isDayAvailable(d, availabilities) }));
  }
  return dateInterval.allDays.map(d => ({ day: d, available: true }));
};
