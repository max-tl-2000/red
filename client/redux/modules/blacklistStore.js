/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const LOAD_BLACKLIST = 'blacklist/LOAD_BLACKLIST';
const LOAD_BLACKLIST_SUCCESS = 'blacklist/LOAD_BLACKLIST_SUCCESS';
const LOAD_BLACKLIST_FAIL = 'blacklist/LOAD_BLACKLIST_FAIL';

const REMOVE_FROM_BLACKLIST = 'blacklist/REMOVE_FROM_BLACKLIST';
const REMOVE_FROM_BLACKLIST_SUCCESS = 'blacklist/REMOVE_FROM_BLACKLIST_SUCCESS';
const REMOVE_FROM_BLACKLIST_FAIL = 'blacklist/REMOVE_FROM_BLACKLIST_FAIL';

const MARK_AS_SPAM = 'persons/MARK_AS_SPAM';
const MARK_AS_SPAM_SUCCESS = 'persons/MARK_AS_SPAM_SUCCESS';
const MARK_AS_SPAM_FAIL = 'persons/MARK_AS_SPAM_FAIL';
const CLEAR_CONTACT_MARKED_AS_SPAM = 'person/CLEAR_CONTACT_MARKED_AS_SPAM';

const initialState = {
  blacklist: [],
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_BLACKLIST_SUCCESS:
      return {
        ...state,
        blacklist: action.result,
      };
    case LOAD_BLACKLIST_FAIL:
      return {
        ...state,
        error: 'LOAD_BLACKLIST_ERROR',
      };
    case REMOVE_FROM_BLACKLIST_SUCCESS:
      return {
        ...state,
        blacklist: state.blacklist.filter(item => item.value !== action.valueToBeRemoved),
        valueToBeRemoved: '',
      };
    case REMOVE_FROM_BLACKLIST_FAIL:
      return {
        ...state,
        error: 'REMOVE_FROM_BLACKLIST_ERROR',
        valueToBeRemoved: '',
      };
    case MARK_AS_SPAM_SUCCESS:
      return {
        ...state,
        contactMarkedAsSpam: action.contactMarkedAsSpam,
      };
    case CLEAR_CONTACT_MARKED_AS_SPAM: {
      const { contactMarkedAsSpam, ...rest } = state; //eslint-disable-line
      return rest;
    }
    default:
      return state;
  }
}

export const loadBlacklist = () => ({
  types: [LOAD_BLACKLIST, LOAD_BLACKLIST_SUCCESS, LOAD_BLACKLIST_FAIL],
  promise: client => client.get('/blacklist'),
});

export const removeFromBlacklist = (type, value) => ({
  types: [REMOVE_FROM_BLACKLIST, REMOVE_FROM_BLACKLIST_SUCCESS, REMOVE_FROM_BLACKLIST_FAIL],
  promise: client => client.del('/blacklist', { data: { type, value } }),
  valueToBeRemoved: value,
});

export const markContactAsSpam = contact => ({
  types: [MARK_AS_SPAM, MARK_AS_SPAM_SUCCESS, MARK_AS_SPAM_FAIL],
  contactMarkedAsSpam: contact,
  promise: client =>
    client.post('/blacklist', {
      data: { type: contact.type, value: contact.value },
    }),
});

export const clearContactMarkedAsSpam = () => ({
  type: CLEAR_CONTACT_MARKED_AS_SPAM,
});
