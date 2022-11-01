/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { window } from '../helpers/globals';
import { loadScript } from './load-script';

export const registerUserInGlobal = (
  { id, email, impersonatorId, impersonatorEmail } = {},
  { idKey = 'userId', emailKey = 'userEmail', impersonatorIdKey = '', impersonatorEmailKey = 'userEmail' } = {},
) => {
  window[`__reva_${idKey}`] = id;
  window[`__reva_${emailKey}`] = email;

  if (impersonatorIdKey && impersonatorId) {
    window[`__reva_${impersonatorIdKey}`] = impersonatorId;
  }

  if (impersonatorEmailKey && impersonatorEmail) {
    window[`__reva_${impersonatorEmailKey}`] = impersonatorEmail;
  }

  window.__reva_walkMeEmail = impersonatorEmail || email;

  return () => {
    window[`__reva_${idKey}`] = null;
    window[`__reva_${emailKey}`] = null;
    window.__reva_walkMeEmail = null;

    if (impersonatorIdKey) {
      window[`__reva_${impersonatorIdKey}`] = null;
    }

    if (impersonatorEmailKey) {
      window[`__reva_${impersonatorEmailKey}`] = null;
    }
  };
};

export const loadWalkMe = async walkMeScriptURL => {
  if (!walkMeScriptURL) return; // walkMe is disabled
  window._walkmeConfig = { smartLoad: true };
  if (window.__proc$Script) return; // skip this module in testcafe
  await loadScript(walkMeScriptURL, { async: true });
};
