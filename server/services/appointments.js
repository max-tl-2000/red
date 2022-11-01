/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import isEqual from 'lodash/isEqual';
import flatten from 'lodash/flatten';
import difference from 'lodash/difference';
import { mapSeries } from 'bluebird';
import * as tasksRepo from '../dal/tasksRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { performPartyStateTransition } from './partyStatesTransitions';
import { logEntityUpdated, logEntityRemoved, logEntityAdded, logEntity } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { isAnonymousEmail } from '../../common/helpers/anonymous-email';
import { getDisplayName } from '../../common/helpers/person-helper';
import { getUserFullNameById, getUsersFullNamesByIds, getUserById } from '../dal/usersRepo';
import { getInventoriesByIds, getInventoryById } from '../dal/inventoryRepo';
import { formatSimpleAddress } from '../../common/helpers/addressUtils';
import { getAppointmentAddress } from './helpers/calendarHelpers';
import {
  loadPartyMemberByIds,
  loadPartyById,
  getPartyOwner,
  updatePartyCollaborators,
  getPartyMembersByEmailAddress,
  getPartyMemberByEmailAddress,
  getPartyMemberByPhoneNumber,
  getAssignedPropertyByPartyId,
  saveFirstCompletedTourData,
  getTimezoneForParty,
} from '../dal/partyRepo';
import { markUnitsAsFavorite } from './favoriteUnits';
import { runInTransaction } from '../database/factory';
import { getTeamById } from '../dal/teamsRepo';
import { getTenantData } from '../dal/tenantsRepo';
import { isTeamCallCenter } from './helpers/teams';
import { isDemoDomain } from '../../common/helpers/utils';
import * as eventService from './partyEvent';
import logger from '../../common/helpers/logger';
import { now, toMoment } from '../../common/helpers/moment-utils';
import * as externalCalendar from './externalCalendars/cronofyService';
import { isSelfServiceAppointment } from '../../common/helpers/tasks';
import { getTeamCalendarSlotDuration } from '../dal/propertyRepo';
import { sendAppointmentCommunication } from './mjmlEmails/appointmentEmails';
import { AppointmentEmailType, AppointmentContextTypes } from '../../common/enums/enums';
import * as calendarEventsRepo from '../dal/calendarEventsRepo';
import { getCalendarEventsForNewOwner, isOverlappingAppointment as appointmentOverlapsEvents } from './calendar';
import { CalendarUserEventType } from '../../common/enums/calendarTypes';
import { getActiveAgentsFromTeamForSlotDay } from '../dal/floatingAgentsRepo';
import { getAvailabilitiesForDays } from './floatingAgents';
import { TIME_MERIDIEM_FORMAT, MONTH_DATE_YEAR_LONG_FORMAT } from '../../common/date-constants';
import { ServiceError } from '../common/errors';
import { addTokenToUrls } from '../helpers/urlShortener';
import { updatePartyTeams } from './helpers/party';
import { completedAppointmentsWithInventory } from '../helpers/party';
import config from '../config';
import { addNewCommunication } from './communication';
import { getPersonsByPartyMemberIds, getPersonById } from '../dal/personRepo';
import { notifyCommunicationUpdate } from '../helpers/notifications';
import eventTypes from '../../common/enums/eventTypes';
import { notify } from '../../common/server/notificationClient';

const getCalendarEventMetadata = appointment =>
  isSelfServiceAppointment(appointment.metadata)
    ? { id: appointment.id, type: CalendarUserEventType.SELF_BOOK }
    : { id: appointment.id, type: CalendarUserEventType.REVA };

export const appointmentToTaskModel = ({
  id,
  partyId,
  salesPersonId,
  state = DALTypes.TaskStates.ACTIVE,
  note = '',
  startDate,
  endDate,
  partyMembers = [],
  properties = [],
  teamId,
  createdBy,
  originalPartyOwner,
  originalAssignees,
  metadata = { appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.REVA },
  createdFromCommId,
  tourType,
}) => ({
  id,
  name: DALTypes.TaskNames.APPOINTMENT,
  partyId,
  state,
  userIds: [salesPersonId],
  dueDate: startDate,
  category: DALTypes.TaskCategories.APPOINTMENT,
  metadata: {
    teamId,
    note,
    startDate,
    endDate,
    partyMembers,
    inventories: properties,
    createdBy,
    originalPartyOwner,
    originalAssignees,
    tourType,
    ...metadata,
  },
  modified_by: createdBy,
  createdFromCommId,
});

export const appointmentToUserCalendarEventModel = appointment => {
  const {
    userIds,
    metadata: { startDate, endDate },
  } = appointment;

  return {
    userId: userIds[0],
    startDate,
    endDate,
    metadata: getCalendarEventMetadata(appointment),
  };
};

export const filterMembersWithEmail = members =>
  members.filter(member => member.contactInfo.defaultEmail && !isAnonymousEmail(member.contactInfo.defaultEmail));

export const filterMembersWithPhoneNo = members => members.filter(member => member.contactInfo.defaultPhone);

export const sendCommsOnCreateAppointment = async (req, appointmentData) => {
  logger.trace({ ctx: req, appointmentData }, 'sendCommsOnCreateAppointment');

  const appointment = await tasksRepo.getTaskById(req, appointmentData.appointmentId);
  const modifiedBy = await getUserById(req, appointment.modified_by);

  const { appointmentCreatedTemplate } = appointmentData.emailPropertyTemplates;

  await sendAppointmentCommunication(req, {
    appointmentData: appointment,
    propertyTemplate: appointmentCreatedTemplate,
    type: AppointmentEmailType.CREATE,
    modifiedBy,
  });
};

