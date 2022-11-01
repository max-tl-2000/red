/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const EXPORT_DATABASE = 'export/database';
const EXPORT_DATABASE_SUCCESS = 'export/database_success';
const EXPORT_DATABASE_FAILURE = 'export/database_failure';

const INITIAL_STATE = {
  exportStarted: false,
  exportFinished: false,
  exportFinishedWithErrors: false,
};

export default function reducer(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case EXPORT_DATABASE:
      return {
        exportStarted: true,
        exportFinished: false,
        exportFinishedWithErrors: false,
      };
    case EXPORT_DATABASE_FAILURE:
      return {
        exportStarted: false,
        exportFinished: false,
        exportFinishedWithErrors: true,
      };
    case EXPORT_DATABASE_SUCCESS:
      return {
        exportStarted: false,
        exportFinished: true,
        exportFinishedWithErrors: false,
      };
    default:
      return state;
  }
}

export const exportDatabase = (tenantId, properties, workbookSheets, exportDateTime) => ({
  types: [EXPORT_DATABASE, EXPORT_DATABASE_SUCCESS, EXPORT_DATABASE_FAILURE],
  promise: client =>
    client.post(`/tenants/${tenantId}/export`, {
      data: {
        properties,
        workbookSheets,
        exportDateTime,
      },
    }),
});
