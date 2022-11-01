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

import { Provider } from 'mobx-react';
import { initClientLogger } from 'client/logger';
import { browserHistory as history } from 'react-router';
import { initTrans } from '../../common/helpers/i18n-client';
import cfg from '../../client/helpers/cfg';
import { apiClient } from './modules/api-client';
import { initErrorModule } from '../../client/modules/errorModule';
// will add a class flex to the DOM if flex is supported
import '../../client/helpers/checks/flexbox';
import '../../client/helpers/checks/use-gemini-fix';
import '../../client/helpers/position';
import '../../client/helpers/window-resize';
import '../../client/helpers/focus-fix';
import { replace, location } from '../../client/helpers/navigator';
import { initAuth } from './modules/init-auth';

import * as stores from './stores';
import * as models from './models';

import Root from './containers/root/root';
import { init as initCloudinaryHelpers } from '../../common/helpers/cloudinary';
import { overrideClick } from '../../client/modules/click-override.ts';
import './sass/global.scss';

overrideClick();

const logger = initClientLogger({ apiClient });

initErrorModule(logger, { id: 'auth' });

const confirmToken = cfg('confirmToken');

// this module will be in charge to handle the token changes
initAuth({
  auth: stores.auth,
  location,
  onLogout: () => replace({ pathname: '/login' }),
  confirmToken,
});

const i18nOptions = cfg('i18nOptions');

initCloudinaryHelpers({ cloudName: cfg('cloudinaryCloudName', 'revat') });

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
