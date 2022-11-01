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

import 'helpers/checks/flexbox';
import 'helpers/checks/use-gemini-fix';
import 'helpers/position';
import 'helpers/window-resize';
import 'helpers/focus-fix';
import cfg from 'helpers/cfg';

import '../sass/red.scss';
import { Card, Button } from 'components';
import { sendToParent } from 'helpers/postMessage';
import { initTrans } from '../../common/helpers/i18n-client';

const i18nOptions = cfg('i18nOptions');

initTrans(i18nOptions, () => {
  ReactDOM.render(
    <div>
      <Card style={{ width: 500, height: 300 }}>
        <Button
          label="Send message"
          onClick={() =>
            sendToParent({
              type: 'CHILD_CLICK',
              foo: 'foo',
              bar: 'bar',
              baz: 'baz',
            })
          }
        />
      </Card>
    </div>,
    document.getElementById('content'),
  );
});
