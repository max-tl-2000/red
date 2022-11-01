/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { PaymentProviderInterface } from './payment-provider-interface';
import { getProperties } from '../../../../server/dal/propertyRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import config from '../../../config';
import { request } from '../../../../common/helpers/httpUtils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { ContextualError } from '../../../../server/common/errors';
import { TARGET_ACCOUNT_PLURAL_TYPE, TARGET_ACCOUNT_NAME, TARGET_ACCOUNT_TYPE } from '../../../common/enums/target-account-types';

export class AptexxProvider extends PaymentProviderInterface {
  constructor(paymentProviderMode) {
    super(paymentProviderMode);
    const cfg = config.aptexx;
    const [aptexxHostname, apiKey] =
      paymentProviderMode === DALTypes.PaymentProviderMode.REAL_PROD ? [cfg.productionHostname, cfg.productionApiKey] : [cfg.testHostname, cfg.testApiKey];
    this.aptexxUrl = `https://${aptexxHostname}${config.aptexx.endpointPath}`;
    this.apiKey = apiKey;
    this.contentType = 'application/json';
    this.aptexxTimeout = 20000;
  }

  /**
   * Gets an error response.
   * In the case, API does not use HTTP response codes to indicate errors. And, all responses will have an HTTP 200 response code.
   * like this API: https://www.aptx.cm/#/docs/api/
   * e.g
   *  {
   *   "errors":
   *    [
   *      {
   *       "type":"PROCESSOR_NOT_FOUND"
   *      }
   *   ]
   * }
   * @return {boolean} Determine if this indicate an error.
   * */
  responseHasErrors(bodyContent) {
    const { errors } = bodyContent || {};
    return !!errors;
  }

  async makeAptexxCall(endpoint, bodyContent = {}) {
    // IMPORTANT: apiKey should not be logged!
    const baseUrl = `${this.aptexxUrl}${endpoint}`;
    const fullUrl = `${baseUrl}?token=${this.apiKey}`;

    // also, remove callbackUrl since it contains the webhook token
    const { callbackUrl: _, ...bodyContentToLog } = bodyContent;
    this.logger.debug({ baseUrl, bodyContentToLog }, 'making aptexx call');

    // TODO: can some calls be made asynchronously?
    let responseFromAptexx;
    let aptexxErrors;
    try {
      responseFromAptexx = await request(fullUrl, {
        method: 'post',
        timeout: this.aptexxTimeout,
        data: bodyContent,
        headers: { Accept: this.contentType },
      });
      this.logger.debug({ responseFromAptexx }, 'got aptexx response');
      // TODO: should we catch rejects here (which deal with 400 errs and the like?  or fallthrough)
      if (this.responseHasErrors(responseFromAptexx)) {
        aptexxErrors = responseFromAptexx.errors;
        const errStr = aptexxErrors.map(err => err.type).join(',');
        throw new ContextualError({ message: `Aptexx reported a problem: ${errStr}`, aptexxErrors });
      }
    } catch (err) {
      this.logger.error({ baseUrl, bodyContentToLog, aptexxErrors, err }, 'Aptexx request error');
      throw new ContextualError({ message: 'Aptexx call failed', aptexxErrors });
    }
    return responseFromAptexx;
  }

  /**
   * Gets all accounts and associated data accessible by the api user. Each account can have many payment targets.
   * A targetId will be required for most API calls.
   * @return {Array} Output is the collection of accounts.
   * */
  async getAccounts() {
    return this.makeAptexxCall('getAccounts');
  }

  // TODO: restore values from propertyProvider.  Currently we have two properties configured
  // in sandbox - "Test 1" and "Test 2".  These are expected to have accounts named in the
  // format tenantName:propertyName:accountType
  getAptexxReceivables(invoice, applicationAccount, holdAccount) {
    const applicationFeeWaiverAmount = (invoice.applicationFeeWaiverAmount && invoice.applicationFeeWaiverAmount * 100) || 0;
    const applicationFeeAmount = invoice.applicationFeeAmount * 100 - applicationFeeWaiverAmount;
    const receivables = [];

    if (applicationFeeAmount > 0) {
      receivables.push({
        description: invoice.applicationFeeName,
        amount: applicationFeeAmount,
        targetId: applicationAccount,
      });
    }

    if (invoice.holdDepositFeeId) {
      receivables.push({
        description: invoice.holdDepositFeeName,
        amount: invoice.holdDepositFeeIdAmount * 100,
        targetId: holdAccount,
      });
    }
    return receivables;
  }

