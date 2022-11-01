/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const DELETE_DOCUMENT = 'reva/DELETE_DOCUMENT';
const DELETE_DOCUMENT_SUCCESS = 'reva/DELETE_DOCUMENT_SUCCESS';
const DELETE_DOCUMENT_FAIL = 'reva/DELETE_DOCUMENT_FAIL';

export default (state = {}, action = {}) => {
  switch (action.type) {
    case DELETE_DOCUMENT:
      return {};
    case DELETE_DOCUMENT_SUCCESS:
      return { success: true };
    case DELETE_DOCUMENT_FAIL:
      return { error: action.error.token };
    default:
      return state;
  }
};

export const deleteDocument = documentIds => ({
  types: [DELETE_DOCUMENT, DELETE_DOCUMENT_SUCCESS, DELETE_DOCUMENT_FAIL],
  promise: client => client.del('/documents', { data: { documentIds } }),
});
