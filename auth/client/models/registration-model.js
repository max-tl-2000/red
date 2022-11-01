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
import { auth } from '../stores/auth';

export const registrationModel = {
  create() {
    const model = createModel(
      {
        password: '',
      },
      {
        password: {
          interactive: true,
          fn({ value }) {
            return !trim(value) ? { error: t('PASSWORD_VALIDATION_MESSAGE') } : true;
          },
        },
      },
    );

    const registrationViewModel = extendObservable(model, {
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

    registrationViewModel.setPassword = (userId, emailAddress, token) => {
      const changePasswordData = registrationViewModel.serializedData;
      changePasswordData.userId = userId;
      changePasswordData.token = token;
      changePasswordData.emailAddress = emailAddress;

      return auth.changePasswordOnFirstLogin(changePasswordData);
    };

    return registrationViewModel;
  },
};
