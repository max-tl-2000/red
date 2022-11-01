/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import querystring from 'querystring';
import getUUID from 'uuid/v4';
import get from 'lodash/get';
import { createApplicationInvoice } from '../../services/application-invoices';
import { getTenant } from '../../../../server/services/tenantService';
import config from '../../../config';
import loggerModule from '../../../../common/helpers/logger';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { getLatestTransactionDatesGroupedByTargetId as getLatestTransactionDatesGroupedByTargetIdService } from '../../services/application-transactions';
import { assert } from '../../../../common/assert';
import { getTargetAccountsForProperty, getAllTargetAccounts } from '../helpers/target-account-helper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { TARGET_ACCOUNT_PLURAL_TYPE } from '../../../common/enums/target-account-types';

export class PaymentProviderInterface {
  constructor(paymentProviderMode) {
    this.paymentProviderMode = paymentProviderMode;
    this.logger = loggerModule.child({ subType: 'payment' });
    this.isFakeProvider = DALTypes.PaymentProviderMode.FAKE === paymentProviderMode;
  }

  createInvoice(ctx, invoice) {
    this.logger.debug({ ctx, invoice }, 'createInvoice for ');
    return createApplicationInvoice(
      ctx,
      pick(invoice, [
        'id',
        'quoteId',
        'applicationFeeId',
        'applicationFeeAmount',
        'holdDepositFeeId',
        'holdDepositFeeIdAmount',
        'personApplicationId',
        'partyApplicationId',
        'applicationFeeWaiverAmount',
        'propertyId',
      ]),
    );
  }

  generateIntegrationId = () => getUUID();

  assertIntegrationId = (ctx, integrationId, invoiceId) => {
    const hasValidIntegration = integrationId === invoiceId;
    !hasValidIntegration && this.logger.error({ ctx, integrationId, invoiceId }, 'Diferent integration id');
    assert(hasValidIntegration, 'assertIntegrationId: Diferent integration id');
  };

  getPaymentCallbackUrl(tenantId) {
    const paymentCallbackCfg = config.payment.callback;
    let { urlParams } = paymentCallbackCfg;
    const ampUrlParams = urlParams && '&';
    const callParams = {
      tenantId,
      token: this.createToken(tenantId),
    };
    const { baseUrl } = paymentCallbackCfg;
    this.logger.trace({ baseUrl, tenantId }, 'getPaymentCallbackUrl');
    const parameters = querystring.stringify(callParams);
    urlParams = `${parameters}${ampUrlParams}${urlParams}`;
    return `${paymentCallbackCfg.baseUrl}?${urlParams}`;
  }

  async getTargetAccounts(ctx, propertyId) {
    let paymentProviderMode = this.paymentProviderMode;
    if (!paymentProviderMode) {
      const tenant = await getTenant(ctx);
      paymentProviderMode = get(tenant.metadata, 'paymentProviderMode'); // Should we delete this code? I dont think is being used
    }

    if (propertyId) return getTargetAccountsForProperty(ctx, propertyId);
    return getAllTargetAccounts(ctx);
  }

  /**
   * returns an aggregated list of all targetIds (of all types) used by property, or a filter by some specific types
   * @param {*} ctx
   * @param {*} options: Object with structure { propertyId, targetTypeFilters } both are optional ex targetTypeFilters: ['hold', 'application']
   * @return: an aggregated list of all targetIds (of all types)
   * If targetTypeFilters param is present just return the targetIds related to the specified types
   * If groupByTargetType param is present returns an object structure with account type as key and the targetIds related as value ex {holdAccounts: ['x']}
   */
  async getTargetIds(ctx, options = {}) {
    const { propertyId, targetTypeFilters } = options;
    let targetIdsGrouped = await this.getTargetAccounts(ctx, propertyId);

    if (targetTypeFilters?.length) {
      targetIdsGrouped = targetTypeFilters.reduce((acc, key) => {
        const objKey = TARGET_ACCOUNT_PLURAL_TYPE[key];
        return targetIdsGrouped[objKey] ? { ...acc, [objKey]: targetIdsGrouped[objKey] } : acc;
      }, {});
    }

    this.logger.trace({ ctx, getTargetIdsOptions: options, targetIdsGrouped }, 'getTargetIds');
    if (options.groupByTargetType) {
      return targetIdsGrouped;
    }

    return Object.keys(targetIdsGrouped).reduce((seq, key) => seq.concat(targetIdsGrouped[key]), []);
  }

  async getLatestTransactionDatesGroupedByTargetId(ctx) {
    return await getLatestTransactionDatesGroupedByTargetIdService(ctx);
  }

  createToken = tenantId => createJWTToken({ tenantId }, { expiresIn: config.payment.tokenExpires });

  async parsePaymentNotification(ctx) {
    const targetAccounts = await this.getTargetAccounts(ctx);
    this.logger.info({ ctx, paymentTransactions: ctx.payments, targetAccounts }, 'Returned targetAccounts');

    const appFeePayment = ctx.payments
      ? ctx.payments.find(p => targetAccounts.applicationAccounts.map(account => account.toString()).includes(p.targetId.toString()))
      : ctx;

    let holdDepositPayment;

    // In the Real Prod configuration scenario Aptexx returns only the application accounts as target accounts
    // hold deposit accounts are empty
    // In the future, this configuration might change, so the code below should accomodate both cases
    if (targetAccounts.holdAccounts && targetAccounts.holdAccounts.length) {
      holdDepositPayment = ctx.payments
        ? ctx.payments.find(p => targetAccounts.holdAccounts.map(account => account.toString()).includes(p.targetId.toString()))
        : ctx;
    } else {
      holdDepositPayment = ctx.payments ? ctx.payments.find(p => p.id !== appFeePayment.id) : ctx;
    }

    this.logger.info({ ctx, appFeePayment, holdDepositPayment }, 'Payment Fees');

    const payment = ctx.payments ? ctx.payments[0] : ctx;

    if (payment) {
      return {
        personApplicationId: payment.accountId,
        invoiceId: payment.integrationId,
        tenantId: payment.groupIntegrationId,
        ...(appFeePayment && {
          appFeeInvoice: {
            transactionId: appFeePayment.id,
            targetId: appFeePayment.targetId,
          },
        }),
        ...(holdDepositPayment && {
          holdDepositInvoice: {
            transactionId: holdDepositPayment.id,
            targetId: holdDepositPayment.targetId,
          },
        }),
      };
    }
    const msg = 'Aptexx notification in unexpected format';
    this.logger.error(ctx, msg);
    throw new Error(msg);
  }
}
