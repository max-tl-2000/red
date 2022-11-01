/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import isEqual from 'lodash/isEqual';
import { updateInventoryHolds, INVENTORY_STEPPER_COLLAPSED_INDEX } from 'helpers/inventory';
import cfg from '../../helpers/cfg';
import { PRICE_FILTER_MAX, PRICE_FILTER_PLUS_VALUE } from '../../helpers/priceRangeConstants';

export const LOAD_UNIT_DETAILS = 'reva/LOAD_UNIT_DETAILS';
export const LOAD_UNIT_DETAILS_SUCCESS = 'reva/LOAD_UNIT_DETAILS_SUCCESS';
export const LOAD_UNIT_DETAILS_FAIL = 'reva/LOAD_UNIT_DETAILS_FAIL';

const SEARCH_UNITS = 'units/SEARCH_UNITS';
const SEARCH_UNITS_SUCCESS = 'units/SEARCH_UNITS_SUCCESS';
const SEARCH_UNITS_FAIL = 'units/SEARCH_UNITS_FAIL';
const NO_UNITS_TO_DISPLAY = 'units/NO_UNITS_TO_DISPLAY';

export const LOAD_INVENTORY_BY_QUERY = 'inventory/LOAD_INVENTORY_BY_QUERY';
export const LOAD_INVENTORY_BY_QUERY_SUCCESS = 'inventory/LOAD_INVENTORY_BY_QUERY_SUCCESS';
export const LOAD_INVENTORY_BY_QUERY_FAIL = 'inventory/LOAD_INVENTORY_BY_QUERY_FAIL';

export const RESET_MARKET_RENT = 'inventory/RESET_MARKET_RENT';

const INVENTORY_ON_HOLD = 'inventory/INVENTORY_ON_HOLD';
const INVENTORY_UPDATED = 'inventory/INVENTORY_UPDATED';
const OPEN_STEP_INDEX = 'inventory/OPEN_STEP_INDEX';
const CLOSE_STEP_INDEX = 'inventory/CLOSE_STEP_INDEX';

const initialState = {
  loadingInventory: false,
  buildings: [],
  layouts: [],
  inventoryTypesList: [],
  loadingInventoryDetails: false,
  searchResultsList: [],
  searchingUnits: false,
  lastSearchUnitsRequestId: null,
  lastLoadInventoryByQueryRequestId: null,
  openStepperIndex: INVENTORY_STEPPER_COLLAPSED_INDEX,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_INVENTORY_BY_QUERY:
      return {
        ...state,
        lastLoadInventoryByQueryRequestId: action.reqId,
      };
    case LOAD_UNIT_DETAILS:
      return {
        ...state,
        inventory: null,
        buildings: [],
        layouts: [],
        inventoryTypes: [],
        loadingInventoryDetails: true,
      };
    case LOAD_UNIT_DETAILS_SUCCESS: {
      const { buildings, inventoryTypes, layouts, ...inventory } = action.result;

      return {
        ...state,
        inventory,
        buildings,
        layouts,
        inventoryTypes,
        loadingInventoryDetails: false,
      };
    }
    case LOAD_UNIT_DETAILS_FAIL:
      return {
        ...state,
        loadingInventoryDetails: false,
      };
    case SEARCH_UNITS:
      return {
        ...state,
        searchingUnits: true,
        searchResultsList: [],
        lastSearchUnitsRequestId: action.reqId,
      };
    case SEARCH_UNITS_SUCCESS: {
      const searchResultsList = action.result || [];
      const marketRentRange = { ...cfg('marketRentRange'), isValid: true };

      return {
        ...state,
        marketRentRange,
        searchingUnits: false,
        searchResultsList,
      };
    }
    case SEARCH_UNITS_FAIL:
      return {
        ...state,
        searchingUnits: false,
      };
    case NO_UNITS_TO_DISPLAY: {
      const marketRentRange = { ...cfg('marketRentRange'), isValid: true };
      return {
        ...state,
        marketRentRange,
        searchingUnits: false,
        searchResultsList: [],
      };
    }
    case RESET_MARKET_RENT: {
      const { marketRentRange, ...rest } = state;
      return rest;
    }
    case INVENTORY_ON_HOLD: {
      const { searchResultsList } = state;

      if (!searchResultsList || !searchResultsList.length) return { ...state, isOngoingInventoryHold: false };
      const { inventoryOnHold, hold = false } = action.result || {};

      const data = searchResultsList.map(inventory => {
        if (inventory.id !== inventoryOnHold.inventoryId) return { ...inventory, isOngoingInventoryHold: false };

        const inventoryHolds = updateInventoryHolds(inventory.inventoryHolds || [], inventoryOnHold, hold);
        const quotable = inventoryHolds.every(ih => ih.quotable);
        return {
          ...inventory,
          isOngoingInventoryHold: false,
          isInventoryOnHold: !!inventoryHolds.length,
          quotable,
          inventoryHolds,
        };
      });

      return {
        ...state,
        searchResultsList: data,
      };
    }
    case INVENTORY_UPDATED: {
      const { searchResultsList: orgSearchResultsList } = state;
      if (!orgSearchResultsList || !orgSearchResultsList.length) return state;

      const { inventoryId, state: inventoryState } = action.result || {};

      if (!inventoryState || !inventoryId) return state;

      const searchResultsList = orgSearchResultsList.map(inventory => {
        if (inventory.id !== inventoryId) return inventory;
        return { ...inventory, state: inventoryState };
      });

      return {
        ...state,
        searchResultsList,
      };
    }

    case OPEN_STEP_INDEX: {
      return {
        ...state,
        openStepperIndex: action.result,
      };
    }

    case CLOSE_STEP_INDEX: {
      return {
        ...state,
        openStepperIndex: INVENTORY_STEPPER_COLLAPSED_INDEX,
      };
    }

    default:
      return state;
  }
}

