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
import React from 'react';
import { render } from 'react-dom';
import 'helpers/checks/flexbox';
import 'helpers/checks/use-gemini-fix';
import 'helpers/position';
import 'helpers/window-resize';
import 'helpers/focus-fix';

import cfg from 'helpers/cfg';
import { Provider } from 'mobx-react';

import { browserHistory as history } from 'react-router';

import { apiClient } from './modules/api-client';
import { initErrorModule } from '../../client/modules/errorModule';
// will add a class flex to the DOM if flex is supported
import { initAuth } from './modules/init-auth';
import * as stores from './stores';
import * as models from './models';

import Root from './containers/root/root';
import './sass/global.scss';
import { location, replace } from '../../client/helpers/navigator';
import { initTrans } from '../../common/helpers/i18n-client';
import { webpAlphaCapable } from '../../common/client/support';
import { init as initCloudinaryHelpers } from '../../common/helpers/cloudinary';
import { initVersionHelper } from '../../client/helpers/version-helper';
import { initSocketListener } from './modules/socket-listener';
import { init as initFullStoryModule } from './modules/full-story-module';
import { overrideClick } from '../../client/modules/click-override.ts';
import { initClientLogger } from '../../common/client/logger';
import { registerWalkMeGlobals } from './modules/walk-me-globals';

overrideClick();

const logger = initClientLogger({
  apiClient,
  getContextData() {
    const { application = {}, auth = {} } = stores;
    const { userId, impersonatorEmail, impersonatorUserId } = auth;
    const aObj = application?.applicationObject;
    return {
      applicantId: aObj?.applicantId,
      personId: aObj?.personId,
      partyId: aObj?.partyId,
      firstName: aObj?.applicationData?.firstName,
      lastName: aObj?.applicationData?.lastName,
      userInfo: { userId, impersonatorEmail, impersonatorUserId },
    };
  },
});

const i18nOptions = cfg('i18nOptions');

const wsUrl = cfg('socketConfig.url');

initErrorModule(logger, { id: 'rentapp' });

// this module will be in charge to handle the token changes
initAuth({
  auth: stores.auth,
  location,
  wsUrl,
  application: stores.application,
  onLogout: () => replace({ pathname: '/' }),
  agent: stores.agent,
});

if (process.env.NODE_ENV === 'development') {
  window.__stores = stores;
}

initSocketListener({ auth: stores.auth, application: stores.application, agent: stores.agent });

initVersionHelper(apiClient);

const renderApp = () => {
  // the pseudo random key is needed because this callback is executed
  // also when the translations are reloaded. if we don't use a key
  // react will refuse to re render the app
  render(
    <Provider {...stores} {...models}>
      <Root key={`key-${Date.now()}`} history={history} />
    </Provider>,
    document.querySelector('#content'),
  );
};

const main = async () => {
  const canUseWebpAlpha = await webpAlphaCapable(); // check if browser support webp with alpha

  initCloudinaryHelpers({
    forcePNG: !canUseWebpAlpha, // If true then use `f_png` in the generated cloudinary url for the images
    cloudName: cfg('cloudinaryCloudName', 'revat'),
    tenantName: cfg('tenantName', 'application'),
    isPublicEnv: cfg('isPublicEnv', ''),
    isDevelopment: cfg('isDevelopment', ''),
    domainSuffix: cfg('domainSuffix', ''),
    reverseProxyUrl: cfg('reverseProxyUrl', ''),
    rpImageToken: cfg('rpImageToken', ''),
    cloudEnv: cfg('cloudEnv', ''),
  });

  initTrans(i18nOptions, renderApp);
};

initFullStoryModule(stores.auth);
registerWalkMeGlobals(stores.application, stores.auth, cfg('urls.walkMeScriptURL'), cfg('agentInfo'));

// TODO: why is this line used?
stores.application.setApplicationSettings(stores.applicationSettings);

main();
