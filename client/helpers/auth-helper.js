/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from 'helpers/trim';
import { sisenseLogout } from 'helpers/sisense';
import { window } from '../../common/helpers/globals';
import { lsClear, REVATECH_AUTH } from './ls';

const LOGOUT_THRESHOLD = 300;

let loggingOut = false;

export const isLoggingOut = () => !!loggingOut;

export const logout = () => {
  loggingOut = true;
  sisenseLogout();
  lsClear(REVATECH_AUTH);
  window.location.reload();
};

export const delayedLogout = (threshold = LOGOUT_THRESHOLD) => {
  setTimeout(logout, threshold);
};

export const clearPreviousPath = () => {
  sessionStorage.removeItem('previousPath');
};

export const setPreviousPath = _previousPath => {
  _previousPath = trim(_previousPath);
  if (sessionStorage) {
    if (!_previousPath) {
      clearPreviousPath();
      return;
    }
    sessionStorage.setItem('previousPath', _previousPath);
  }
};

export const getPreviousPath = () => {
  if (sessionStorage) {
    return sessionStorage.getItem('previousPath');
  }
  return '';
};
