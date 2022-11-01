/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import cfg from '../../helpers/cfg';

const LOAD_INVENTORY_AMENITIES = 'reva/LOAD_INVENTORY_AMENITIES';
const LOAD_INVENTORY_AMENITIES_SUCCESS = 'reva/LOAD_INVENTORY_AMENITIES_SUCCESS';
const LOAD_INVENTORY_AMENITIES_FAIL = 'reva/LOAD_INVENTORY_AMENITIES_FAIL';
const LOAD_AMENITIES_PROPERTY = 'reva/LOAD_AMENITIES_PROPERTY';
const LOAD_AMENITIES_PROPERTY_SUCCESS = 'reva/LOAD_AMENITIES_PROPERTY_SUCCESS';
const LOAD_AMENITIES_PROPERTY_FAIL = 'reva/LOAD_AMENITIES_PROPERTY_FAIL';
const LOAD_LIFESTYLES = 'amenities/LOAD_LIFESTYLES';
const LOAD_LIFESTYLES_SUCCESS = 'amenities/LOAD_LIFESTYLES_SUCCESS';
const LOAD_LIFESTYLES_FAIL = 'amenities/LOAD_LIFESTYLES_FAIL';
const LOAD_CFG_VALUES = 'amenities/LOAD_CFG_VALUES';

const initialState = {
  inventoryAmenities: {},
  allAmenities: [],
  loadingAmenities: false,
  lifestyles: [],
  lifestylesLoaded: false,
  cfgValuesLoaded: false,
  hidePropertyLifestyles: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_CFG_VALUES:
      return {
        ...state,
        cfgValuesLoaded: true,
        hidePropertyLifestyles: cfg('tenantSettings.preferences.hidePropertyLifestyles'),
      };
    case LOAD_INVENTORY_AMENITIES_SUCCESS:
      return {
        ...state,
        inventoryAmenities: {
          ...state.inventoryAmenities,
          [action.inventory.id]: action.result,
        },
      };
    case LOAD_AMENITIES_PROPERTY:
      return {
        ...state,
        allAmenities: [],
        loadingAmenities: true,
      };
    case LOAD_AMENITIES_PROPERTY_SUCCESS:
      return {
        ...state,
        allAmenities: action.result,
        loadingAmenities: false,
      };
    case LOAD_AMENITIES_PROPERTY_FAIL:
      return {
        ...state,
        loadingAmenities: false,
      };
    case LOAD_LIFESTYLES:
      return {
        ...state,
        lifestylesLoaded: false,
      };
    case LOAD_LIFESTYLES_SUCCESS: {
      const lifestyles = action.result.map(amenity => ({
        ...amenity,
        id: amenity.displayName,
      }));
      return {
        ...state,
        lifestyles,
        lifestylesLoaded: true,
      };
    }
    case LOAD_LIFESTYLES_FAIL:
      return {
        ...state,
        lifestyles: [],
        lifestylesLoaded: false,
      };
    default:
      return state;
  }
}

export function loadInventoryAmenities(inventory) {
  return {
    types: [LOAD_INVENTORY_AMENITIES, LOAD_INVENTORY_AMENITIES_SUCCESS, LOAD_INVENTORY_AMENITIES_FAIL],
    promise: client => client.get(`/inventories/${inventory.id}/amenities`),
    inventory,
  };
}

export function loadAmenitiesProperty(query) {
  return {
    types: [LOAD_AMENITIES_PROPERTY, LOAD_AMENITIES_PROPERTY_SUCCESS, LOAD_AMENITIES_PROPERTY_FAIL],
    promise: client => client.get(`/amenities/?propertyId=${query.propertyId}`),
    query,
  };
}

export function loadLifestyles() {
  const category = DALTypes.AmenityCategory.PROPERTY;
  const subCategory = DALTypes.AmenitySubCategory.LIFESTYLE;
  return {
    types: [LOAD_LIFESTYLES, LOAD_LIFESTYLES_SUCCESS, LOAD_LIFESTYLES_FAIL],
    promise: client => client.get(`/amenities/?category=${category}&subCategory=${subCategory}`),
    category,
    subCategory,
  };
}

export const loadCfgValues = () => ({
  type: LOAD_CFG_VALUES,
});