const getMembersToNotify = async (ctx, appointmentData, partyId) => {
  const { membersToSendEmailConfirmation = [], membersToSendEmailCancelation = [], membersToSendEmailUpdate = [] } = appointmentData.emails;
  const { membersToSendSMSConfirmation = [], membersToSendSMSUpdate = [], membersToSendSMSCancelation = [] } = appointmentData.phones;

  const getMembers = async (contacts, getMemberByContact) => (await mapSeries(contacts, c => getMemberByContact(ctx, c))).filter(m => !!m);

  const membersToSendAppointmentCanceledComm = flatten([
    ...(await getMembers(membersToSendEmailCancelation, getPartyMembersByEmailAddress)),
    ...(await getMembers(membersToSendSMSCancelation, getPartyMemberByPhoneNumber)),
  ]);

  const membersToSendAppointmentConfirmationComm = flatten([
    ...(await getMembers(membersToSendEmailConfirmation, getPartyMembersByEmailAddress)),
    ...(await getMembers(membersToSendSMSConfirmation, getPartyMemberByPhoneNumber)),
  ]);

  const membersToSendAppointmentUpdatedComm = flatten([
    ...(await getMembers(membersToSendEmailUpdate, getPartyMembersByEmailAddress)),
    ...(await getMembers(membersToSendSMSUpdate, getPartyMemberByPhoneNumber)),
  ]);

  const filteredMembersToSendAppointmentUpdatedComm = flatten(membersToSendAppointmentUpdatedComm).filter(m => m.partyId === partyId);

  return {
    membersToSendAppointmentConfirmationComm,
    membersToSendAppointmentUpdatedComm: filteredMembersToSendAppointmentUpdatedComm,
    membersToSendAppointmentCanceledComm,
  };
};

export const sendCommsOnUpdateAppointment = async (req, appointmentData, partyId) => {
  logger.trace({ ctx: req, appointmentData }, 'sendCommsOnUpdateAppointment');

  const appointment = await tasksRepo.getTaskById(req, appointmentData.appointmentId);

  const modifiedBy = await getUserById(req, appointment.modified_by);

  const { membersToSendAppointmentConfirmationComm, membersToSendAppointmentUpdatedComm, membersToSendAppointmentCanceledComm } = await getMembersToNotify(
    req,
    appointmentData,
    partyId,
  );

  const { appointmentCreatedTemplate, appointmentUpdatedTemplate, appointmentCancelledTemplate } = appointmentData.emailPropertyTemplates;

  const send = async (partyMembers, propertyTemplate, type) =>
    partyMembers.length &&
    (await sendAppointmentCommunication(req, {
      appointmentData: { ...appointment, partyMembers },
      propertyTemplate,
      type,
      modifiedBy,
    }));

  await send(membersToSendAppointmentConfirmationComm, appointmentCreatedTemplate, AppointmentEmailType.CREATE);
  await send(membersToSendAppointmentCanceledComm, appointmentCancelledTemplate, AppointmentEmailType.CANCEL);
  await send(membersToSendAppointmentUpdatedComm, appointmentUpdatedTemplate, AppointmentEmailType.UPDATE);
};

export const sendCommsOnCancelAppointment = async (req, appointmentData) => {
  logger.trace({ ctx: req, appointmentData }, 'sendCommsOnCancelAppointment');

  const appointment = await tasksRepo.getTaskById(req, appointmentData.appointmentId);
  const modifiedBy = await getUserById(req, appointment.modified_by);

  const { appointmentCancelledTemplate } = appointmentData.emailPropertyTemplates;

  await sendAppointmentCommunication(req, {
    appointmentData: appointment,
    propertyTemplate: appointmentCancelledTemplate,
    type: AppointmentEmailType.CANCEL,
    modifiedBy,
  });
};

const getCreatedByTypeForAppointment = (ctx, isSelfServiceAction) => {
  if (ctx.authUser && ctx.authUser.id) return DALTypes.CreatedByType.USER;
  return isSelfServiceAction ? DALTypes.CreatedByType.SELF_SERVICE : DALTypes.CreatedByType.SYSTEM;
};

const getActivityLogEntryForAppointment = async (req, appointment, isSelfServiceAction = false) => {
  const salesPerson = await getUserFullNameById(req, appointment.userIds[0]);
  const partyMembers = (await loadPartyMemberByIds(req, appointment.metadata.partyMembers)).map(getDisplayName);
  const unitNames = (await getInventoriesByIds(req, appointment.metadata.inventories)).map(i => i.name);
  const appointmentResult = appointment.metadata.appointmentResult || '';
  const closingNote = appointment.metadata.closingNote || '';

  const createdBy = await getUserFullNameById(req, appointment.metadata.createdBy);
  const partyOwner = await getUserFullNameById(req, appointment.metadata.originalPartyOwner);
  const completedBy = await getUserFullNameById(req, appointment.metadata.completedBy);
  const reopenedBy = await getUserFullNameById(req, appointment.metadata.reopenedBy);
  const assignee = (await getUsersFullNamesByIds(req, appointment.metadata.originalAssignees || [])).join(', ');
  const createdByType = getCreatedByTypeForAppointment(req, isSelfServiceAction);
  return {
    unitNames,
    salesPerson,
    partyMembers,
    partyId: appointment.partyId,
    id: appointment.id,
    note: appointment.metadata.note,
    startDate: appointment.metadata.startDate,
    endDate: appointment.metadata.endDate,
    state: appointment.state,
    closingNote,
    appointmentResult,
    createdBy,
    partyOwner,
    assignee,
    completedBy,
    reopenedBy,
    createdByType,
  };
};

