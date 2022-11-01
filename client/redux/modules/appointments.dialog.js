/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { isMoment, toMoment, isSameDay } from '../../../common/helpers/moment-utils';

const START_ADDING_APPOINTMENT = 'appointments-dialog/START_ADDING_APPOINTMENT';
const START_EDITING_APPOINTMENT = 'appointments-dialog/START_EDITING_APPOINTMENT';

const LOAD_EVENTS = 'appointments-dialog/LOAD_EVENTS';
const LOAD_EVENTS_SUCCESS = 'appointments-dialog/LOAD_EVENTS_SUCCESS';
const LOAD_EVENTS_FAIL = 'appointments-dialog/LOAD_EVENTS_FAIL';

const SAVE_APPOINTMENT = 'appointments-dialog/SAVE_APPOINTMENT';
const SAVE_APPOINTMENT_SUCCESS = 'appointments-dialog/SAVE_APPOINTMENT_SUCCESS';
const SAVE_APPOINTMENT_FAIL = 'appointments-dialog/SAVE_APPOINTMENT_FAIL';

const UPDATE_APPOINTMENT = 'appointments-dialog/UPDATE_APPOINTMENT';
const UPDATE_APPOINTMENT_SUCCESS = 'appointments-dialog/UPDATE_APPOINTMENT_SUCCESS';
const UPDATE_APPOINTMENT_FAIL = 'appointments-dialog/UPDATE_APPOINTMENT_FAIL';

const END_ADDING_APPOINTMENT = 'appointments-dialog/END_ADDING_APPOINTMENT';
const START_REMOVING_APPOINTMENT = 'appointments-dialog/START_REMOVING_APPOINTMENT';
const END_REMOVING_APPOINTMENT = 'appointments-dialog/END_REMOVING_APPOINTMENT';

const LOAD_TEAM_EVENTS = 'appointments-dialog/LOAD_TEAM_EVENTS';
const LOAD_TEAM_EVENTS_SUCCESS = 'appointments-dialog/LOAD_TEAM_EVENTS_SUCCESS';
const LOAD_TEAM_EVENTS_FAIL = 'appoitments-dialog/LOAD_TEAM_EVENTS_FAIL';

const NEXT_AGENT_FOR_APPT_SUCCESS = 'appointment-dialg/NEXT_AGENT_FOR_APPT_SUCCESS';
const NEXT_AGENT_FOR_APPT_FAIL = 'appointment-dialg/NEXT_AGENT_FOR_APPT_FAIL';
const CLEAR_NEXT_AGENT_FOR_APPT = 'appointment-dialg/CLEAR_NEXT_AGENT_FOR_APPT';

const initialDialogState = {
  isEnabled: false,
  isLoading: false,
  isSaving: false,

  events: {},
  teamCalendarEvents: [],

  prospectId: null,
  appointment: null,
  error: null,
  unit: null,
};

export default function reducer(state = initialDialogState, action = {}) {
  switch (action.type) {
    case UPDATE_APPOINTMENT:
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    case UPDATE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        isSaving: false,
        error: null,
        appointment: action.result,
      };
    case UPDATE_APPOINTMENT_FAIL:
      return {
        ...state,
        isSaving: false,
        error: action.error.token,
      };
    case START_ADDING_APPOINTMENT:
      return {
        ...initialDialogState,
        prospectId: action.prospectId,
        unit: action.unit,
        isEnabled: true,
        isLoading: true,
      };
    case START_EDITING_APPOINTMENT:
      return {
        ...initialDialogState,
        isEnabled: true,
        appointment: action.appointment,
        unit: action.unit,
        selectedAgentId: action.appointment.userIds[0],
      };
    case END_ADDING_APPOINTMENT:
      return initialDialogState;

    case LOAD_EVENTS:
      return {
        ...state,
        isLoading: true,
        selectedDate: action.date,
        selectedAgentId: action.agentId,
      };
    case LOAD_EVENTS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        events: action.result,
      };
    case LOAD_TEAM_EVENTS:
      return {
        ...state,
        isLoading: true,
      };
    case LOAD_TEAM_EVENTS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        teamCalendarEvents: action.result,
      };
    case LOAD_EVENTS_FAIL:
      return {
        ...state,
        isLoading: false,
        events: {},
        error: action.error.token,
      };
    case SAVE_APPOINTMENT:
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    case SAVE_APPOINTMENT_SUCCESS: {
      const addedAppointment = {
        units: [],
        ...action.result,
      };
      return {
        ...state,
        isSaving: false,
        error: null,
        appointment: addedAppointment,
      };
    }
    case SAVE_APPOINTMENT_FAIL:
      return {
        ...state,
        isSaving: false,
        error: action.error.token,
      };
    case START_REMOVING_APPOINTMENT:
      return {
        ...state,
        isRemoveConfirmationOpen: true,
        appointmentToRemove: action.appointment,
      };
    case END_REMOVING_APPOINTMENT: {
      const { isRemoveConfirmationOpen, ...nextState } = state; // eslint-disable-line no-unused-vars
      return nextState;
    }
    case NEXT_AGENT_FOR_APPT_SUCCESS: {
      return {
        ...state,
        error: null,
        nextAgentForAppointment: action.result,
      };
    }
    case NEXT_AGENT_FOR_APPT_FAIL:
      return {
        ...state,
        error: action.error,
      };
    case CLEAR_NEXT_AGENT_FOR_APPT: {
      const { nextAgentForAppointment, ...nextState } = state;
      return nextState;
    }
    default:
      return state;
  }
}

