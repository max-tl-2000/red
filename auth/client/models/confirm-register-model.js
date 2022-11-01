/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { extendObservable } from 'mobx';
import { createModel } from 'helpers/Form/FormModel';
import trim from 'helpers/trim';
import { t } from 'i18next';

export const confirmRegisterModel = {
  create(auth) {
    const model = createModel(
      {
        password: '',
      },
      {
        password: {
          required: t('PASSWORD_VALIDATION_MESSAGE'),
          fn({ value }) {
            return !trim(value) ? { error: t('PASSWORD_VALIDATION_MESSAGE') } : true;
          },
        },
      },
    );

    const confirmViewModel = extendObservable(model, {
      get loginError() {
        return auth.loginError;
      },
      get loginIn() {
        return auth.loginIn;
      },
    });

    confirmViewModel.register = (userId, emailAddress, isResetPassword, appId, token) => {
      const registerUserData = confirmViewModel.serializedData;
      registerUserData.userId = userId;
      registerUserData.emailAddress = emailAddress;
      registerUserData.isResetPassword = isResetPassword;
      registerUserData.appId = appId;
      registerUserData.token = token;
      return auth.registerCommonUser(registerUserData);
    };

    return confirmViewModel;
  },
};