const isAppointmentCompleted = ({ state, metadata = {} }) =>
  state === DALTypes.TaskStates.COMPLETED && metadata.appointmentResult === DALTypes.AppointmentResults.COMPLETE;

export const getFirstInventoryByAppointment = async (ctx, appointmentId) => {
  const appointment = await tasksRepo.getTaskById(ctx, appointmentId);
  const [inventoryId] = appointment.metadata.inventories || [];
  if (!inventoryId) return undefined;
  return await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });
};

const reassignParty = async (ctx, appointment) => {
  const party = await loadPartyById(ctx, appointment.partyId);
  const [assignedUser] = appointment.userIds;
  if (assignedUser === party.userId) return false;
  const team = await getTeamById(ctx, party.ownerTeam);
  // eslint-disable-next-line global-require
  const { assignParty } = require('./party');

  // eslint-disable-next-line global-require
  const { addTask } = require('./tasks');

  const followupAfterTourCompletionTask = {
    name: 'Followup with party after tour completion',
    category: DALTypes.TaskCategories.PARTY,
    partyId: party.id,
    userIds: [assignedUser],
    dueDate: now(),
  };

  logger.trace({ ctx, team, isCallCenter: isTeamCallCenter(team) }, 'RE-ASSIGN PARTY');
  if (!team || !isTeamCallCenter(team)) return false;
  const { teamId } = appointment.metadata;
  await assignParty(ctx, party, { userId: assignedUser, teamId });
  await addTask(ctx, followupAfterTourCompletionTask);
  return true;
};

const delayedReassignParty = async (ctx, appointment) => {
  if (isAppointmentCompleted(appointment)) {
    return await new Promise(resolve =>
      setTimeout(async () => {
        await reassignParty(ctx, appointment);
        resolve();
      }, 20000),
    );
  }
  return true;
};

export const savePartyEvent = async (ctx, updatedAppointment, delta, partyData) => {
  if (!delta) return;

  let eventInfo;
  const userId = ctx.authUser ? ctx.authUser.id : '';

  switch (delta.state) {
    case DALTypes.TaskStates.COMPLETED:
      eventInfo = {
        partyId: updatedAppointment.partyId,
        userId,
        metadata: {
          appointmentId: updatedAppointment.id,
        },
      };
      await eventService.saveAppointmentCompletedEvent(ctx, eventInfo);
      break;
    case DALTypes.TaskStates.CANCELED: {
      const partyMembers = await loadPartyMemberByIds(ctx, updatedAppointment.metadata.partyMembers);
      const trimmedPartyMembers = partyMembers.map(pm => ({
        id: pm.id,
        contactInfo: {
          ...(pm.contactInfo.defaultEmail && { defaultEmail: pm.contactInfo.defaultEmail }),
          ...(pm.contactInfo.defaultPhone && { defaultPhone: pm.contactInfo.defaultPhone }),
        },
      }));

      eventInfo = {
        partyId: updatedAppointment.partyId,
        userId,
        metadata: {
          appointmentId: updatedAppointment.id,
          userHasConfirmedCommSending: delta.sendConfirmationMail || false,
          removedMembers: trimmedPartyMembers || [],
        },
      };
      await eventService.saveAppointmentCanceledEvent(ctx, eventInfo);
      break;
    }
    default: {
      const { addedMembers, removedMembers, hasAppointmentDateChanged } = partyData;

      eventInfo = {
        partyId: updatedAppointment.partyId,
        userId,
        metadata: {
          appointmentId: updatedAppointment.id,
          addedMembers: addedMembers || [],
          removedMembers: removedMembers || [],
          hasAppointmentDateChanged: hasAppointmentDateChanged || false,
        },
      };
      await eventService.saveAppointmentUpdatedEvent(ctx, eventInfo, partyData);
    }
  }
};

const saveUserCalendarEvent = async (ctx, appointment, existingUserCalendarEventId) => {
  logger.trace({ ctx, appointment, existingUserCalendarEventId }, 'saveUserCalendarEvent - params');

  if (existingUserCalendarEventId) {
    return await calendarEventsRepo.saveEventMetadataId(ctx, existingUserCalendarEventId, appointment.id);
  }

  const userEvent = appointmentToUserCalendarEventModel(appointment);
  return await calendarEventsRepo.saveUserEvent(ctx, userEvent);
};

export const updateUserCalendarEvent = async (ctx, appointment) => {
  logger.trace({ ctx, appointment }, 'updateUserCalendarEvent - params');
  const userEvent = appointmentToUserCalendarEventModel(appointment);
  return await calendarEventsRepo.updateUserEvent(ctx, userEvent);
};

const updateCalendarEvents = async (ctx, updatedAppointment, oldAppointment) => {
  const isCanceled = updatedAppointment.state === DALTypes.TaskStates.CANCELED;
  const isReassigned = !isEqual(updatedAppointment.userIds, oldAppointment.userIds);
  const isReactivated = updatedAppointment.state === DALTypes.TaskStates.ACTIVE && oldAppointment.state === DALTypes.TaskStates.CANCELED;

  if (isReassigned || isCanceled) await externalCalendar.removeEventByAppointment(ctx, oldAppointment);

  const propertyAddress = await getAppointmentAddress(ctx, updatedAppointment);

  if (isCanceled) {
    await calendarEventsRepo.removeUserEvent(ctx, getCalendarEventMetadata(updatedAppointment));
  } else if (isReactivated) {
    await externalCalendar.createEvent(ctx, { appointment: updatedAppointment, propertyAddress });
    await saveUserCalendarEvent(ctx, updatedAppointment);
  } else {
    await externalCalendar.updateEvent(ctx, { appointment: updatedAppointment, propertyAddress });
    await updateUserCalendarEvent(ctx, updatedAppointment);
  }
};

