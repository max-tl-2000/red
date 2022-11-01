/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import range from 'lodash/range';
import groupBy from 'lodash/groupBy';
import difference from 'lodash/difference';
import { loadAppointmentsForUserAndDays } from '../dal/appointmentRepo';
import { getUsersEventsForDatesByUserIds, getTeamEventsForDatesByTeamId } from '../dal/calendarEventsRepo';
import { getTeamMembers, getTeamById } from '../dal/teamsRepo';
import { toMoment, DATE_ISO_FORMAT, parseAsInTimezone, isSameDay } from '../../common/helpers/moment-utils';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import {
  roundDateUpToThirtyMinutes,
  roundDateToThirtyMinutes,
  roundDateDownForCalendarSlot,
  roundDateUpForCalendarSlot,
} from '../../common/helpers/date-utils';
import { getAgentsAvailabilityForTeam, isFloatingAgent } from './floatingAgents';
import { CalendarUserEventType } from '../../common/enums/calendarTypes';
import { isAllDayEvent, convertToMomentFromDateOnlyOrISOFormat } from './helpers/calendarHelpers';
import { DALTypes } from '../../common/enums/DALTypes';

const getDateForAllDayEvent = (date, timezone) => convertToMomentFromDateOnlyOrISOFormat(date, { timezone }).startOf('day').toISOString();

const getSlotsRange = (numberOfDays, slotDuration) => {
  const intervalInMinutes = numberOfDays * 24 * 60;
  const numOfCalendarSlots = Math.ceil(intervalInMinutes / slotDuration);
  return range(numOfCalendarSlots);
};

const sanitizeExternalEvents = (timezone, events = []) =>
  events.map(ev => {
    const isAllDay = isAllDayEvent(ev, timezone);
    return {
      id: ev.id,
      isAllDay,
      startDate: isAllDay ? getDateForAllDayEvent(ev.startDate, timezone) : roundDateToThirtyMinutes(ev.startDate).toISOString(),
      endDate: isAllDay ? getDateForAllDayEvent(ev.endDate, timezone) : roundDateUpToThirtyMinutes(ev.endDate).toISOString(),
    };
  });

const setTeamAllDayEvent = ({ event, calendarSlots, timezone, slotDuration }) => {
  const { startDate: start, endDate: end } = event;
  const startDate = getDateForAllDayEvent(start, timezone);
  const endDate = getDateForAllDayEvent(end, timezone);
  const startMoment = toMoment(startDate, { timezone }).startOf('day');
  const endMoment = toMoment(endDate, { timezone }).startOf('day');
  const numberOfDays = endMoment.diff(startMoment, 'days');
  const daysSlotsRange = getSlotsRange(numberOfDays, slotDuration);
  const daysSlotsKeys = daysSlotsRange.map(s =>
    toMoment(startDate, { timezone })
      .startOf('day')
      .add(s * slotDuration, 'minutes')
      .toISOString(),
  );

  daysSlotsKeys.forEach(k => calendarSlots.has(k) && calendarSlots.delete(k));

  calendarSlots.set(startMoment.toISOString(), {
    startDate: startMoment.toISOString(),
    endDate: endMoment.toISOString(),
    availableAgents: [],
    isAllDay: true,
    isTeam: true,
  });
};

const getBusySlotsFromEvent = (event, slotDuration, timezone) => {
  const { startDate, endDate } = event;
  const startSlotsMoment = roundDateDownForCalendarSlot(startDate, slotDuration, timezone);
  const endSlotsMoment = roundDateUpForCalendarSlot(endDate, slotDuration, timezone);
  const numOfBusySlots = endSlotsMoment.diff(startSlotsMoment, 'minutes') / slotDuration;
  return range(numOfBusySlots).map(i =>
    startSlotsMoment
      .clone()
      .add(i * slotDuration, 'minutes')
      .toISOString(),
  );
};

const sanitizePersonalEventForSlots = (event, timezone) => {
  if (isAllDayEvent(event, timezone)) {
    return {
      ...event,
      startDate: getDateForAllDayEvent(event.startDate, timezone),
      endDate: getDateForAllDayEvent(event.endDate, timezone),
    };
  }
  return event;
};

const setUserPersonalEventsBusySlots = ({ calendarSlots, usersEvents, timezone, slotDuration }) => {
  usersEvents.forEach(e => {
    const event = sanitizePersonalEventForSlots(e, timezone);
    const busySlots = getBusySlotsFromEvent(event, slotDuration, timezone);
    busySlots.forEach(s => {
      const currentSlot = calendarSlots.get(s);
      if (currentSlot && currentSlot.isTeam) return;
      currentSlot && calendarSlots.set(s, { ...currentSlot, availableAgents: difference(currentSlot.availableAgents, [e.userId]) });
    });
  });
  return calendarSlots;
};

