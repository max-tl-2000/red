/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const UPDATE_APPOINTMENT_SUCCESS = 'appointments-dialog/UPDATE_APPOINTMENT_SUCCESS';
const UPDATE_APPOINTMENT_FAIL = 'appointments-dialog/UPDATE_APPOINTMENT_FAIL';

const UPDATE_APPOINTMENTS = 'appointments-dialog/UPDATE_APPOINTMENTS';
const UPDATE_APPOINTMENTS_SUCCESS = 'appointments-dialog/UPDATE_APPOINTMENTS_SUCCESS';
const UPDATE_APPOINTMENTS_FAIL = 'appointments-dialog/UPDATE_APPOINTMENTS_FAIL';

const CLEAR_UPDATE_ERROR = 'appointmentsList/CLEAR_UPDATE_ERROR';

import { OperationResultType } from '../../../common/enums/enumHelper';
import * as dataStoreActions from './dataStore';

const initialState = {};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case UPDATE_APPOINTMENT_SUCCESS: {
      return {
        ...state,
        updateAppointmentResult: {
          type: OperationResultType.SUCCESS,
          result: action.result,
        },
      };
    }
    case UPDATE_APPOINTMENT_FAIL:
      return {
        ...state,
        updateAppointmentResult: {
          type: OperationResultType.FAILED,
          result: action.error.token || action.error.message,
        },
      };
    case UPDATE_APPOINTMENTS:
      return {
        ...state,
      };
    case UPDATE_APPOINTMENTS_SUCCESS: {
      return {
        ...state,
        updateAppointmentResult: {
          type: OperationResultType.SUCCESS,
          result: action.result,
        },
      };
    }
    case UPDATE_APPOINTMENTS_FAIL: {
      return {
        ...state,
        updateAppointmentResult: {
          type: OperationResultType.FAILED,
          result: action.error.token || action.error.message,
        },
      };
    }
    case CLEAR_UPDATE_ERROR: {
      const { updateAppointmentResult, ...nextState } = state; // eslint-disable-line no-unused-vars
      return nextState;
    }
    default:
      return state;
  }
}

export const clearUpdateError = () => ({ type: CLEAR_UPDATE_ERROR });

export const addUnitToAppointmentFromInventoryCardFlyout = appointmentsData => {
  const formatter = appointment => ({ appointments: [appointment] });
  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;
  return {
    uiActions: [UPDATE_APPOINTMENTS, UPDATE_APPOINTMENTS_SUCCESS, UPDATE_APPOINTMENTS_FAIL],
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.patch('/tasks', { data: appointmentsData }),
  };
};
