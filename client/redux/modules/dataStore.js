/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';
import isEqual from 'lodash/isEqual';
import { getMembersAfterLinking, removeGuaranteedByLinkFor, removeMember } from 'helpers/party';
import { LOGOUT } from './auth';
import { addItemToList, removeItemList } from '../../../common/helpers/list-utils';
import { DALTypes } from '../../../common/enums/DALTypes';

export const LOAD_DATA = 'reva/LOAD_DATA';
export const LOAD_DATA_SUCCESS = 'reva/LOAD_DATA_SUCCESS';
export const LOAD_DATA_FAIL = 'reva/LOAD_DATA_FAIL';

export const LOAD_COMMS = 'reva/LOAD_COMMS';
export const LOAD_COMMS_SUCCESS = 'reva/LOAD_COMMS_SUCCESS';
export const LOAD_COMMS_FAIL = 'reva/LOAD_COMMS_FAIL';

export const UPDATE_DATA = 'reva/UPDATE_DATA';
export const UPDATE_DATA_SUCCESS = 'reva/UPDATE_DATA_SUCCESS';
export const UPDATE_DATA_FAIL = 'reva/UPDATE_DATA_FAIL';
export const LOAD_PARTY_DATA_SUCCESS = 'reva/LOAD_PARTY_DATA_SUCCESS';
export const LOAD_PARTY_DATA_FAILED = 'reva/LOAD_PARTY_DATA_FAILED';
export const LOAD_PERSON_DATA_FAILED = 'reva/LOAD_PERSON_DATA_FAILED';
export const SET_HOLD_SCREEENING = 'reva/SET_HOLD_SCREEENING';
export const SET_HOLD_SCREEENING_SUCCESS = 'reva/SET_HOLD_SCREEENING_SUCCESS';
export const SET_HOLD_SCREEENING_FAILURE = 'reva/SET_HOLD_SCREEENING_FAILURE';
export const UPDATED_MEMBER_DATA = 'reva/UPDATED_MEMBER_DATA';
const SET_PARTY_FILTER = 'reva/SET_PARTY_FILTER';

export const CLEAR_PARTY_DATA = 'reva/CLEAR_PARTY_DATA';

const initialState = new Immutable.Map({
  appointments: new Immutable.Map(),
  parties: new Immutable.Map(),
  members: new Immutable.Map(),
  tasks: new Immutable.Map(),
  communications: new Immutable.Map(),
  company: new Immutable.Map(),
  persons: new Immutable.Map(),
  inactiveMembers: new Immutable.Map(),
  leases: new Immutable.Map(),
  applications: new Immutable.Map(),
  quotePromotions: new Immutable.Map(),
  loading: false,
  partyFilter: {},
  screeningSummary: new Immutable.Map(),
  externalPhones: new Immutable.Map(),
  usersLastActivity: new Immutable.Map(),
  outCommsProgram: new Immutable.Map(),
  partiesAdditionalInfo: new Immutable.Map(),
  partiesProgram: new Immutable.Map(),
  activeLeaseWorkflowData: new Immutable.Map(),
  seedPartyData: new Immutable.Map(),
  otherPartiesApplications: new Immutable.Map(),
});

const enhancePartiesWithMembers = state => {
  const strippedParties = state.get('parties').filter(p => p.partyMembersIds);
  if (strippedParties.isEmpty()) return state;

  const members = state.get('members');
  const persons = state.get('persons');

  const parties = strippedParties.map(p => {
    const { partyMembersIds, ...party } = p;

    const partyMembers = partyMembersIds.map(id => {
      const member = members.get(id);
      if (!member) {
        console.error({ partyMembersIds, party, partyMemberId: id }, 'Could not find partyMember!');
        return {}; // This will probably cause problems downstream, but not throwing an error right away might be useful...
      }
      const contactInfo = persons.get(member.personId).contactInfo;
      return { ...member, contactInfo };
    });

    return {
      ...party,
      partyMembers,
    };
  });

  return state.mergeDeep(new Immutable.Map({ parties }));
};

