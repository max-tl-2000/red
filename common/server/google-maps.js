/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import googlemaps from '@google/maps';
import get from 'lodash/get';
import { Promise } from 'bluebird';
import loggerInstance from '../helpers/logger';
import { isNumber, isObject, isArray } from '../helpers/type-of';
import sleep from '../helpers/sleep';
import config from '../../consumer/config';

const logger = loggerInstance.child({ subType: 'googleMaps' });
const defaultNearbyPlacesRadius = 10000; // 10km
const googleMapsClient = googlemaps.createClient({
  Promise,
  key: config.webUtils.googleMapsToken,
});

export const FETCH_BY = {
  KEYWORD: 'KEYWORD',
  TYPE: 'TYPE',
};

const isValidLocation = location => {
  const isObjectLocation = isObject(location);
  const isArrayLocation = isArray(location);
  if (!isArrayLocation && !isObjectLocation) return false;

  let lat;
  let lng;

  if (isObjectLocation) {
    lat = location.lat;
    lng = location.lng;
  }

  if (isArrayLocation) {
    [lat, lng] = location;
  }

  if (!isNumber(lat) || !isNumber(lng)) return false;
  return true;
};

export const getNearbyPlaces = async (ctx, options) => {
  const { location, categories = [], radius = defaultNearbyPlacesRadius, pagesToFetch = 1, fetchBy = FETCH_BY.KEYWORD } = options || {};
  let results = [];

  if (!isValidLocation(location)) return results;
  if (!categories.length) return results;

  const keyword = categories.map(cat => `(${cat})`).join(' OR ');
  const [type] = categories;
  let placesFilter = {
    language: 'en',
    location,
    radius,
    rankby: 'prominence',
  };

  placesFilter = fetchBy === FETCH_BY.KEYWORD ? { ...placesFilter, keyword } : { ...placesFilter, type };

  try {
    let resultsPage = 0;
    let hasMoreResults = true;

    while (resultsPage < pagesToFetch && hasMoreResults) {
      // google does not allow applications to immediately get more than 20 results
      // instead their pagetoken becomes valid a few moments later
      resultsPage > 0 && (await sleep(1000));

      logger.trace({ ctx, placesFilter, resultsPage: resultsPage + 1, pagesToFetch }, 'calling google places api nearbySearch');

      const res = await googleMapsClient.placesNearby(placesFilter).asPromise();
      results = [...results, ...get(res, 'json.results', [])];
      const pagetoken = get(res, 'json.next_page_token');

      if (pagetoken) {
        hasMoreResults = true;
        // we need to remove location otherwise api returns invalid request
        const { location: propertyLocation, ...rest } = placesFilter;
        placesFilter = { ...rest, pagetoken };
      }

      resultsPage++;
    }
  } catch (error) {
    logger.error({ ctx, placesFilter, error, requestStatus: error?.json?.status }, 'an error occured calling google places api nearbySearch');
  }

  return results;
};
