/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { extendObservable } from 'mobx';
import { createModel } from 'helpers/Form/FormModel';
import { t } from 'i18next';
import { VALIDATION_TYPES } from '../../../client/helpers/Form/Validation';

export const resetPasswordModel = {
  create(auth) {
    const model = createModel(
      {
        email: '',
      },
      {
        email: {
          required: t('EMAIL_REQUIRED'),
          validationType: [
            {
              type: VALIDATION_TYPES.EMAIL,
              errorMessage: t('EMAIL_VALIDATION_MESSAGE'),
            },
          ],
        },
      },
    );

    const resetPasswordViewModel = extendObservable(model, {
      get resetPasswordError() {
        return auth.resetPasswordError;
      },
      get sentResetPassword() {
        return auth.sentResetPassword;
      },
      get isResettingPassword() {
        return auth.isResettingPassword;
      },
    });

    resetPasswordViewModel.requestResetPassword = ctx => {
      const data = resetPasswordViewModel.serializedData;
      auth.requestResetPasswordCommonUser({ ...data, ...ctx });
    };

    resetPasswordViewModel.resend = sentResetPassword => auth.updateSentResetPassword(sentResetPassword);

    return resetPasswordViewModel;
  },
};
