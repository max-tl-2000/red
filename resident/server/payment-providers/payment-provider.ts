/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPaymentMethodsByUserIdAndIntegrationId } from '../services/payment';
import { parseAsInTimezone, now, formatMoment } from '../../../common/helpers/moment-utils';
import { CARD_EXPIRATION_DATE_FORMAT, CARD_EXPIRATION_DISPLAY_FORMAT } from '../../../common/date-constants';
import { ServiceError } from '../../../server/common/errors';
import { IDbContext } from '../../../common/types/base-types';
import { PaymentChannel, PaymentBrand, PaymentMethod, LeaseInfo, PaymentInfo } from './paymentTypes';
import { MaintenanceInfo } from './maintenanceTypes';

const isPaymentMethodExpired = (date: string) => {
  if (!date) return false;
  // We default to the second day of the next month
  const expirationDate = parseAsInTimezone(date, { format: CARD_EXPIRATION_DATE_FORMAT, timezone: 'GMT' }).endOf('month').add(2, 'days');

  return expirationDate.isBefore(now({ timezone: 'GMT' }), 'day');
};

const getServiceFeePrice = (channelType: PaymentChannel, brand: PaymentBrand) => {
  let serviceFeePrice;
  switch (channelType) {
    case PaymentChannel.Debit:
      serviceFeePrice = { absoluteServiceFeePrice: 4.95 };
      if (brand === PaymentBrand.Amex) {
        throw new ServiceError({ token: 'UNRECOGNIZED_BRAND_TYPE', status: 400 });
      }
      break;
    case PaymentChannel.Ach:
      serviceFeePrice = { absoluteServiceFeePrice: 0, relativeServiceFeePrice: 0 };
      break;
    case PaymentChannel.Credit:
      serviceFeePrice = { relativeServiceFeePrice: 2.95 };
      if (brand === PaymentBrand.Amex) {
        serviceFeePrice = { relativeServiceFeePrice: 3.25 };
      }
      break;
    case PaymentChannel.None:
      serviceFeePrice = {};
      break;
    default:
      throw new ServiceError({ token: 'UNRECOGNIZED_CHANNEL_TYPE', status: 400 });
  }
  return serviceFeePrice;
};

export const enhancePaymentMethod = paymentMethod => {
  const { id, brand, channelType, lastFour, expirationMonth, userId, created_at, isDefault, externalId, inventoryId } = paymentMethod;

  const expirationDate: string = expirationMonth ? formatMoment(expirationMonth, { format: CARD_EXPIRATION_DISPLAY_FORMAT }) : expirationMonth;

  return {
    id,
    brand,
    channelType,
    lastFour,
    expirationDate,
    isExpired: isPaymentMethodExpired(expirationMonth),
    isDefault,
    ...getServiceFeePrice(channelType, brand),
    userId,
    createdAt: created_at,
    externalId,
    inventoryId,
  } as PaymentMethod;
};

export class PaymentProvider {
  getPaymentInfo(ctx: IDbContext, leaseInfo: LeaseInfo, commonUserId: string): Promise<PaymentInfo[]>;

  hasOverduePayments(ctx: IDbContext, leaseInfo: LeaseInfo): Promise<boolean>;

  async getPaymentMethods(ctx: IDbContext, commonUserId: string, personIntegrationId: string): Promise<PaymentMethod[]> {
    return (await getPaymentMethodsByUserIdAndIntegrationId(ctx, commonUserId, personIntegrationId)).map(enhancePaymentMethod);
  }

  getPaymentMethodFormUrl(ctx: IDbContext, data: { personId: string; propertyId: string; commonUserId: string; successUrl: string; cancelUrl: string });

  getScheduledPaymentFormUrl(ctx: IDbContext, data: { personId: string; propertyId: string; commonUserId: string; successUrl: string; cancelUrl: string });

  getMaintenanceInformation(ctx: IDbContext, leaseInfoList: LeaseInfo[]): Promise<MaintenanceInfo>;

  getMaintenanceTypes(ctx: IDbContext, data: { clientId: string; accountId: string });

  getStoredAptexxData(
    ctx: IDbContext,
    leaseInfo: LeaseInfo,
    aptexxAccountId?: number,
    doNotThrow?: boolean,
  ): Promise<{
    accountPersonId?: string;
    integrationId?: string;
    integrationIdIsMissing?: boolean;
  }>;
}
