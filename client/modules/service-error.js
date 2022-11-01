/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from 'helpers/mediator';
import { t } from 'i18next';
import snackbar from 'helpers/snackbar/snackbar';
import { logout } from 'helpers/auth-helper';
import { openForbiddenDialog } from 'redux/modules/forbiddenDialogStore';
import { window } from '../../common/helpers/globals';

export const init = store => {
  const state = {};
  let timeoutId;
  mediator.on('service:error', (e, args) => {
    if (timeoutId) {
      console.warn('Logout in progress...');
      return;
    }

    const { err, unauthorized, forbidden, path, response = {} } = args;
    const tenantIsInvalid = err.status === 400 && (response.body || {}).token === 'INVALID_TENANT';

    if (tenantIsInvalid || unauthorized) {
      if (unauthorized && path.match(/\/api\/login/)) {
        // only ignore 401 in the response from the login api
        return;
      }

      console.info('Logout scheduled');
      // TODO: refactor the way login/logout is handled to avoid the delay
      timeoutId = setTimeout(logout, 300);
      return;
    }

    if (forbidden) {
      store.dispatch(openForbiddenDialog());
    }

    if ([403, 404].includes(err.status)) return;

    if (process.env.NODE_ENV !== 'production') {
      // for now production won't have the snackbar notifications
      // this is kept in local mode only for developers to start
      // handlign the errors properly
      if (state.showingMessage) return;

      state.showingMessage = true;

      snackbar.show({
        text: t('UNEXPECTED_ERROR'),
        buttonLabel: t('RELOAD'),
        onButtonClick: () => {
          window.location.reload();
        },
        onHide: () => {
          state.showingMessage = false;
        },
        sticky: true,
      });
    }

    console.error('service:error', args);
  });
};