  async getDataForAptexxCreateGuestApi({ invoiceId, invoice, tenantId, firstName, lastName, email }) {
    const { propertyId } = invoice;
    const callbackUrl = this.getPaymentCallbackUrl(tenantId);
    const [expires, period] = config.payment.tokenExpires.split(' ');
    const expiresOn = +now().add(expires, period);
    const successUrl = encodeURI(config.aptexx.successUrl);
    const cancelUrl = encodeURI(config.aptexx.cancelUrl);
    const targetIdsMap = await this.getTargetIds({ tenantId }, { propertyId, groupByTargetType: true });

    const [applicationAccount] = targetIdsMap[TARGET_ACCOUNT_PLURAL_TYPE[TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.APPLICATION_ACCOUNT]]];
    const [holdAccount] = targetIdsMap[TARGET_ACCOUNT_PLURAL_TYPE[TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.HOLD_ACCOUNT]]];

    return {
      targetId: applicationAccount,
      integrationId: invoiceId,
      accountId: invoice.personApplicationId,
      groupIntegrationId: tenantId,
      firstName,
      lastName,
      email,
      expiresOn,
      receivables: this.getAptexxReceivables(invoice, applicationAccount, holdAccount),
      callbackUrl: encodeURI(callbackUrl),
      successUrl,
      cancelUrl,
    };
  }

  async createGuestFromAptexx(createGuestArgs) {
    const createGuestParams = await this.getDataForAptexxCreateGuestApi(createGuestArgs);
    return this.makeAptexxCall('createGuest', createGuestParams);
  }

  async initiatePayment({ invoice, firstName, lastName, email, tenantId }) {
    const integrationId = this.generateIntegrationId();
    const createGuestArgs = {
      invoiceId: integrationId,
      invoice,
      firstName,
      lastName,
      email,
      tenantId,
    };

    const formUrl = await this.createGuest(createGuestArgs);
    const { id: invoiceId } = await this.createInvoice({ tenantId }, { ...invoice, id: integrationId });
    this.assertIntegrationId({ tenantId }, integrationId, invoiceId);

    return { invoiceId, formUrl };
  }

  async createGuest(createGuestArgs) {
    const guest = await this.createGuestFromAptexx(createGuestArgs);
    return guest.link;
  }

  async getTransactionsFromProvider(filter) {
    this.logger.info(filter, 'getting transactions from aptexx');
    return await this.makeAptexxCall('getTransactions', filter);
  }

  getPaymentTargetAccounts = ctx => this.getTargetAccounts(ctx);

  getPropertyByTargetId(properties, targetId) {
    // getting the first property who had the targetId
    return properties.find(property => {
      const { aptexx = {} } = property.paymentProvider || {};
      const { accountIds = {} } = aptexx;
      return Object.keys(accountIds).some(key => +accountIds[key] === +targetId);
    });
  }

  getFromDay(latestTransactionDatesGroupedByTargetId, properties, targetId) {
    const transactionDate = latestTransactionDatesGroupedByTargetId.get(targetId) || { createdOn: now().format('x') };
    const { timezone: propertyTimezone } = this.getPropertyByTargetId(properties, targetId) || {};
    const fromDay = toMoment(+transactionDate.createdOn, { timezone: propertyTimezone });
    this.logger.trace({ transactionDate, propertyTimezone, fromDay }, 'gettting fromDay');
    return fromDay;
  }

  /**
   * Get all transactions since the last fetched transaction. Transaction types include payments, declines, voids, refunds, and reversals
   * @param {string} tenantId: tenant id
   */
  async getTransactions(ctx, options = {}) {
    const properties = (await getProperties(ctx)).filter(property => !property.inactive);
    const targetIds = await this.getTargetIds(ctx, options);
    const latestTransactionDatesGroupedByTargetId = await this.getLatestTransactionDatesGroupedByTargetId(ctx);
    this.logger.trace({ ctx, targetIds }, 'getTransactions');

    return Promise.all(
      targetIds.map(async targetId => {
        const fromDay = this.getFromDay(latestTransactionDatesGroupedByTargetId, properties, targetId);
        return {
          targetId,
          transactions: await this.getTransactionsFromProvider({
            targetId,
            fromDay: fromDay.format(YEAR_MONTH_DAY_FORMAT),
          }).catch(err => this.logger.error({ err, ctx, targetId, fromDay }, 'Error fetching aptexx transactions')),
        };
      }),
    );
  }

  /**
   * Get all transactions for a given date range. Transaction types include payments, declines, voids, refunds, and reversals
   * @param {string} tenantId: tenant id
   * @param {string} fromDay: The from day (or only day) of transactions. format: YYYY-MM-DD
   */
  async getTransactionsByFromDay(ctx, fromDay, options = {}) {
    const targetIds = await this.getTargetIds(ctx, options);
    this.logger.trace({ ctx, targetIds }, 'getTransactionsByFromDay');

    return Promise.all(
      targetIds.map(async targetId => ({
        targetId,
        transactions: await this.getTransactionsFromProvider({
          targetId,
          fromDay,
        }).catch(err => this.logger.error({ err, ctx, targetId, fromDay }, 'Error fetching aptexx transactions')),
      })),
    );
  }
}
