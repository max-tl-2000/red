/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import FakeProvider from './fake-provider';
import AptexxProvider from './aptexx-provider';
import { PaymentProvider } from './payment-provider';
import { PaymentProvidersTypes } from '../common/payment-types';
import { ServiceError } from '../../../server/common/errors';

export default class PaymentProviderFactory {
  providers = new Map<string, PaymentProvider>();

  getProvider = (providerType: string, providerMode: string | undefined, testDataUnits: boolean | undefined): PaymentProvider => {
    let provider = this.providers.get(providerType);

    if (provider) return provider;

    switch (providerType) {
      case PaymentProvidersTypes.FAKE:
        provider = new FakeProvider(testDataUnits);
        break;
      case PaymentProvidersTypes.APTEXX:
        provider = new AptexxProvider(providerMode);
        break;
      default:
        break;
    }

    if (!provider) {
      throw new ServiceError({
        token: 'PAYMENT_PROVIDER_NOT_FOUND',
        status: 404,
      });
    }

    this.providers.set(providerType, provider);
    return provider;
  };
}
