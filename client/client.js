/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * THIS IS THE ENTRY POINT FOR THE CLIENT, JUST LIKE server.js IS THE ENTRY POINT FOR THE SERVER.
 */
import '@babel/polyfill';
import './init-events';
import React from 'react';
import ReactDOM from 'react-dom';
import { browserHistory } from 'react-router';
import { Provider } from 'mobx-react';
import createStore from './redux/create';
import { client, initAPIClient } from './apiClient';
import Root from './containers/Root/Root';
import cfg from './helpers/cfg';
import { webpAlphaCapable } from '../common/client/support';
import { init as initProfile } from './modules/localProfile';
// will add a class flex to the DOM if flex is supported
import './helpers/checks/flexbox';
import './helpers/checks/use-gemini-fix';
import './helpers/position';
import './helpers/window-resize';
import './helpers/focus-fix';
import './sass/red.scss';

import { initListener } from './socket/eventListener';
import { initLayout } from './helpers/init-layout';
import { initTrans } from '../common/helpers/i18n-client';
import { checkAuthChanges } from './modules/checkAuthChanges';
import { init as initZendeskModule } from './modules/zendeskModule';
import { init as initSisenseModule } from './modules/sisenseModule';
import { init as initCloudinaryHelpers } from '../common/helpers/cloudinary';
import { initVersionHelper } from './helpers/version-helper';
import { init as initFullStoryModule } from './modules/fullStoryModule';
import { initErrorModule } from './modules/errorModule';
import { initClientLogger } from '../common/client/logger';
import { init as initServiceErrorNotifier } from './modules/service-error';

import { overrideClick } from './modules/click-override.ts';

import * as partySelectors from './redux/selectors/partySelectors';
import * as leaseSelectors from './redux/selectors/leaseSelectors';
import * as screeningSelectors from './redux/selectors/screeningSelectors';
import * as userSelectors from './redux/selectors/userSelectors';

import { leasingNavigator } from './helpers/leasing-navigator';
import * as mu from '../common/helpers/moment-utils';
import { createTemplateManagerFactory } from './custom-components/TemplateExpander/TemplateExpanderManager';
import { screen } from '../common/client/screen';
import { registerWalkMeGlobals } from './helpers/walk-me-register-globals';
import { createAuthStore } from './mobx/stores/authInstance';
import { createPostStore } from './mobx/stores/post';
import { initPostService, getPostService } from './mobx/services/post-service';
import { getTeamsCallQueueService, initTeamsCallQueueService } from './mobx/services/teams-call-queue-service';
import { createTeamsCallQueueStore } from './mobx/stores/teamsCallQueue';

overrideClick();
let store;

const logger = initClientLogger({
  apiClient: client,
  getContextData() {
    const s = store ? store.getState() : {};
    const { auth = {} } = s;
    const { user } = auth;

    if (!user) return undefined;

    const { id, fullName, email, tenantId } = user;
    return { user: { id, fullName, email }, tenantId };
  },
});

initErrorModule(logger, { id: 'leasing' });

initProfile();

store = createStore(client);

const auth = createAuthStore();

initPostService(auth);
initTeamsCallQueueService(auth);

const post = createPostStore(getPostService());
const teamsCallQueueStore = createTeamsCallQueueStore(getTeamsCallQueueService());

initListener(store, client);
initLayout(store);

const i18nOptions = cfg('i18nOptions');

initServiceErrorNotifier(store);
initAPIClient(store);

initZendeskModule(store);
initSisenseModule();
initFullStoryModule(store);
checkAuthChanges(store);

initVersionHelper(client);

const templateManagerFactory = createTemplateManagerFactory(client);

const mobxStores = {
  tenant: {
    name: cfg('tenantName'),
  },
  urls: cfg('urls'),
  leasingNavigator,
  templateManagerFactory,
  screen,
  auth,
  post,
  teamsCallQueueStore,
};

const renderApp = () => {
  // the pseudo random key is needed because this callback is executed
  // also when the translations are reloaded. if we don't use a key
  // react will refuse to re render the app
  ReactDOM.render(
    <Provider {...mobxStores}>
      <Root key={`key-${Date.now()}`} store={store} history={browserHistory} />
    </Provider>,
    document.getElementById('content'),
  );
};

if (process.env.NODE_ENV === 'development') {
  window.__leasingNavigator = leasingNavigator;
  window.__templateManagerFactory = templateManagerFactory;
  // exposing this helper on dev only to make it easier forcing reloading the app
  window.__renderApp = renderApp;

  // exposing this selectors for easy debuggability in dev
  window.__selectors = {
    partySelectors,
    leaseSelectors,
    screeningSelectors,
    userSelectors,
  };

  window.__mobxStores = mobxStores;

  // expose the moment utils to the global scope for debugging purposes
  window.__mu = mu;
}

registerWalkMeGlobals(cfg('urls.walkMeScriptURL'));

const main = async () => {
  const canUseWebpAlpha = await webpAlphaCapable(); // check if browser support webp with alpha

  initCloudinaryHelpers({
    forcePNG: !canUseWebpAlpha, // If true then use `f_png` in the generated cloudinary url for the images
    cloudName: cfg('cloudinaryCloudName', 'revat'),
    tenantName: cfg('tenantName', ''),
    isPublicEnv: cfg('isPublicEnv', ''),
    domainSuffix: cfg('domainSuffix', ''),
    reverseProxyUrl: cfg('reverseProxyUrl', ''),
    rpImageToken: cfg('rpImageToken', ''),
    cloudEnv: cfg('cloudEnv', ''),
    isDevelopment: cfg('isDevelopment', ''),
  });

  initTrans(i18nOptions, renderApp);
};

main().catch(console.error.bind(console, 'client-main:error'));
