/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const INVITE = 'reva/INVITE';
const INVITE_SUCCESS = 'reva/INVITE_SUCCESS';
const INVITE_FAIL = 'reva/INVITE_FAIL';

const INVITE_IMPORTED = 'reva/INVITE_IMPORTED';
const INVITE_IMPORTED_SUCCESS = 'reva/INVITE_IMPORTED_SUCCESS';
const INVITE_IMPORTED_FAIL = 'reva/INVITE_IMPORTED_FAIL';

const initialState = {
  loaded: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case INVITE:
    case INVITE_IMPORTED:
      return {
        ...state,
        inviting: true,
        inviteError: null,
        inviteSuccess: null,
      };
    case INVITE_SUCCESS:
    case INVITE_IMPORTED_SUCCESS:
      return {
        ...state,
        inviting: false,
        inviteSuccess: 'INVITE_EMAIL_SUCCESSFULLY_SENT',
      };
    case INVITE_FAIL:
    case INVITE_IMPORTED_FAIL:
      return {
        ...state,
        inviting: true,
        inviteError: action.error,
      };
    default:
      return state;
  }
}

export function sendInvite(mail, organization, userType, directEmailIdentifier) {
  return {
    types: [INVITE, INVITE_SUCCESS, INVITE_FAIL],
    promise: client =>
      client.post('/sendInvite', {
        data: {
          mail,
          organization,
          userType,
          inviteData: { directEmailIdentifier },
        },
      }),
  };
}

export function resetImportedUsersPassword(tenant, teamMembers, sendForIndividual = true) {
  const userIds = teamMembers.map(p => p.id);
  return {
    types: [INVITE_IMPORTED, INVITE_IMPORTED_SUCCESS, INVITE_IMPORTED_FAIL],
    promise: client =>
      client.post('/sendInviteImportedUsers', {
        data: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          organization: tenant.id,
          userIds,
          sendForIndividual,
        },
      }),
  };
}
