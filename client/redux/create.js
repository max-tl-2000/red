/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createStore, applyMiddleware, compose } from 'redux';
import createLogger from 'redux-logger';
import { getQueryProps } from 'helpers/url';
import { clientMiddleware } from './middleware/clientMiddleware';
import persister from './middleware/persisterMiddleware';
import { createCounterMiddleware } from './middleware/eventCounterMiddleware';
import reducer from './modules/reducer';

const devMode = process.env.NODE_ENV === 'development';

const startLocalDevTools = () => {
  let DevTools = require('../containers/DevTools/DevTools').default; // eslint-disable-line

  if (!DevTools) return;

  DevTools = DevTools.default ? DevTools.default : DevTools;

  if (!DevTools || !DevTools.instrument) {
    return;
  }

  // eslint-disable-next-line
  return DevTools.instrument();
};

const checkIfEnableDevTools = storeCreator => {
  const { rdxTools, rdxLogger } = getQueryProps(window.location, ['rdxTools', 'rdxLogger']);

  if (((devMode && __DEVTOOLS__) || rdxLogger) && createLogger) {
    const logger = createLogger({ collapsed: true });
    storeCreator = compose(storeCreator, applyMiddleware(logger));
  }

  let enhancer;

  if ((devMode && __DEVTOOLS__) || rdxTools) {
    enhancer = window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__() : startLocalDevTools();
    if (enhancer) {
      storeCreator = compose(storeCreator, enhancer);
    }
  }

  return storeCreator;
};

export default function createApiClientStore(client) {
  let storeCreator = compose(applyMiddleware(persister(client), clientMiddleware(client), createCounterMiddleware(client)));

  storeCreator = checkIfEnableDevTools(storeCreator);

  const basicStore = storeCreator(createStore);
  const store = basicStore(reducer);

  store.client = client;

  if (devMode) {
    // just publish it globally to easily
    // inspect the current state of the store
    window.__reduxStore = store;

    if (module.hot) {
      module.hot.accept('./modules/reducer', () => {
        store.replaceReducer(require('./modules/reducer')); // eslint-disable-line
      });
    }
  }

  return store;
}
