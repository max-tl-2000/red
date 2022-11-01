/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const LOAD_OVERVIEW = 'SCHEDULE/LOAD_OVERVIEW';
const LOAD_OVERVIEW_SUCCESS = 'SCHEDULE/LOAD_OVERVIEW_SUCCESS';
const LOAD_OVERVIEW_FAIL = 'SCHEDULE/LOAD_OVERVIEW_FAIL';
const LOAD_TASKS = 'SCHEDULE/LOAD_TASKS';
const LOAD_TASKS_SUCCESS = 'SCHEDULE/LOAD_TASKS_SUCCESS';
const LOAD_TASKS_FAIL = 'SCHEDULE/LOAD_TASKS_FAIL';
const CLEAR_OVERVIEW = 'SCHEDULE/CLEAR_OVERVIEW';

const initialState = {
  loadingOverview: true,
  loadingTasks: false,
  daysWithTasks: [],
  tasksByDay: {},
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_OVERVIEW:
      return {
        ...initialState,
        loadingOverview: true,
      };
    case CLEAR_OVERVIEW:
      return {
        ...state,
        daysWithTasks: [],
        tasksByDay: {},
        loadingOverview: true,
      };
    case LOAD_OVERVIEW_SUCCESS:
      return {
        ...state,
        loadingOverview: false,
        daysWithTasks: action.result.daysWithTasks,
        tasksByDay: action.result.tasks,
      };
    case LOAD_TASKS:
      return {
        ...state,
        loadingTasks: true,
      };
    case LOAD_TASKS_SUCCESS:
      return {
        ...state,
        loadingTasks: false,
        tasksByDay: {
          ...state.tasksByDay,
          ...action.result,
        },
      };
    default:
      return state;
  }
}

export function loadOverview({ preloadDays = 10, users, timezone }) {
  return {
    types: [LOAD_OVERVIEW, LOAD_OVERVIEW_SUCCESS, LOAD_OVERVIEW_FAIL],
    promise: client =>
      client.post('/schedule/overview', {
        params: { preloadDays },
        data: { users, timezone },
      }),
  };
}

export function clearOverview() {
  return {
    type: CLEAR_OVERVIEW,
  };
}

export function loadTasks(days, timezone) {
  const payload = { params: { days, timezone } };

  return {
    types: [LOAD_TASKS, LOAD_TASKS_SUCCESS, LOAD_TASKS_FAIL],
    promise: client => client.get('/schedule', payload),
  };
}