const setTeamBusySlots = ({ calendarSlots, teamEvents, timezone, slotDuration }) => {
  teamEvents.forEach(e => {
    if (isAllDayEvent(e, timezone)) {
      // if it is all day event, the slots from calerndarSlots will be removed for that day and replaced with single event/slot
      setTeamAllDayEvent({ event: e, calendarSlots, timezone, slotDuration });
    } else {
      const busySlots = getBusySlotsFromEvent(e, slotDuration, timezone);
      busySlots.forEach(s => {
        const currentSlot = calendarSlots.get(s);
        currentSlot && calendarSlots.set(s, { ...currentSlot, availableAgents: [], isTeam: true });
      });
    }
  });
  return calendarSlots;
};

const getAgentsWithMultipleTeams = async (userIds, teamMembers) => {
  const grouppedAgents = groupBy(teamMembers, tm => tm.userId);
  return Object.keys(grouppedAgents).filter(
    group => grouppedAgents[group].filter(t => t.module !== DALTypes.ModuleType.RESIDENT_SERVICES).length > 1 && userIds.some(u => u === group),
  );
};

const getAvailableAgentsForSlot = ({ userIds, multiTeamAgentIds, usersAvailabilitiesForTeam, slotStartMoment }) =>
  userIds.filter(
    u => !multiTeamAgentIds.some(mt => mt === u) || usersAvailabilitiesForTeam.some(a => a.userId === u && a.day === slotStartMoment.format(DATE_ISO_FORMAT)),
  );

const createCalendarTimeSlotsMap = async (ctx, { startDate, numberOfDays, userIds, timezone, slotDuration, teamMembers, teamId }) => {
  const slotsRange = getSlotsRange(numberOfDays, slotDuration);
  const teamModuleForSearchedTeam = (teamMembers.find(tm => tm.teamId === teamId) || {}).module;
  const multiTeamAgentIds = teamModuleForSearchedTeam === DALTypes.ModuleType.RESIDENT_SERVICES ? [] : await getAgentsWithMultipleTeams(userIds, teamMembers);

  const startDateMoment = convertToMomentFromDateOnlyOrISOFormat(startDate, { timezone });
  const endDateMoment = startDateMoment.clone().add(numberOfDays, 'days');

  const usersAvailabilitiesForTeam = await getAgentsAvailabilityForTeam(ctx, {
    userIds: multiTeamAgentIds,
    teamId,
    startDate: startDateMoment.toISOString(),
    endDate: endDateMoment.toISOString(),
  });

  return new Map(
    slotsRange.map(s => {
      const startMoment = startDateMoment
        .clone()
        .startOf('day')
        .add(s * slotDuration, 'minutes');
      const endMoment = startMoment.clone().add(slotDuration, 'minutes');

      return [
        startMoment.toISOString(),
        {
          startDate: startMoment.toISOString(),
          endDate: endMoment.toISOString(),
          availableAgents: getAvailableAgentsForSlot({ userIds, multiTeamAgentIds, usersAvailabilitiesForTeam, slotStartMoment: startMoment }),
          isTeam: false,
          isAllDay: false,
        },
      ];
    }),
  );
};

const getTeamEvents = async (req, { userId, teamId, date, timezone }) => {
  const floatingAgent = await isFloatingAgent(req, userId);
  const team = await getTeamById(req, teamId);

  if (floatingAgent && team.module !== DALTypes.ModuleType.RESIDENT_SERVICES) {
    const [rawFloatingAgentAvailability] = await getAgentsAvailabilityForTeam(req, { userIds: [userId], teamId, startDate: date, endDate: date });
    if (!rawFloatingAgentAvailability || rawFloatingAgentAvailability.teamId !== teamId) {
      const startDate = parseAsInTimezone(date, { format: DATE_ISO_FORMAT, timezone }).toISOString();
      const endDate = parseAsInTimezone(date, { format: DATE_ISO_FORMAT, timezone }).add(1, 'day').toISOString();
      return sanitizeExternalEvents(timezone, [{ id: newId(), startDate, endDate }]);
    }
  }

  const startDate = parseAsInTimezone(date, { timezone, format: DATE_ISO_FORMAT }).toISOString();
  const rawTeamEvents = await getTeamEventsForDatesByTeamId(req, { teamId, startDate, noOfDays: 1 });
  return sanitizeExternalEvents(timezone, rawTeamEvents);
};

const extractEventsForDay = (date, timezone, events) => {
  const startOfDayInTz = parseAsInTimezone(date, { timezone, format: DATE_ISO_FORMAT }).startOf('day');
  const startOfNextDayInTz = startOfDayInTz.clone().add(1, 'days');
  return events.map(e => {
    const startDate = toMoment(e.startDate, { timezone }).isBefore(startOfDayInTz) ? startOfDayInTz.toISOString() : e.startDate;
    const endDate = toMoment(e.endDate, { timezone }).isAfter(startOfNextDayInTz) ? startOfNextDayInTz.toISOString() : e.endDate;
    return { ...e, startDate, endDate };
  });
};