const enhance = delta => ({
  withDueDate: () => enhance(!delta.metadata || !delta.metadata.startDate ? delta : { ...delta, dueDate: delta.metadata.startDate }),

  withRescheduledInfo: prevState => {
    const {
      metadata: { startDate },
    } = prevState;
    const newStartDate = (delta.metadata || {}).startDate;
    const hasStartDateChanged = !!newStartDate && newStartDate !== startDate;

    return enhance(hasStartDateChanged ? { ...delta, metadata: { ...delta.metadata, rescheduled: true } } : delta);
  },

  delta: () => delta,
});

const getAppointmentDates = appointment => {
  // added an extra 2 days to the days we are selecting beucause the diff function returns the full day difference between two days
  // example : in case end date is 13.07.2018 01:50 and start date is 12.07.2018 23:50, the function returns 0 days, but we acutally want 2 days
  const noOfDays = toMoment(appointment.metadata.endDate).diff(toMoment(appointment.metadata.startDate), 'days') + 2;
  const startDate = toMoment(appointment.metadata.startDate).startOf('day').toISOString();
  const allDays = [startDate, toMoment(appointment.metadata.endDate).startOf('day').toISOString()];
  return { startDate, noOfDays, allDays };
};

const isOverlappingAppointment = async (ctx, appointment, oldAppointment) => {
  const appointmentDates = getAppointmentDates(oldAppointment);

  const isAgentAvailableForDays = (
    await getAvailabilitiesForDays(ctx, {
      userId: appointment.userIds[0],
      teamId: appointment.metadata.teamId,
      dateInterval: appointmentDates,
    })
  ).every(av => av.available);

  if (!isAgentAvailableForDays) return true;

  const toUserAndTeamEvents = await getCalendarEventsForNewOwner(ctx, {
    userId: appointment.userIds[0],
    teamId: appointment.metadata.teamId,
    startDate: oldAppointment.metadata.startDate,
    noOfDays: appointmentDates.noOfDays,
  });

  return appointmentOverlapsEvents(oldAppointment, toUserAndTeamEvents);
};

const validateNewAppointmentOwner = async (ctx, appointment, oldAppointment) => {
  const isAppointmentConflict = await isOverlappingAppointment(ctx, appointment, oldAppointment);

  if (isAppointmentConflict) {
    throw new ServiceError({
      token: 'APPOINTMENTS_CONFLICT',
      status: 412,
      data: {
        appointmentIds: [oldAppointment.id],
      },
    });
  }
};
const logAction = async (ctx, updatedAppointment, prevState, isSelfServiceAction) => {
  const currentActivityLogEntry = await getActivityLogEntryForAppointment(ctx, updatedAppointment, isSelfServiceAction);

  if (updatedAppointment.state === DALTypes.TaskStates.CANCELED) {
    await logEntityRemoved(ctx, currentActivityLogEntry, COMPONENT_TYPES.APPOINTMENT);
  } else {
    const previousActivityLogEntry = await getActivityLogEntryForAppointment(ctx, prevState);
    const createdByType = getCreatedByTypeForAppointment(ctx, isSelfServiceAction);
    await logEntityUpdated({
      req: ctx,
      entityPrevState: previousActivityLogEntry,
      entityNextState: currentActivityLogEntry,
      component: COMPONENT_TYPES.APPOINTMENT,
      createdByType,
    });
  }
};

const enhanceMetadata = metadata => {
  if (metadata?.closingNote) return { ...metadata, closingNoteDate: now() };
  if (metadata?.feedback) return { ...metadata, feedbackDate: now() };

  return metadata;
};

const isDemoMode = async ctx => {
  const tenant = await getTenantData(ctx);
  return tenant.metadata.isDemoMode;
};

