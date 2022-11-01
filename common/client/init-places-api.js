/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { deferred } from '../helpers/deferred';
import { document, window } from '../helpers/globals';
import cfg from '../../client/helpers/cfg';

const loadPlaces = () => {
  const d = deferred();

  window.__places_init = () => {
    d.resolve();
  };

  const key = cfg('placesAPIKey');
  const resource = `//maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__places_init`;

  const script = document.createElement('script');
  script.src = resource;
  script.setAttribute('async', true);
  script.setAttribute('defer', true);

  script.onerror = err => {
    console.error( 'resource load error: ' + resource, err ); //eslint-disable-line
    d.reject(new Error('places library failed to load'));
  };

  document.body.appendChild(script);

  return d;
};

export const placesPromise = loadPlaces();

placesPromise.catch(err => console.error('>>> Failed to load places', err));
