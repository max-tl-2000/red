/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isGuarantorLinkHoldType, isPartyLevelGuarantor } from 'helpers/party';
import { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL, UPDATED_MEMBER_DATA, SET_HOLD_SCREEENING } from './dataStore';
import { DALTypes } from '../../../common/enums/DALTypes';

const START_ADDING_GUEST = 'members/START_ADDING_GUEST';
const END_ADDING_GUEST = 'members/END_ADDING_GUEST';
const IMPERSONATION = 'members/IMPERSONATION';
const IMPERSONATION_SUCCESS = 'members/IMPERSONATION_SUCCESS';
const IMPERSONATION_FAIL = 'members/IMPERSONATION_FAIL';
const SEND_APPLICATION_INVITATION = 'members/SEND_APPLICATION_INVITATION';
const SEND_APPLICATION_INVITATION_SUCCESS = 'members/SEND_APPLICATION_INVITATION_SUCCESS';
const SEND_APPLICATION_INVITATION_FAIL = 'members/SEND_APPLICATION_INVITATION_FAIL';

const initialState = {
  loaded: false,
  isAddingGuest: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case START_ADDING_GUEST:
      return {
        ...state,
        isAddingGuest: true,
      };
    case END_ADDING_GUEST:
      return {
        ...state,
        isAddingGuest: false,
      };
    case IMPERSONATION_SUCCESS:
      return {
        ...state,
        impersonationToken: action.result,
      };
    case IMPERSONATION_FAIL:
      return {
        ...state,
        impersonationToken: null,
      };
    case SEND_APPLICATION_INVITATION_SUCCESS:
      return {
        ...state,
        sendApplicationInvitation: true,
      };
    case SEND_APPLICATION_INVITATION_FAIL:
      return {
        ...state,
        sendApplicationInvitation: false,
      };
    default:
      return state;
  }
}

const formatter = member => {
  const { fullName, preferredName, contactInfo, ...rest } = member;
  return {
    members: [rest],
    persons: [
      {
        id: rest.personId,
        fullName,
        preferredName,
        contactInfo,
      },
    ],
  };
};

const getCurrentPartyMembers = getState => getState().dataStore.get('members').toArray();

export const addGuest = (newGuest, partyId) => async (makeRequest, dispatch) => {
  const isHeld = newGuest && newGuest.memberType === DALTypes.MemberType.GUARANTOR;
  if (isHeld && !isPartyLevelGuarantor) {
    dispatch({ type: SET_HOLD_SCREEENING, partyId, isHeld, holdScreeningType: DALTypes.HoldReasonTypes.RESIDENT_GUARANTOR_LINK });
  }

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/members`,
    payload: newGuest,
  });
  error ? dispatch({ type: UPDATE_DATA_FAIL, error }) : dispatch({ type: UPDATE_DATA_SUCCESS, result: formatter(data) });
  return data;
};

export const updatePartyMember = (partyMember, partyId) => ({
  types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
  formatter,
  promise: client =>
    client.patch(`/parties/${partyId}/members/${partyMember.id}`, {
      data: partyMember,
    }),
});

export const addApplication = (partyMemberId, partyId) => ({
  types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
  formatter,
  promise: client => client.post(`/parties/${partyId}/members/${partyMemberId}/application`),
});

export const startAddingGuests = () => ({ type: START_ADDING_GUEST });

export const endAddingGuests = () => ({ type: END_ADDING_GUEST });

export const removeMember = (partyId, memberId, notes) => async (makeRequest, dispatch, getState) => {
  const memberFormatter = result => {
    if (result) {
      return {
        members: [
          {
            id: memberId,
            deleted: true,
          },
        ],
        inactiveMembers: [result.member],
        tasks: result.tasks,
      };
    }
    return {};
  };
  // some problems because of removing the member from redux object before other dispatchers work with it
  // const partyMembers = getCurrentPartyMembers(getState);
  // dispatch({ type: UPDATED_MEMBER_DATA, actionType: DALTypes.ManageMembersActions.REMOVE_MEMBER, selectedPartyMember: { id: memberId }, partyMembers });
  if (!isPartyLevelGuarantor) {
    const updatedPartyMembers = getCurrentPartyMembers(getState);
    const isHeld = isGuarantorLinkHoldType(updatedPartyMembers);
    dispatch({ type: SET_HOLD_SCREEENING, partyId, isHeld, holdScreeningType: DALTypes.HoldReasonTypes.RESIDENT_GUARANTOR_LINK });
  }

  const { data, error } = await makeRequest({
    method: 'DEL',
    url: `/parties/${partyId}/members/${memberId}`,
    payload: {
      notes,
      utcOffset: new Date().getTimezoneOffset(),
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: memberFormatter(data) });
};

export const getImpersonationToken = (member, propertyId) => {
  const { id, partyId } = member;

  return {
    types: [IMPERSONATION, IMPERSONATION_SUCCESS, IMPERSONATION_FAIL],
    promise: client =>
      client.post(`/parties/${partyId}/members/${id}/proxyToken`, {
        data: {
          propertyId,
        },
      }),
  };
};

export const sendApplicationInvitation = (partyId, partyMemberId, propertyId, contactInfo) => ({
  types: [SEND_APPLICATION_INVITATION, SEND_APPLICATION_INVITATION_SUCCESS, SEND_APPLICATION_INVITATION_FAIL],
  promise: client =>
    client.post(`/parties/${partyId}/members/${partyMemberId}/applicationInvitation`, {
      data: {
        propertyId,
        contactInfo,
      },
    }),
});

export const processPartyMemberLinkAction = (partyId, selectedPartyMember, links, actionType) => async (makeRequest, dispatch, getState) => {
  const partyMembers = getCurrentPartyMembers(getState);
  dispatch({ type: UPDATED_MEMBER_DATA, links, selectedPartyMember, partyMembers, actionType });

  const updatedPartyMembers = getCurrentPartyMembers(getState);
  const isHeld = isGuarantorLinkHoldType(updatedPartyMembers);
  dispatch({ type: SET_HOLD_SCREEENING, partyId, isHeld, holdScreeningType: DALTypes.HoldReasonTypes.RESIDENT_GUARANTOR_LINK });

  await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/members/${selectedPartyMember.id}/linkMember`,
    payload: links,
  });
};