export const updateAppointment = async (ctx, id, data, isSelfServiceAction = false) => {
  logger.trace({ ctx, id, data, isSelfServiceAction }, 'updateAppointment - params');
  const { hasAppointmentDateChanged, sendConfirmationMail = false, checkConflictingAppointments = false, ...rest } = data;

  const prevState = await tasksRepo.getTaskById(ctx, id);
  const delta = enhance(rest).withRescheduledInfo(prevState).withDueDate().delta();

  delta.metadata = enhanceMetadata(delta.metadata);

  const addedMembers = delta.metadata && delta.metadata.partyMembers ? difference(delta.metadata.partyMembers, prevState.metadata.partyMembers) : [];
  const removedMembers = delta.metadata && delta.metadata.partyMembers ? difference(prevState.metadata.partyMembers, delta.metadata.partyMembers) : [];
  const isReassigned = !isEqual(delta.userIds, prevState.userIds);
  checkConflictingAppointments && isReassigned && (await validateNewAppointmentOwner(ctx, delta, prevState));
  const updatedAppointment = await tasksRepo.updateTask(ctx, id, delta);
  await updateCalendarEvents(ctx, updatedAppointment, prevState);
  await updatePartyCollaborators(ctx, updatedAppointment.partyId, updatedAppointment.userIds);

  await performPartyStateTransition(ctx, prevState.partyId);
  const {
    partyId,
    metadata: { inventories = [], startDate, teamId },
    userIds,
  } = updatedAppointment;
  const [inventoryId] = inventories;
  const { teams } = await loadPartyById(ctx, partyId);
  const timezone = await getTimezoneForParty(ctx, partyId);

  if (inventoryId) {
    await markUnitsAsFavorite(ctx, partyId, inventories);

    const partyTasks = await tasksRepo.getTasksByPartyIds(ctx, [updatedAppointment.partyId]);
    const completedTasks = completedAppointmentsWithInventory(partyTasks || []);

    if (completedTasks.length === 1) {
      const appointmentInventory = await getInventoryById(ctx, {
        id: inventoryId,
        expand: true,
      });

      await saveFirstCompletedTourData(ctx, updatedAppointment.partyId, {
        propertyId: appointmentInventory.propertyId,
        property: { externalId: appointmentInventory.property.externalId },
        inventoryId,
      });
    }
  }

  await logAction(ctx, updatedAppointment, prevState, isSelfServiceAction);
  await savePartyEvent(ctx, updatedAppointment, { ...delta, sendConfirmationMail }, { addedMembers, removedMembers, hasAppointmentDateChanged });

  const isDemoTenant = await isDemoMode(ctx);
  if (isDemoDomain(ctx) || isDemoTenant) {
    await delayedReassignParty(ctx, updatedAppointment);
  }

  notify({
    ctx,
    event: eventTypes.LOAD_APPOINTMENTS_EVENT,
    data: {
      date: startDate,
      agentId: userIds?.[0],
      teamId,
      timezone,
      isNotification: true,
    },
    routing: { teams },
  });

  return updatedAppointment;
};

export const cancelAppointment = async (ctx, app) => {
  const { sendConfirmationMail = false, isSelfServiceAction = false } = app;

  return await updateAppointment(
    ctx,
    app.id,
    {
      state: DALTypes.TaskStates.CANCELED,
      metadata: { appointmentResult: DALTypes.AppointmentResults.CANCELLED },
      sendConfirmationMail,
    },
    isSelfServiceAction,
  );
};

const logMultipleEntityUpdated = async (req, appointmentIds, appointmentsPrevState, appointmentsNextState) => {
  await mapSeries(appointmentIds, async appointmentId => {
    const apptPrevState = appointmentsPrevState.find(appt => appt.id === appointmentId);
    const apptNextState = appointmentsNextState.find(appt => appt.id === appointmentId);
    const previousActivityLogEntry = await getActivityLogEntryForAppointment(req, apptPrevState);
    const currentActivityLogEntry = await getActivityLogEntryForAppointment(req, apptNextState);

    return logEntityUpdated({
      req,
      entityPrevState: previousActivityLogEntry,
      entityNextState: currentActivityLogEntry,
      component: COMPONENT_TYPES.APPOINTMENT,
    });
  });
};

export const updateAppointments = async (outerCtx, appointmentsData) => {
  logger.trace({ ctx: outerCtx, appointmentsData }, 'updateAppointments - params');
  const update = async ctx => {
    const appointmentIds = appointmentsData.map(appData => appData.id);
    const appointmentsPrevState = await tasksRepo.getTasksByIds(ctx, appointmentIds);
    const appointmentsNextState = await tasksRepo.updateTasks(ctx, appointmentsData);
    const partyIds = new Set(appointmentsNextState.map(app => app.partyId));

    await mapSeries(partyIds, async partyId => {
      await performPartyStateTransition(ctx, partyId);

      const inventories = appointmentsNextState
        .filter(app => app.partyId === partyId)
        .map(app => app.metadata && app.metadata.inventories)
        .filter(is => !!is && is[0]);
      const allAppInventories = flatten(inventories);

      await markUnitsAsFavorite(ctx, partyId, allAppInventories);
    });

    await logMultipleEntityUpdated(ctx, appointmentIds, appointmentsPrevState, appointmentsNextState);
    return appointmentsNextState;
  };

  return await runInTransaction(async trx => await update({ ...outerCtx, trx }), outerCtx);
};

export const saveAppointment = async (ctx, appointment) => {
  logger.trace({ ctx, appointment }, 'saveAppointment - params');
  const task = appointmentToTaskModel(appointment);
  const appointmentSaved = await tasksRepo.saveTask(ctx, task);
  await performPartyStateTransition(ctx, appointmentSaved.partyId);
  return appointmentSaved;
};

export const addAppointment = async (ctx, appointment, existingUserCalendarEventId) => {
  logger.trace({ ctx, appointment, existingUserCalendarEventId }, 'addAppointment - params');
  const createdBy = ctx.authUser && ctx.authUser.id;

  const usersInfo = {
    createdBy,
    originalPartyOwner: await getPartyOwner(ctx, appointment.partyId),
    originalAssignees: [appointment.salesPersonId],
  };

  // set the default property if none was sent
  if (!appointment.metadata?.selectedPropertyId) {
    const assignedPropertyId = await getAssignedPropertyByPartyId(ctx, appointment.partyId);
    appointment.metadata = { ...appointment.metadata, selectedPropertyId: assignedPropertyId };
  }

  const savedAppointment = await saveAppointment(ctx, { ...appointment, ...usersInfo });
  await saveUserCalendarEvent(ctx, savedAppointment, existingUserCalendarEventId);

  const {
    partyId,
    metadata: { inventories = [] },
  } = savedAppointment;
  const [inventory] = inventories;
  if (inventory) await markUnitsAsFavorite(ctx, partyId, inventories);

  const propertyAddress = await getAppointmentAddress(ctx, savedAppointment);

  await externalCalendar.createEvent(ctx, { appointment: savedAppointment, propertyAddress });

  const isSelfServiceAction = isSelfServiceAppointment(savedAppointment.metadata);
  const logEntry = await getActivityLogEntryForAppointment(ctx, savedAppointment, isSelfServiceAction);

  await logEntityAdded(ctx, { entity: logEntry, component: COMPONENT_TYPES.APPOINTMENT });
  await eventService.saveAppointmentCreatedEvent(ctx, {
    partyId: appointment.partyId,
    userId: createdBy,
    metadata: { appointmentId: savedAppointment.id },
  });
  await updatePartyCollaborators(ctx, savedAppointment.partyId, savedAppointment.userIds);
  await updatePartyTeams(ctx, { partyId, userIds: savedAppointment.userIds, manuallySelectedTeamId: savedAppointment.metadata.teamId });
  return savedAppointment;
};