const updateState = (state, result) => {
  const retrievedData = Object.keys(result).reduce((acc, current) => {
    const entitiesToUpdate = result[current].map(data => [data.id, data]);

    const updatedEntities = state
      .get(current)
      .mergeDeep(new Immutable.Map(entitiesToUpdate))
      .filter(p => !p.deleted);

    acc[current] = isEqual(updatedEntities, state.get(current)) ? state.get(current) : updatedEntities;
    return acc;
  }, {});
  const newRepoDataToUpdate = new Immutable.Map(retrievedData);
  let newState = state.merge(newRepoDataToUpdate.set('loading', false));
  newState = enhancePartiesWithMembers(newState);
  return newState;
};

const setHoldScreening = (state, action) => {
  const { partyId, holdScreeningType, isHeld } = action;
  const screeningSummaries = state.get('screeningSummary');
  const newEntry = { ...screeningSummaries.get(partyId) };
  const holdReasons = isHeld
    ? addItemToList(newEntry.screeningSummary.holdReasons, holdScreeningType)
    : removeItemList(newEntry.screeningSummary.holdReasons, holdScreeningType);
  const isPartyApplicationOnHold = holdReasons.length;
  newEntry.screeningSummary = { ...newEntry.screeningSummary, holdReasons, isPartyApplicationOnHold };
  const toUpdate = screeningSummaries.set(partyId, newEntry);
  return updateState(state, { screeningSummary: toUpdate.toArray() });
};

const updatedMemberData = (state, action) => {
  const { links, selectedPartyMember, partyMembers, actionType } = action;
  let members;
  switch (actionType) {
    case DALTypes.ManageMembersActions.REMOVE_LINK:
      members = removeGuaranteedByLinkFor(selectedPartyMember, partyMembers);
      break;
    case DALTypes.ManageMembersActions.LINK:
      members = getMembersAfterLinking(selectedPartyMember, links, partyMembers);
      break;
    case DALTypes.ManageMembersActions.REMOVE_MEMBER:
      members = removeMember(state.get('members'), selectedPartyMember);
      return state.set('members', members);
    default:
      return state;
  }
  return updateState(state, { members });
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case SET_HOLD_SCREEENING: {
      return setHoldScreening(state, action);
    }
    case UPDATED_MEMBER_DATA: {
      return updatedMemberData(state, action);
    }
    case LOAD_DATA:
      return state
        .set('loading', true)
        .set('loaded', false)
        .set('partyLoadingError', null)
        .set('errorPartyId', null)
        .set('otherPartiesApplications', new Immutable.Map());
    case UPDATE_DATA_SUCCESS:
    case LOAD_DATA_SUCCESS: {
      const newState = state.set('loading', false).set('loaded', true).set('partyLoadingError', null).set('errorPartyId', null);
      return updateState(newState, action.result);
    }
    case LOAD_PARTY_DATA_FAILED: {
      const { error = { token: 'UNKNOWN_ERROR', message: 'Generic Error' } } = action;
      return state.set('partyLoadingError', { message: error.message, token: error.token }).set('errorPartyId', action.partyId);
    }
    case LOAD_COMMS: {
      return state.set('commsLoading', true).set('commsLoaded', false).set('commsLoadgingError', null);
    }
    case LOAD_COMMS_SUCCESS: {
      const newState = state.set('commsLoading', false).set('commsLoaded', true).set('commsLoadgingError', null);
      return updateState(newState, action.result);
    }
    case LOAD_COMMS_FAIL: {
      const { error } = action;
      return state.set('commsLoading', false).set('commsLoaded', true).set('commsLoadingError', { message: error.message, token: error.token });
    }
    case LOAD_PERSON_DATA_FAILED: {
      const { error = { token: 'UNKNOWN_ERROR', message: 'Generic Error' } } = action;
      return state.set('personLoadingError', { message: error.message, token: error.token }).set('errorPersonId', action.personId);
    }
    case UPDATE_DATA_FAIL:
    case LOAD_DATA_FAIL:
      return state.set('loading', false).set('error', (action.error || {}).token || 'UNKNOWN_ERROR');
    case LOGOUT:
      return initialState;
    case CLEAR_PARTY_DATA:
      // keep the users for the dropdown and the comms for the widely available comm flyouts
      return initialState.set('users', state.get('users'));
    case SET_PARTY_FILTER:
      return state.set('partyFilter', action.result);
    case UPDATE_DATA:
    default:
      return state;
  }
}

export const setPartyFilter = filter => ({
  type: SET_PARTY_FILTER,
  result: filter,
});
