/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import * as reduxDevTools from 'redux-devtools';
import LogMonitor from 'redux-devtools-log-monitor';
import DockMonitor from 'redux-devtools-dock-monitor';

const createDevTools = (reduxDevTools || {}).createDevTools && DockMonitor && LogMonitor;

const DevTools = () =>
  createDevTools ? (
    createDevTools(
      <DockMonitor toggleVisibilityKey="H" changePositionKey="Q" defaultIsVisible={true}>
        <LogMonitor />
      </DockMonitor>,
    )
  ) : (
    <noscript />
  );

export default DevTools;