const constructSelfServiceAppointment = (data, propertyId, slotDuration) => {
  const { inventoryId, startDate, ownerId, tourType = DALTypes.TourTypes.IN_PERSON_TOUR } = data.createAppointment;

  const endDate = toMoment(data.createAppointment.startDate).add(slotDuration, 'minutes').toISOString();

  return {
    startDate,
    endDate,
    partyMembers: [data.senderPartyMemberId],
    partyId: data.partyId,
    salesPersonId: ownerId,
    teamId: data.onSiteLeasingTeamId,
    category: DALTypes.TaskCategories.APPOINTMENT,
    state: DALTypes.TaskStates.ACTIVE,
    metadata: {
      programEmailIdentifier: data.programEmailIdentifier,
      appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.SELF_SERVICE,
      selectedPropertyId: propertyId,
      inventories: inventoryId ? [inventoryId] : [],
      tourType,
    },
    createdFromCommId: data.createdFromCommId,
  };
};

export const createSelfServiceAppointment = async (ctx, data) => {
  logger.trace({ ctx, data }, 'createSelfServiceAppointment - params');

  const { assignedPropertyId: propertyId, teams } = await loadPartyById(ctx, data.partyId);
  const slotDuration = await getTeamCalendarSlotDuration(ctx, propertyId);
  const appointment = constructSelfServiceAppointment(data, propertyId, slotDuration);
  const { userIds, metadata } = await addAppointment(ctx, appointment, data.createAppointment.userCalendarEventId);
  const { startDate, teamId } = metadata;
  const timezone = await getTimezoneForParty(ctx, data.partyId);

  notify({
    ctx,
    event: eventTypes.LOAD_APPOINTMENTS_EVENT,
    data: {
      date: startDate,
      agentId: userIds?.[0],
      teamId,
      timezone,
      isNotification: true,
    },
    routing: { teams },
  });
};

export const getNextAgentForAppointment = async (ctx, { teamId, timezone, startDate, slotDuration }) => {
  logger.trace({ ctx, teamId, startDate, slotDuration }, 'getNextAgentForAppointment - params');

  const endDate = toMoment(startDate).add(slotDuration, 'minutes').toISOString();

  const activeAgentsForTeamForSlotDay = await getActiveAgentsFromTeamForSlotDay(ctx, { teamId, slotStartTime: startDate, timezone });
  const agents = await calendarEventsRepo.getAgentWithLeastBookedAppts(ctx, { teamId, startDate, endDate, activeAgentsForTeamForSlotDay, timezone });

  if (!agents.length) {
    logger.trace({ ctx, teamId, startDate, slotDuration }, 'getNextAgentForAppointment - no available agents');
    return { noAgentAvailable: true };
  }

  // agents length cannot be greater than 1 because of the db constraints
  const [{ userId, details }] = agents;

  logger.trace(
    { ctx, teamId, userId, startDate, endDate, activeAgentsForTeamForSlotDay, availableAgentsConsideredAtRouting: details },
    'getNextAgentForAppointment - selected agent considering these agents when routing',
  );

  return { userId };
};

export const createSelfBookUserCalendarEvent = async (
  outerCtx,
  { teamId, timezone, startDate, slotDuration, preferredPartyOwnerId, preferredPartyCollaboratorIds },
) => {
  logger.trace({ ctx: outerCtx, teamId, startDate, slotDuration }, 'createSelfBookUserCalendarEvent - params');

  const endDate = toMoment(startDate).add(slotDuration, 'minutes').toISOString();

  return await runInTransaction(async trx => {
    const ctx = { ...outerCtx, trx };

    const isSlotAvailableForTeam = await calendarEventsRepo.isSlotAvailableForTeam(ctx, teamId, startDate, endDate);

    if (!isSlotAvailableForTeam) {
      logger.trace({ ctx, teamId, startDate, slotDuration }, 'createSelfBookUserCalendarEvent - slot no longer available');
      return { slotNotAvailable: true };
    }

    const activeAgentsForTeamForSlotDay = await getActiveAgentsFromTeamForSlotDay(ctx, { teamId, slotStartTime: startDate, timezone });
    const events = await calendarEventsRepo.createSelfBookEvent(ctx, {
      teamId,
      startDate,
      endDate,
      activeAgentsForTeamForSlotDay,
      preferredPartyOwnerId,
      preferredPartyCollaboratorIds,
      timezone,
    });

    if (!events.length) {
      logger.trace({ ctx, teamId, startDate, slotDuration }, 'createSelfBookUserCalendarEvent - slot no longer available');
      return { slotNotAvailable: true };
    }

    // events length cannot be greater than 1 because of the db constraints
    const [{ id: userCalendarEventId, userId: agent, details }] = events;

    logger.trace(
      { ctx, teamId, agent, startDate, endDate, activeAgentsForTeamForSlotDay, availableAgentsConsideredAtRouting: details },
      'createSelfBookUserCalendarEvent - created considering these agents when routing',
    );

    notify({
      ctx,
      event: eventTypes.LOAD_APPOINTMENTS_EVENT,
      data: {
        date: startDate,
        agentId: agent,
        teamId,
        timezone,
        isNotification: true,
      },
      routing: { teams: [teamId] },
    });

    return { userCalendarEventId, agent };
  }, outerCtx);
};

