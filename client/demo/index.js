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
import ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';
import { browserHistory as history } from 'react-router';
import cfg from 'helpers/cfg';
import { initClientLogger } from 'client/logger';
import { client } from '../apiClient';

import 'helpers/checks/flexbox';
import 'helpers/checks/use-gemini-fix';
import 'helpers/position';
import 'helpers/window-resize';
import 'helpers/focus-fix';

import Root from './Root';
import { initTrans } from '../../common/helpers/i18n-client';

import '../sass/red.scss';
import { screen } from './screen';
import { initErrorModule } from '../modules/errorModule';

const logger = initClientLogger({ apiClient: client });

initErrorModule(logger, { id: 'componentsDemo' });

const i18nOptions = cfg('i18nOptions');

initTrans(i18nOptions, () => {
  ReactDOM.render(
    <Provider screen={screen}>
      <Root history={history} />
    </Provider>,
    document.getElementById('content'),
  );
});
