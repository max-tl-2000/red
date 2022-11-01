/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { showMsgBox } from 'components/MsgBox/showMsgBox';
import { ApplicationTimeout } from '../../containers/application/application-timeout';

export const logout = auth => {
  auth.logout();
  window.location = window.location.origin;
};

let showingDialog = false;

export const showSessionLostDialog = (agent, application) => {
  if (showingDialog) return;
  showMsgBox(<ApplicationTimeout agent={agent} application={application} />, {
    title: t('TIME_OUT_TITLE'),
    lblOK: '',
    lblCancel: '',
  });

  showingDialog = true;
};

export const isTokenExpiredError = errorData => errorData.message === 'jwt expired' || errorData.code === 'invalid_token';