export const startEditingAppointment = appointment => ({
  type: START_EDITING_APPOINTMENT,
  appointment,
});

export const startAddingAppointment = prospectId => ({
  type: START_ADDING_APPOINTMENT,
  prospectId,
});

export const startRemovingAppointment = appointment => ({
  type: START_REMOVING_APPOINTMENT,
  appointment,
});

export const endRemovingAppointment = () => ({
  type: END_REMOVING_APPOINTMENT,
});

export const endAddingAppointment = () => ({ type: END_ADDING_APPOINTMENT });

export const loadEvents = ({ date, agentId, teamId, timezone, isNotification = false }) => async (makeRequest, dispatch, getState) => {
  const dateMoment = isMoment(date) ? date : toMoment(date, { timezone });
  const prevState = getState().appointmentsDialog;
  if (isNotification && (prevState?.selectedAgentId !== agentId || !isSameDay(prevState?.selectedDate, dateMoment, { timezone }))) {
    return;
  }

  let appointmentsUrl = `/tasks/${agentId}/${teamId}/${dateMoment.format('YYYY/MM/DD')}/events`;

  if (timezone) {
    appointmentsUrl = `${appointmentsUrl}?tz=${timezone}`;
  }

  dispatch({ type: LOAD_EVENTS, agentId, date: dateMoment });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: appointmentsUrl,
  });

  if (error) {
    error.__handled = true; // avoid snackbar error message
    dispatch({ type: LOAD_EVENTS_FAIL, error });
    return;
  }

  dispatch({
    type: LOAD_EVENTS_SUCCESS,
    result: data,
  });
};

export const loadTeamSlots = ({ startDate, numOfDays, timezone, teamId, slotDuration }) => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_TEAM_EVENTS });
  const year = startDate.format('YYYY');
  const month = startDate.format('MM');
  const day = startDate.format('DD');

  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/tasks/${teamId}/${year}/${month}/${day}/${numOfDays}/${slotDuration}/teamCalendarSlots?timezone=${timezone}`,
  });

  if (error) {
    dispatch({ type: LOAD_TEAM_EVENTS_FAIL, error });
    return;
  }

  dispatch({
    type: LOAD_TEAM_EVENTS_SUCCESS,
    result: data,
  });
};

export const saveAppointment = appointment => async (makeRequest, dispatch) => {
  dispatch({ type: SAVE_APPOINTMENT });
  const appointmentData = {
    ...appointment,
    category: DALTypes.TaskCategories.APPOINTMENT,
    state: DALTypes.TaskStates.ACTIVE,
  };
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/tasks',
    payload: { ...appointmentData },
  });

  if (error) {
    dispatch({ type: SAVE_APPOINTMENT_FAIL, error });
    return;
  }

  dispatch({ type: SAVE_APPOINTMENT_SUCCESS, result: data });
};

export const getNextAgentForAppointment = ({ teamId, timezone, startDate, slotDuration }) => async (makeRequest, dispatch) => {
  dispatch({ type: CLEAR_NEXT_AGENT_FOR_APPT });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/tasks/${teamId}/nextAgentForAppointment`,
    payload: { timezone, startDate, slotDuration },
  });

  if (error || data.noAgentAvailable) {
    dispatch({ type: NEXT_AGENT_FOR_APPT_FAIL, error: error?.token || 'No agent available' });
    return;
  }

  dispatch({ type: NEXT_AGENT_FOR_APPT_SUCCESS, result: data.userId });
};

const sendUpdateRequest = (appointment, { sendConfirmationMail, type } = {}) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_APPOINTMENT });
  const payload = { ...appointment };

  // this is just to honor legacy code and avoid breaking something else
  // as before we were sending this all the time
  if (!type || type !== DALTypes.TaskCategories.MANUAL) {
    payload.sendConfirmationMail = sendConfirmationMail;
  }

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/tasks/${appointment.id}`,
    payload,
  });

  if (error) {
    dispatch({ type: UPDATE_APPOINTMENT_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_APPOINTMENT_SUCCESS, data });
};

export const updateAppointment = appointment => sendUpdateRequest(appointment, { sendConfirmationMail: false });

export const markAppointmentAsComplete = ({ id, note, appointmentResult, inventories = [] }) => {
  let metadata = appointmentResult ? { closingNote: note, appointmentResult } : { closingNote: note };
  metadata = inventories.length ? { inventories, ...metadata } : metadata;

  return sendUpdateRequest(
    {
      id,
      state: DALTypes.TaskStates.COMPLETED,
      metadata,
    },
    false,
  );
};

export const unmarkAppointmentAsComplete = (appointmentId, type) =>
  sendUpdateRequest(
    {
      id: appointmentId,
      state: DALTypes.TaskStates.ACTIVE,
      metadata: {
        closingNote: '',
        completedBy: '',
        appointmentResult: '',
        isReopened: true,
      },
      completionDate: null,
    },
    { sendConfirmationMail: false, type },
  );

export const markAppointmentAsCanceled = ({ id, note, appointmentResult }, sendConfirmationMail) => {
  const metadata = appointmentResult ? { closingNote: note, appointmentResult } : { closingNote: note };
  return sendUpdateRequest(
    {
      id,
      state: DALTypes.TaskStates.CANCELED,
      metadata,
    },
    { sendConfirmationMail },
  );
};

export const addNewAppointmentFromInventoryCardFlyout = unit => ({
  type: START_ADDING_APPOINTMENT,
  unit,
});
