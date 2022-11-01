/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dataStoreActions from './dataStore';
import { DALTypes } from '../../../common/enums/DALTypes';

const START_ADDING_TASK = 'tasks/START_ADDING_TASK';
const START_ADDING_REQUIRE_WORK_TASK = 'tasks/START_ADDING_REQUIRE_WORK_TASK';
const START_EDITING_TASK = 'tasks/START_EDITING_TASK';
const CLOSE_TASK_DIALOG = 'tasks/CLOSE_TASK_DIALOG';

const SAVE_TASK = 'tasks/SAVE_TASK';
const SAVE_TASK_SUCCESS = 'tasks/SAVE_TASK_SUCCESS';
const SAVE_TASK_FAIL = 'tasks/SAVE_TASK_FAIL';

const CLEAR_ASSIGN_TASK_ERROR = 'tasks/CLEAR_ASSIGN_TASKS_ERROR';

const initialState = {
  isEnabled: false,
  isSaving: false,
  task: null,
  error: null,
  isRequireWorkTask: false,
};

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case START_ADDING_TASK:
      return {
        ...state,
        isEnabled: true,
        isRequireWorkTask: false,
      };
    case START_ADDING_REQUIRE_WORK_TASK:
      return {
        ...state,
        isEnabled: true,
        isRequireWorkTask: true,
      };
    case START_EDITING_TASK: {
      return {
        ...state,
        isEnabled: true,
        task: action.task,
      };
    }
    case CLOSE_TASK_DIALOG:
      return {
        ...state,
        isEnabled: false,
        task: null,
      };
    case SAVE_TASK:
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    case SAVE_TASK_SUCCESS: {
      return {
        ...state,
        isRequireWorkTask: false,
        isSaving: false,
        error: null,
      };
    }
    case SAVE_TASK_FAIL:
      return {
        ...state,
        isSaving: false,
        error: action.error.token,
        taskDetails: action.error,
      };
    case CLEAR_ASSIGN_TASK_ERROR:
      return {
        ...state,
        taskDetails: {},
      };
    default:
      return state;
  }
};

export const loadTasks = ids => {
  const query = ids && ids.length ? `?ids=${ids.join(',')}` : '';

  const formatter = tasks => ({ tasks });
  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.get(`/tasks${query}`),
  };
};

export const clearAssignTaskError = () => ({ type: CLEAR_ASSIGN_TASK_ERROR });

export const updateTask = (task, sendConfirmationMail, checkConflictingAppointments) => async (makeRequest, dispatch, getState) => {
  const formatter = t => ({ tasks: [t] });
  dispatch({ type: SAVE_TASK });
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/tasks/${task.id}`,
    payload: { ...task, sendConfirmationMail, checkConflictingAppointments },
  });

  if (error) {
    error.__handled = true; // avoid the generic error snackbar message
    const user = getState().globalStore.get('users').get(task.userIds[0]);
    dispatch({ type: SAVE_TASK_FAIL, error: { ...error, task, sendConfirmationMail, user } });
    return;
  }

  dispatch({ type: SAVE_TASK_SUCCESS, result: formatter(data) });
};

export function markTaskAsComplete(taskId, note) {
  return updateTask({
    id: taskId,
    state: DALTypes.TaskStates.COMPLETED,
    metadata: { closingNote: note },
  });
}

export function markTaskAsCanceled(taskId) {
  return updateTask({
    id: taskId,
    state: DALTypes.TaskStates.CANCELED,
  });
}

export const handleRemoveOrCancelWSNotification = apptData => {
  const { UPDATE_DATA_SUCCESS } = dataStoreActions;
  const formatter = data => ({
    tasks: [
      {
        id: data.taskId,
        deleted: true,
      },
    ],
  });

  return {
    type: UPDATE_DATA_SUCCESS,
    result: formatter(apptData),
  };
};

export const startAddingTask = () => ({ type: START_ADDING_TASK });

export const startAddingRequireWorkTask = () => ({
  type: START_ADDING_REQUIRE_WORK_TASK,
});

export const startEditingTask = task => ({ type: START_EDITING_TASK, task });

export const closeTaskDialog = () => ({ type: CLOSE_TASK_DIALOG });

export const saveTask = task => {
  const formatter = t => ({ tasks: [t] });
  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    uiActions: [SAVE_TASK, SAVE_TASK_SUCCESS, SAVE_TASK_FAIL],
    promise: client => client.post('/tasks', { data: task }),
  };
};
