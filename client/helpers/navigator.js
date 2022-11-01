/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { browserHistory } from 'react-router';
import { window } from '../../common/helpers/globals';
import HistorySynchronizer from '../../common/client/history-synchronizer';

export const push = (...args) => browserHistory.push(...args);
export const replace = (...args) => browserHistory.replace(...args);

// TODO: consider remove this export as it can be get from the `helpers/globals`
export const location = window.location;

// keeps track of the current location so we can do things related
// to the current loaded route
export const syncedHistory = new HistorySynchronizer();

// start the syncing of the location
syncedHistory.start();
window.addEventListener('unload', syncedHistory.stop);