const storeMessage = async (ctx, { data, appointment, personIds, category }) => {
  const commEntry = {
    message: {
      rawMessageData: data,
    },
    unread: true,
    parties: [appointment.partyId],
    persons: personIds,
    threadId: newId(),
    teams: [appointment.metadata.teamId],
    type: DALTypes.CommunicationMessageType.WEB,
    messageId: newId(),
    direction: DALTypes.CommunicationDirection.IN,
    category,
  };

  return await addNewCommunication(ctx, commEntry);
};

export const updateAppointmentFromSelfService = async (
  outerCtx,
  {
    appointment,
    startDate,
    slotDuration,
    actionType,
    feedback,
    timezone,
    preferredCurrentOwnerId,
    preferredPartyOwnerId,
    preferredPartyCollaboratorIds,
    inventories,
  },
) => {
  const { id: appointmentId, metadata } = appointment;
  const { teamId } = metadata;

  logger.trace({ ctx: outerCtx, appointmentId, teamId, startDate, slotDuration, feedback, inventories }, 'updateAppointmentFromSelfService - params');
  if (actionType === DALTypes.SelfServiceAppointmentActions.CANCEL) {
    const updatedAppointment = await cancelAppointment(outerCtx, { ...appointment, isSelfServiceAction: true, sendConfirmationMail: true });
    const persons = await getPersonsByPartyMemberIds(outerCtx, appointment.metadata.partyMembers);
    await storeMessage(outerCtx, {
      data: { action: actionType, appointment: updatedAppointment },
      appointment,
      personIds: persons.map(p => p.id),
      category: DALTypes.CommunicationCategory.WEB_CANCEL_APPOINTMENT,
    });
    return { updatedAppointment };
  }

  return await runInTransaction(async trx => {
    const ctx = { ...outerCtx, trx };

    if (actionType === DALTypes.SelfServiceAppointmentActions.UPDATE && (feedback || inventories)) {
      const appointmentMetadata = inventories ? { inventories } : { feedback };
      const updatedAppointment = await updateAppointment(
        ctx,
        appointmentId,
        {
          userIds: appointment.userIds,
          metadata: appointmentMetadata,
        },
        true,
      );
      return { updatedAppointment };
    }

    const endDate = toMoment(startDate).add(slotDuration, 'minutes').toISOString();
    const isSlotAvailableForTeam = await calendarEventsRepo.isSlotAvailableForTeam(ctx, teamId, startDate, endDate);

    if (!isSlotAvailableForTeam) {
      logger.trace({ ctx, appointmentId, teamId, startDate, slotDuration }, 'updateAppointmentFromSelfService - slot no longer available');
      return { slotNotAvailable: true };
    }

    const activeAgentsForTeamForSlotDay = await getActiveAgentsFromTeamForSlotDay(ctx, { teamId, slotStartTime: startDate, timezone });
    const [event] = await calendarEventsRepo.updateAppointmentEvent(ctx, {
      appointmentId,
      startDate,
      endDate,
      activeAgentsForTeamForSlotDay,
      preferredCurrentOwnerId,
      preferredPartyOwnerId,
      preferredPartyCollaboratorIds,
      timezone,
    });

    if (!event) {
      logger.trace({ ctx, teamId, startDate, slotDuration }, 'updateAppointmentFromSelfService - slot no longer available');
      return { slotNotAvailable: true };
    }

    const { details, ...updatedCalendarEvent } = event;

    logger.trace(
      {
        ctx,
        teamId,
        agent: updatedCalendarEvent.userId,
        startDate,
        endDate,
        activeAgentsForTeamForSlotDay,
        availableAgentsConsideredAtRouting: details,
      },
      'updateAppointmentFromSelfService - updated considering these agents when routing',
    );

    const updatedAppointment = await updateAppointment(
      ctx,
      appointmentId,
      {
        userIds: [updatedCalendarEvent.userId],
        metadata: { startDate, endDate },
        hasAppointmentDateChanged: true,
        sendConfirmationMail: true,
      },
      true,
    );

    return { updatedAppointment };
  }, outerCtx);
};

const isMostRecentAppointment = (mostRecentDatetime, currentDatetime, nowWithTimezone) =>
  mostRecentDatetime ? currentDatetime < nowWithTimezone && currentDatetime >= mostRecentDatetime : currentDatetime < nowWithTimezone;

const isUpcomingAppointment = (upcomingDatetime, currentDatetime, nowWithTimezone) =>
  upcomingDatetime ? currentDatetime > nowWithTimezone && currentDatetime <= upcomingDatetime : currentDatetime > nowWithTimezone;

