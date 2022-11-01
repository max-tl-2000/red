/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import merge from 'lodash/merge';
const FETCH_JOBS = 'jobs/fetch-jobs';
const FETCH_JOBS_SUCCESS = 'jobs/fetch-jobs-success';
const FETCH_JOBS_FAILURE = 'jobs/fetch-jobs-failure';
const FETCH_JOB = 'jobs/fetch-job';
const FETCH_JOB_SUCCESS = 'jobs/fetch-job-success';
const FETCH_JOB_FAILURE = 'jobs/fetch-job-failure';
const UPDATE_STEP_PROGRESS = 'jobs/update_step_progress';

const INITIAL_STATE = {
  jobs: [],
};

const enhanceJobWithProgress = (progress, jobDetails, job) =>
  merge(job, {
    steps: {
      [jobDetails.step]: {
        progress,
      },
    },
  });

const updateStepProgress = (progress, jobDetails, jobs) =>
  jobs.map(job => (job.id === jobDetails.id ? enhanceJobWithProgress(progress, jobDetails, job) : job));

const calculateProgress = (current, total) => `${current} of ${total}`;

export default function reducer(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case FETCH_JOBS:
    case FETCH_JOB:
      return {
        ...state,
      };
    case FETCH_JOBS_SUCCESS: {
      return {
        ...state,
        jobs: action.result,
      };
    }
    case FETCH_JOB_SUCCESS: {
      return {
        ...state,
        jobs: state.jobs.map(job => (job.id === action.result.id ? action.result : job)),
      };
    }
    case FETCH_JOBS_FAILURE:
      return {
        jobs: [],
        error: action.error,
      };
    case FETCH_JOB_FAILURE:
      return {
        ...state,
        error: action.error,
      };
    case UPDATE_STEP_PROGRESS: {
      return {
        ...state,
        jobs: updateStepProgress(calculateProgress(action.data.current, action.data.total), action.data.jobDetails, state.jobs),
      };
    }
    default:
      return state;
  }
}

export const fetchJobsByCategory = ({ jobCategory, reqId }) => ({
  types: [FETCH_JOBS, FETCH_JOBS_SUCCESS, FETCH_JOBS_FAILURE],
  promise: client => client.get(`/jobs?category=${jobCategory}&limit=50`, { reqId }),
});

export const getJob = ({ id: jobId, reqId }) => ({
  types: [FETCH_JOB, FETCH_JOB_SUCCESS, FETCH_JOB_FAILURE],
  promise: client => client.get(`/jobs/${jobId}`, { reqId }),
});

export const updateJobStepProgress = data => ({
  type: UPDATE_STEP_PROGRESS,
  data,
});