export const getUserAndTeamDayEvents = async (req, { userId, teamId, date, timezone }) => {
  const startDate = parseAsInTimezone(date, { timezone, format: DATE_ISO_FORMAT }).toISOString();
  const rawUserEvents = await getUsersEventsForDatesByUserIds(req, { userIds: [userId], startDate, noOfDays: 1 });
  const appointments = await loadAppointmentsForUserAndDays(req, [userId], [date], { timezone });
  const rawPersonalAndPendingApp = rawUserEvents.filter(
    e => e.metadata.type === CalendarUserEventType.PERSONAL || (e.metadata.type === CalendarUserEventType.SELF_BOOK && !e.metadata.id),
  );
  const rawSickLeaveEvents = rawUserEvents.filter(e => e.metadata.type === CalendarUserEventType.SICK_LEAVE);

  const userEvents = extractEventsForDay(date, timezone, sanitizeExternalEvents(timezone, rawPersonalAndPendingApp));
  const sickLeaveEvents = extractEventsForDay(date, timezone, sanitizeExternalEvents(timezone, rawSickLeaveEvents));
  const teamEventsFull = await getTeamEvents(req, { userId, teamId, date, timezone });
  const teamEvents = extractEventsForDay(date, timezone, teamEventsFull);
  return { appointments, userEvents, teamEvents, sickLeaveEvents };
};

export const getTeamCalendarSlots = async (req, { teamId, date, timezone, numberOfDays, slotDuration }) => {
  const isActiveAgent = tm => !tm.inactive && tm.functionalRoles.includes(FunctionalRoleDefinition.LWA.name);

  const teamMembers = (await getTeamMembers(req.tenantId)).filter(isActiveAgent);
  const userIds = teamMembers.filter(t => t.teamId === teamId).map(p => p.userId);

  const startDateMoment = convertToMomentFromDateOnlyOrISOFormat(date, { timezone });
  const startDate = startDateMoment.toISOString();
  const usersEvents = await getUsersEventsForDatesByUserIds(req, { userIds, startDate, noOfDays: numberOfDays });
  const teamEvents = await getTeamEventsForDatesByTeamId(req, { teamId, startDate, noOfDays: numberOfDays });

  const calendarSlots = await createCalendarTimeSlotsMap(req, { startDate, numberOfDays, userIds, timezone, slotDuration, teamMembers, teamId });

  setTeamBusySlots({ calendarSlots, teamEvents, timezone, slotDuration });
  setUserPersonalEventsBusySlots({ calendarSlots, usersEvents, timezone, slotDuration });

  return Array.from(calendarSlots.values());
};

export const getCalendarEventsForNewOwner = async (ctx, { userId, teamId, startDate, noOfDays }) => {
  const userEvents = await getUsersEventsForDatesByUserIds(ctx, {
    userIds: [userId],
    startDate,
    noOfDays,
  });

  const teamEvents = await getTeamEventsForDatesByTeamId(ctx, {
    teamId,
    startDate,
    noOfDays,
  });

  return [...userEvents.map(e => ({ startDate: e.startDate, endDate: e.endDate })), ...teamEvents.map(e => ({ startDate: e.startDate, endDate: e.endDate }))];
};

const isBeforeDate = (startDate, endDate) => toMoment(startDate).isBefore(toMoment(endDate));

const appointmentOverlapsEvents = (appointment, userAndTeamEvents) =>
  userAndTeamEvents.some(
    toUserAppointment =>
      isBeforeDate(appointment.metadata.startDate, toUserAppointment.endDate) && isBeforeDate(toUserAppointment.startDate, appointment.metadata.endDate),
  );

const isUserUnavailableForAppointmentDays = (appointment, availabilities) =>
  availabilities.some(a => (isSameDay(a.day, appointment.metadata.startDate) || isSameDay(a.day, appointment.metadata.endDate)) && !a.available);

export const isOverlappingAppointment = (appointment, userAndTeamEvents, availabilities = []) =>
  appointmentOverlapsEvents(appointment, userAndTeamEvents) || isUserUnavailableForAppointmentDays(appointment, availabilities);

export const getOverlappingAppointments = (partyOwnerActiveAppointments, userAndTeamEvents, availabilities) =>
  partyOwnerActiveAppointments.filter(
    fromUserAppointment =>
      userAndTeamEvents.some(
        toUserAppointment =>
          isBeforeDate(fromUserAppointment.metadata.startDate, toUserAppointment.endDate) &&
          isBeforeDate(toUserAppointment.startDate, fromUserAppointment.metadata.endDate),
      ) ||
      availabilities.some(
        a => (isSameDay(a.day, fromUserAppointment.metadata.startDate) || isSameDay(a.day, fromUserAppointment.metadata.endDate)) && !a.available,
      ),
  );

export const appointmentsOverlap = (first, second) =>
  isBeforeDate(first.metadata.startDate, second.metadata.endDate) && isBeforeDate(second.metadata.startDate, first.metadata.endDate);
