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

export const registerModel = {
  create(auth) {
    const model = createModel(
      {
        email: '',
      },
      {
        email: {
          interactive: false,
          waitForBlur: true,
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

    const registerViewModel = extendObservable(model, {
      get registerError() {
        return auth.registerError;
      },
      get sentRegister() {
        return auth.sentRegister;
      },
      get isRegistering() {
        return auth.isRegistering;
      },
    });

    registerViewModel.send = ({ token }) => {
      const data = registerViewModel.serializedData;
      return auth.inviteCommonUser({ email: data.email, token });
    };

    registerViewModel.resend = sentRegister => auth.updateSentRegister(sentRegister);

    return registerViewModel;
  },
};
