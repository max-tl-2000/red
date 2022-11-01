/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';
import v4 from 'uuid/v4';

const UPLOAD_IMPORT_FILES_REQUEST = 'upload_importFiles_request';
const UPLOAD_IMPORT_FILES_PROGRESS = 'upload_importFiles_progress';
const UPLOAD_IMPORT_FILES_SUCCESS = 'upload_importFiles_success';
const UPLOAD_IMPORT_FILES_FAILURE = 'upload_importFiles_failure';

const RESET = 'import_reset_state';

const ADD_INSTANCE = 'import_add_instance';

const emptyState = {
  uploadStarted: false,
  uploadFinished: false,
  uploadFinishedWithErrors: false,
  uploadedFileIsTooBig: false,
};

const initialState = new Immutable.Map();

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case ADD_INSTANCE: {
      return state.set(action.componentName, {
        id: v4(),
        ...emptyState,
      });
    }
    case UPLOAD_IMPORT_FILES_REQUEST: {
      const name = action.componentName;
      const item = state.get(name);
      return state.set(name, {
        ...item,
        uploadStarted: true,
        uploadFinished: false,
        uploadFinishedWithErrors: false,
        percentLoaded: 0,
      });
    }
    case UPLOAD_IMPORT_FILES_FAILURE: {
      const name = action.componentName;
      const item = state.get(name);
      state.set(name, {
        ...item,
        uploadStarted: false,
        uploadFinished: false,
        uploadFinishedWithErrors: true,
        uploadedFileIsTooBig: (action.error && action.error.status === 413) || false,
      });
      return state;
    }
    case UPLOAD_IMPORT_FILES_PROGRESS: {
      const { componentName: name, percentLoaded } = action;
      const item = state.get(name);
      return state.set(name, {
        ...item,
        uploadStarted: true,
        uploadFinishedWithErrors: false,
        uploadFinished: false,
        percentLoaded,
      });
    }
    case UPLOAD_IMPORT_FILES_SUCCESS: {
      const name = action.componentName;
      const item = state.get(name);
      return state.set(name, {
        ...item,
        uploadStarted: false,
        uploadFinishedWithErrors: false,
        uploadFinished: true,
      });
    }
    case RESET:
      return initialState;
    default:
      return state;
  }
}

export const addInstance = name => ({
  type: ADD_INSTANCE,
  componentName: name,
});

export const notifyUploadProgress = (componentName, percentLoaded, error) => {
  const type = percentLoaded < 100 ? UPLOAD_IMPORT_FILES_PROGRESS : UPLOAD_IMPORT_FILES_SUCCESS;
  return {
    type: !error ? type : UPLOAD_IMPORT_FILES_FAILURE,
    componentName,
    percentLoaded,
    error,
  };
};

export const uploadFiles = (componentName, apiPath, files, restClient) => (_, dispatch) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('isUIImport', true);

  dispatch({ type: UPLOAD_IMPORT_FILES_REQUEST, componentName });

  restClient.upload(apiPath, formData, { reportProgress: true, requestId: componentName });
};

export const resetSeedDataState = () => ({ type: RESET });
