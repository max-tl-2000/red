/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { PaymentProvidersTypes } from './payment-types';

export const getPaymentProviderType = paymentProviderMode => {
  switch (paymentProviderMode) {
    case DALTypes.PaymentProviderMode.FAKE:
      return PaymentProvidersTypes.FAKE;
    case DALTypes.PaymentProviderMode.REAL_PROD:
      return PaymentProvidersTypes.APTEXX;
    case DALTypes.PaymentProviderMode.REAL_TEST:
      return PaymentProvidersTypes.APTEXX;
    default:
      return PaymentProvidersTypes.FAKE;
  }
};