export const loadInventoryByQuery = (url, query, type) => async (makeRequest, dispatch) => {
  const params = { query, type };
  const reqId = newId();
  dispatch({ type: LOAD_INVENTORY_BY_QUERY, reqId });

  const { data, error } = await makeRequest({
    method: 'GET',
    url,
    params,
    reqId,
  });

  if (error) {
    console.log('Failed to loadInventoryByQuery', error);
    return [];
  }

  return data;
};

export function loadInventoryDetails(params, token = null) {
  const args = {
    ...(params.partyId ? { params: { partyId: params.partyId } } : {}),
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  };

  return {
    types: [LOAD_UNIT_DETAILS, LOAD_UNIT_DETAILS_SUCCESS, LOAD_UNIT_DETAILS_FAIL],
    promise: client => client.get(`/inventories/${params.id}/details`, args),
  };
}

let oldFilters = null;

/* check if filters has changed to avoid do fetchs needlessly */
const filtersChanged = filters => {
  if (!oldFilters) {
    oldFilters = filters;
    return true;
  }
  const hasChanged = !isEqual(filters, oldFilters);
  oldFilters = filters;
  return hasChanged;
};

/**
 * @param {object} filters
 */
export const fetchResults = filters => async (makeRequest, dispatch, getState) => {
  if (!filtersChanged(filters)) return;

  if (filters.marketRent && filters.marketRent.max >= PRICE_FILTER_MAX) {
    filters.marketRent.max = PRICE_FILTER_PLUS_VALUE;
  }

  const reqId = newId();
  dispatch({ type: SEARCH_UNITS, reqId });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/search/units',
    payload: filters,
    reqId,
  });

  const lastRequest = getState().inventoryStore.lastSearchUnitsRequestId;

  if (lastRequest !== reqId) {
    console.log(`Discarding request=${reqId}, last request is=${lastRequest}`);
    return;
  }

  if (error) {
    dispatch({ type: SEARCH_UNITS_FAIL, error });
    return;
  }

  dispatch({ type: SEARCH_UNITS_SUCCESS, result: data });
};

export const onHoldInventory = ({ inventoryOnHold, hold, quotable }) => ({
  type: INVENTORY_ON_HOLD,
  result: { inventoryOnHold, hold, quotable },
});

export const onInventoryUpdated = ({ inventoryId, state }) => ({
  type: INVENTORY_UPDATED,
  result: { inventoryId, state },
});

export const getInventoryDetails = inventoryId => async makeRequest => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/inventories/${inventoryId}/details`,
  });

  return { data, error };
};

export const searchUnits = filters => async makeRequest => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/search/units',
    payload: filters,
  });

  return { data, error };
};

export const setNoUnitsToDisplay = () => ({ type: NO_UNITS_TO_DISPLAY });

export const resetMarketRent = () => ({ type: RESET_MARKET_RENT });

export const setInventoryOnHold = inventoryOnHold => async makeRequest =>
  await makeRequest({
    method: 'POST',
    url: `/inventories/${inventoryOnHold.inventoryId}/holds`,
    payload: {
      partyId: inventoryOnHold.partyId,
      reason: inventoryOnHold.reason,
      quotable: inventoryOnHold.quotable,
      quoteId: inventoryOnHold.quoteId,
    },
  });

export const releaseInventory = (inventoryId, partyId) => async makeRequest =>
  await makeRequest({
    method: 'DEL',
    url: `/inventories/${inventoryId}/holds`,
    payload: {
      partyId,
    },
  });

export const openStepIndex = stepIndex => (makeRequest, dispatch) => {
  dispatch({ type: OPEN_STEP_INDEX, result: stepIndex });
};

export const closeStepIndex = () => ({ type: CLOSE_STEP_INDEX });
