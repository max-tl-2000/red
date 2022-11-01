/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenant } from '../../../server/services/tenantService';

import { getPaymentProviderType } from '../common/paymentProvider';
import PaymentProviderFactory from '../payment-providers/payment-provider-factory';
import loggerInstance from '../../../common/helpers/logger';
const logger = loggerInstance.child({ subType: 'Resident - PaymentService' });

const ScheduledPaymentDayOfMonth = {
  FIRST_DAY: 'FIRST_DAY',
  LAST_DAY: 'LAST_DAY',
};

export const getScheduledPaymentDayOfMonth = day => {
  switch (day) {
    case 1:
      return ScheduledPaymentDayOfMonth.FIRST_DAY;
    case 31:
      return ScheduledPaymentDayOfMonth.LAST_DAY;
    default:
      return day.toString();
  }
};

export const getPaymentProvider = async (ctx, testDataUnits) => {
  const tenant = await getTenant(ctx);

  const paymentProviderMode = tenant?.metadata?.paymentProviderMode;
  const paymentProviderType = getPaymentProviderType(paymentProviderMode);

  logger.trace({ ctx, paymentProviderType, paymentProviderMode }, 'getPaymentProvider');
  return new PaymentProviderFactory().getProvider(paymentProviderType, paymentProviderMode, testDataUnits);
};

export const convertDollarsToCents = dollars => dollars * 100;
export const convertCentsToDollars = cents => cents / 100;
