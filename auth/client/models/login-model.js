/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { extendObservable, action } from 'mobx';
import { createModel } from 'helpers/Form/FormModel';
import { t } from 'i18next';
import { auth } from '../stores/auth';
import { VALIDATION_TYPES } from '../../../client/helpers/Form/Validation';

export const loginModel = {
  create() {
    const model = createModel(
      {
        email: '',
        password: '',
        _name_: '',
      },
      {
        email: {
          interactive: false,
          waitForBlur: true,
          required: t('EMAIL_VALIDATION_MESSAGE'),
          validationType: [
            {
              type: VALIDATION_TYPES.EMAIL,
              errorMessage: t('EMAIL_VALIDATION_MESSAGE'),
            },
          ],
        },
        password: {
          interactive: false,
          waitForBlur: true,
          required: t('PASSWORD_VALIDATION_MESSAGE'),
        },
      },
    );

    const loginViewModel = extendObservable(model, {
      get loginError() {
        return auth.loginError;
      },
      get loginIn() {
        return auth.loginIn;
      },
      get blockedAccount() {
        return auth.blockedAccount;
      },
    });

    loginViewModel.login = action(async () => {
      const data = loginViewModel.serializedData;
      return await auth.login(data);
    });

    loginViewModel.requestTemporalResetPassword = action(async (appId, confirmUrl) => {
      const data = {};
      data.appId = appId;
      data.confirmUrl = confirmUrl;
      return await auth.requestTemporalResetPassword(data);
    });

    return loginViewModel;
  },
};