export const getFormattedAppointmentInfo = (ctx, appointment, { timezone }) => {
  const { property, metadata } = appointment;
  const { startDate, programEmailIdentifier } = metadata || {};

  const startDateWithTimezone = toMoment(startDate, { timezone });
  const leasingOfficeAddress = property?.leasingOfficeAddress || formatSimpleAddress(property?.address);

  const info = { appointmentId: appointment.id, tenantId: ctx.tenantId, tenantName: ctx.tenantName, programEmailIdentifier };
  const options = { expiresIn: config.rentapp.tokenExpiration };
  const editAppointmentUrl = addTokenToUrls(`${appointment.editUrl}/appointment/edit/`, info, false, options);
  const cancelAppointmentUrl = addTokenToUrls(`${appointment.editUrl}/appointment/cancel/`, info, false, options);

  return {
    ctx,
    id: appointment.id,
    date: startDateWithTimezone.format(MONTH_DATE_YEAR_LONG_FORMAT),
    time: startDateWithTimezone.format(TIME_MERIDIEM_FORMAT),
    editAppointmentUrl,
    cancelAppointmentUrl,
    address: leasingOfficeAddress, // deprecated
    showAgent: {
      preferredName: appointment.preferredName,
      fullName: appointment.fullName,
      businessTitle: appointment.businessTitle,
    },
    property: {
      displayName: appointment.property?.displayName,
      leasingOfficeAddress,
    },
  };
};

const appointmentTypesMapping = {
  [AppointmentContextTypes.MOST_RECENT]: isMostRecentAppointment,
  [AppointmentContextTypes.UPCOMING]: isUpcomingAppointment,
};

export const getAppointmentByContextType = (ctx, appointments, { contextType = AppointmentContextTypes.MOST_RECENT }) => {
  const result = appointments.reduce(
    (acc, appointment) => {
      const { timezone } = appointment;
      const nowWithTimezone = now({ timezone });
      const currentDatetime = toMoment(appointment.metadata.startDate, { timezone });
      if (appointmentTypesMapping[contextType](acc.matchingDatetime, currentDatetime, nowWithTimezone)) {
        acc.matchingDatetime = currentDatetime;
        acc.matchingAppointment = getFormattedAppointmentInfo(ctx, appointment, { timezone });
      }
      return acc;
    },
    { matchingAppointment: { showAgent: {} }, matchingDatetime: null },
  );

  return result.matchingAppointment;
};

export const cronofyRsvpStatusTypes = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
};

const getUpdatedInviteStatus = (dbRsvpStatuses = [], reply) => {
  const rsvpStatusesExceptCurrent = dbRsvpStatuses.filter(s => s.email !== reply.email);

  return [...rsvpStatusesExceptCurrent, reply];
};
const getActivityType = status => (status === cronofyRsvpStatusTypes.DECLINED ? ACTIVITY_TYPES.DECLINE : ACTIVITY_TYPES.CONFIRM);

const addActivityLog = async (ctx, { id, personId, partyId, partyMemberId, status }) => {
  const { fullName } = await getPersonById(ctx, personId);
  let activityLog = { id, partyMemberId, partyId, createdByType: DALTypes.CreatedByType.SELF_SERVICE };
  activityLog = status === cronofyRsvpStatusTypes.DECLINED ? { ...activityLog, declinedBy: fullName } : { ...activityLog, confirmedBy: fullName };

  await logEntity(ctx, { entity: activityLog, activityType: getActivityType(status), component: COMPONENT_TYPES.APPOINTMENT });
};

const isRsvpStatusChange = (rsvpStatuses = [], partyMemberId, status) => {
  const rsvpForMember = rsvpStatuses.find(r => r.partyMemberId === partyMemberId);
  return !rsvpForMember || rsvpForMember.status !== status;
};

const isAppointmentCanceled = appointment => appointment.state === DALTypes.TaskStates.CANCELED;

export const handleExternalCalendarRsvpResponse = async (ctx, appointmentId, reply) => {
  const appointment = await tasksRepo.getTaskById(ctx, appointmentId);
  const {
    metadata: { rsvpStatuses: dbRsvpStatuses, partyMembers: appointmentParticipants },
    partyId,
  } = appointment;

  if (isAppointmentCanceled(appointment)) {
    logger.trace({ ctx, appointment }, 'Appointment is canceled - no action needed');
    return appointment;
  }

  const { id: partyMemberId, personId } = await getPartyMemberByEmailAddress(ctx, reply.email);

  if (!isRsvpStatusChange(dbRsvpStatuses, partyMemberId, reply.status)) return appointment;

  const rsvpStatuses = getUpdatedInviteStatus(dbRsvpStatuses, { ...reply, partyMemberId });

  let updatedAppointment = await tasksRepo.updateTask(ctx, appointmentId, { metadata: { rsvpStatuses } });
  const isAppDeclinedByAllParticipants =
    rsvpStatuses.length === appointmentParticipants.length && rsvpStatuses.every(s => s.status === cronofyRsvpStatusTypes.DECLINED);

  await addActivityLog(ctx, { id: updatedAppointment.id, personId, partyId, partyMemberId, status: reply.status });

  if (reply.status === cronofyRsvpStatusTypes.DECLINED) {
    const comm = await storeMessage(ctx, {
      data: { action: reply.status, appointment: updatedAppointment },
      appointment: updatedAppointment,
      personIds: [personId],
      category: DALTypes.CommunicationCategory.WEB_DECLINE_APPOINTMENT,
    });

    if (isAppDeclinedByAllParticipants) {
      updatedAppointment = await cancelAppointment(ctx, { ...appointment, sendConfirmationMail: true, isSelfServiceAction: true });
    } else {
      await notifyCommunicationUpdate(ctx, comm);
    }
  }

  return updatedAppointment;
};
