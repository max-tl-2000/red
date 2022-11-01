/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import update from 'immutability-helper';
import { t } from 'i18next';
import { addPropertyToFilters, updateNumBedroomsToFilters, normalizeFilters } from '../../../common/helpers/filters';
import { LOAD_PARTY_DATA_FAILED, LOAD_PARTY_DATA_SUCCESS } from './dataStore';

const CLEAR_FILTERS = 'units-filter-clear-filters';

const SHOW_MODAL = 'units-filter-show-modal';
const HIDE_MODAL = 'units-filter-hide-modal';

const PUSH_REQUEST = 'units-filter-push-request';
const PUSH_SUCCESS = 'units-filter-push-success';
const PUSH_FAILURE = 'units-filter-push-failure';

const ADD_PROPERTY_ID = 'reva/ADD_PROPERTY_ID';
const UPDATE_NUM_BEDROOMS = 'reva/UPDATE_NUM_BEDROOMS';

const INITIAL_STATE = {
  filters: {},
  isModalOpen: false,
};

export default function reducer(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case CLEAR_FILTERS:
    case LOAD_PARTY_DATA_SUCCESS: {
      return {
        ...state,
        filters: normalizeFilters(action.result),
      };
    }
    case LOAD_PARTY_DATA_FAILED:
      return {
        ...state,
        filters: {},
      };
    case SHOW_MODAL:
      return {
        ...state,
        isModalOpen: true,
      };
    case HIDE_MODAL:
      return {
        ...state,
        isModalOpen: false,
      };
    case PUSH_FAILURE:
      return {
        ...state,
        pushStatus: t('UNITS_FILTER_SAVE_FAILURE'),
      };
    case PUSH_SUCCESS:
      return {
        ...state,
        filters: action.filters,
        pushStatus: t('UNITS_FILTER_SAVE_SUCCESS'),
      };
    case PUSH_REQUEST:
      return {
        ...state,
        pushStatus: t('UNITS_FILTER_SAVE_REQUEST'),
      };
    case ADD_PROPERTY_ID:
      return {
        ...state,
        filters: addPropertyToFilters(action.propertyId, state.filters),
      };
    case UPDATE_NUM_BEDROOMS:
      return {
        ...state,
        filters: updateNumBedroomsToFilters(action.numBedrooms, state.filters),
      };
    default:
      return state;
  }
}

export const clearFilters = () => ({
  type: CLEAR_FILTERS,
});

export function showModal() {
  return {
    type: SHOW_MODAL,
  };
}

export function hideModal() {
  return {
    type: HIDE_MODAL,
  };
}

export function pushFilters(partyId, filters) {
  return {
    types: [PUSH_REQUEST, PUSH_SUCCESS, PUSH_FAILURE],
    filters,
    promise: client => client.put(`/parties/${partyId}/units-filters`, { data: filters }),
  };
}

export function toggle(partyId, filters, type, index) {
  const toggled = !filters.amenities[type][index].checked;
  const newFilters = update(filters, {
    amenities: {
      [type]: {
        [index]: {
          checked: {
            $set: toggled,
          },
        },
      },
    },
  });

  return pushFilters(partyId, newFilters);
}

export function toggleAll(partyId, filters, type) {
  const xs = filters.amenities[type];
  const checkAll = xs.filter(x => x.checked).length !== xs.length;
  const newFilters = update(filters, {
    amenities: {
      [type]: xs.reduce((previous, _, index) => {
        previous[index] = {
          checked: {
            $set: checkAll,
          },
        };
        return previous;
      }, {}),
    },
  });

  return pushFilters(partyId, newFilters);
}

/*
 * helper to update any entry in filters except for amenities
 */
export function updateFilterValue(partyId, filters, filterName, value) {
  const newFilters = update(filters, {
    [filterName]: {
      $set: value,
    },
  });
  return pushFilters(partyId, newFilters);
}

export const addPropertyToUnitFilters = propertyId => ({
  type: ADD_PROPERTY_ID,
  propertyId,
});

export const updateUnitFiltersBedrooms = numBedrooms => ({
  type: UPDATE_NUM_BEDROOMS,
  numBedrooms,
});
