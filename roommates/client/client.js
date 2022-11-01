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

import cfg from 'helpers/cfg';
import { Provider } from 'mobx-react';
import { initClientLogger } from 'client/logger';
import { browserHistory as history } from 'react-router';
import { apiClient } from './modules/api-client';
import { initErrorModule } from '../../client/modules/errorModule';

// The bellow code will add a felx class to the DOM if flex is supported
import 'helpers/checks/flexbox';
import 'helpers/checks/use-gemini-fix';
import 'helpers/position';
import 'helpers/window-resize';
import 'helpers/focus-fix';

import { initAuth } from './modules/auth';
import * as stores from './stores';
import * as models from './models';
import Root from './containers/root/root';
import './sass/global.scss';
import { replace, location } from '../../client/helpers/navigator';
import { initTrans } from '../../common/helpers/i18n-client';
import { webpAlphaCapable } from '../../common/client/support';
import { init as initCloudinaryHelpers } from '../../common/helpers/cloudinary';
import { overrideClick } from '../../client/modules/click-override.ts';

overrideClick();

const i18nOptions = cfg('i18nOptions');

const webSocketUrl = cfg('socketConfig.url');

const propertyConfig = cfg('propertyConfig');

const logger = initClientLogger({ apiClient });

initErrorModule(logger, { id: 'roommates' });

document.addEventListener('DOMContentLoaded', () => {
  if (window.ga) {
    window.ga('create', cfg('propertyGoogleAnalyticsId'), 'auto');
    window.ga('send', 'pageview');
  }
});

// this module will be in charge to handle the token changes
initAuth({
  auth: stores.auth,
  location,
  onLogout: () => {
    stores.home.fillNonFilteredRoommates();
    replace({ pathname: '/' });
  },
  webSocketUrl,
  propertyConfig,
});

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

  initTrans(i18nOptions, () => {
    // the pseudo random key is needed because this callback is executed
    // also when the translations are reloaded. if we don't use a key
    // react will refuse to re render the app
    render(
      <Provider {...stores} {...models}>
        <Root key={`key-${Date.now()}`} history={history} />
      </Provider>,
      document.querySelector('#content'),
    );
  });
};

main();
