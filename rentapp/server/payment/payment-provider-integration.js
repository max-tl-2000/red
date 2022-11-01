/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import getUUID from 'uuid/v4';
import { getTenant } from '../../../server/services/tenantService';
import { AptexxProvider } from './adapters/aptexx-provider';
import { FakeProvider } from './adapters/fake-provider';
import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import { hasUndefinedValues } from '../../../common/helpers/validators';
import config from '../../config';
import { removeToken } from '../../../common/helpers/strings';
import { logEntity } from '../../../server/services/activityLogService';
import { COMPONENT_TYPES, SUB_COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { getPersonById } from '../../../server/services/person';
import { loadPartyAgent } from '../../../server/services/party';
import { doAndRetry } from '../../../common/helpers/attempt';
import { ServiceError } from '../../../server/common/errors';
import { ScreeningVersion } from '../../../common/enums/screeningReportTypes';
import { personApplicationProvider } from '../providers/person-application-provider-integration';

const { PaymentProviderMode } = DALTypes;
const MAX_PAYMENT_ATTEMPTS = 3;

const getPaymentProvider = async ctx => {
  const tenant = await getTenant(ctx);

  const paymentProviderMode = get(tenant.metadata, 'paymentProviderMode', PaymentProviderMode.FAKE);

  switch (paymentProviderMode) {
    case PaymentProviderMode.FAKE:
      return new FakeProvider();
    case PaymentProviderMode.REAL_PROD:
      return new AptexxProvider(PaymentProviderMode.REAL_PROD);
    default:
      return new AptexxProvider(PaymentProviderMode.REAL_TEST);
  }
};

export const doAndRetryPayment = async (ctx, provider) => {
  const paymentProvider = provider || (await getPaymentProvider(ctx));
  const { aptexxTimeout, aptexxUrl, paymentProviderMode } = paymentProvider || {};

  return await doAndRetry(() => paymentProvider.initiatePayment(ctx), {
    maxAttempts: MAX_PAYMENT_ATTEMPTS,
    waitBetweenAttempts: 1000,
    onBeforeAttempt: ({ attemptNumber }) => {
      logger.debug({ ctx, paymentProvider: { aptexxTimeout, aptexxUrl, paymentProviderMode }, attemptNumber }, 'initiatePayment');
    },
    onAttemptFail: ({ error, attemptNumber }) => {
      logger.error({ ctx, error, attemptNumber }, `attempt #${attemptNumber}, failed`);
    },
    onFail: ({ error }) => {
      logger.error({ ctx, error }, 'initiatePayment: no more attempts left');
      throw new ServiceError({ token: 'SERVICE_UNAVAILABLE', status: 503, message: 'Unable to connect the payment provider' });
    },
  });
};

const handleDoAndRetryPayment = async (ctx, paymentProvider) => {
  const { tenantId, invoice, screeningVersion } = ctx;

  if (screeningVersion !== ScreeningVersion.V2) return await doAndRetryPayment(ctx, paymentProvider);

  // TODO: CPM-12483 assume invoice created for screening v2
  const invoiceId = getUUID();
  const formUrl = await paymentProvider.getPaymentLink({ tenantId, invoiceId, invoice, screeningVersion });
  return { invoiceId, formUrl };
};

const getApplicationWithProvider = async (ctx, applicationId) => {
  const { screeningVersion } = ctx;
  // TODO: CPM-12483 implement feeWaived for screening V2
  if (screeningVersion === ScreeningVersion.V2) {
    return { isFeeWaived: false };
  }
  return await personApplicationProvider(screeningVersion).getPersonApplicationById(ctx, applicationId);
};

export const initiatePayment = async ctx => {
  const { tenantId } = ctx;
  const paymentProvider = await getPaymentProvider(ctx);
  const initiatePaymentResp = await handleDoAndRetryPayment(ctx, paymentProvider);

  logger.debug(
    {
      initiatePaymentResp: {
        ...initiatePaymentResp,
        formUrl: removeToken(initiatePaymentResp.formUrl),
      },
    },
    'response in paymentProviderIntegration',
  );

  const { isFeeWaived } = await getApplicationWithProvider(ctx, ctx.invoice.personApplicationId);
  const { holdDepositFeeIdAmount, applicationFeeWaiverAmount } = ctx.invoice;
  // if isFeeWaived is true, this means that applicationFeeAmount is irrelevant to knowing if the totalAmount = 0
  if (isFeeWaived && !holdDepositFeeIdAmount) {
    if (!applicationFeeWaiverAmount) {
      throw new ServiceError({ token: 'MISSING_WAIVER_AMOUNT', status: 412 });
    }

    const { invoiceId } = initiatePaymentResp;
    const { personApplicationId, partyApplicationId } = ctx.invoice;
    const { personId, partyId } = ctx.authUser;
    const msg = {
      tenantId,
      invoiceId,
      personApplicationId,
      partyApplicationId,
      propertyId: ctx.invoice.propertyId,
    };
    await require('../services/payment').processUnparsedPayment(msg); // eslint-disable-line global-require
    const member = await getPersonById(ctx, personId);
    const { impersonatorUserId } = ctx.authUser;
    const agent = await loadPartyAgent(ctx, partyId);
    const userId = impersonatorUserId || (agent && agent.id);
    await logEntity(
      { tenantId, authUser: { id: userId } },
      {
        entity: {
          partyId,
          memberName: member.fullName,
        },
        activityType: ACTIVITY_TYPES.SUBMIT,
        component: COMPONENT_TYPES.APPLICATION,
        subComponent: SUB_COMPONENT_TYPES.WAIVER,
      },
    );
  } else if (!paymentProvider.isFakeProvider) {
    const { formUrl } = initiatePaymentResp;
    await personApplicationProvider(ctx.screeningVersion).savePaymentLink(ctx, ctx.invoice.personApplicationId, formUrl);
  }

  return { ...initiatePaymentResp, isFeeWaived };
};

/* Returns a Map in which keys are the type of target account (i.e. holdAccounts, applicationAccounts),
  and the value is an aggregated list (across all properties) of all of the targetIds for those
  account  */
export const getPaymentTargetAccounts = async ctx => {
  const paymentProvider = await getPaymentProvider(ctx);
  return paymentProvider.getPaymentTargetAccounts(ctx);
};

/* Returns a Map in which keys are the type of target account (i.e. holdAccounts, applicationAccounts),
  and the values are the target ID for that account type for the specified property
*/
export const getPaymentTargetAccountsForProperty = async (ctx, propertyId) => {
  const paymentProvider = await getPaymentProvider(ctx);
  return paymentProvider.getTargetAccounts(ctx, propertyId);
};

export const getTransactions = async (ctx, options = {}) => {
  logger.trace({ ctx, getTransactionsOptions: options }, 'getTransactions');

  const paymentProvider = await getPaymentProvider(ctx);
  return paymentProvider.getTransactions(ctx, options);
};

export const getTransactionsByFromDay = async (ctx, fromDay, options = {}) => {
  logger.trace({ ctx, fromDay }, 'getTransactionsByFromDay');

  const paymentProvider = await getPaymentProvider(ctx);
  return paymentProvider.getTransactionsByFromDay(ctx, fromDay, options);
};

/**
 * Gets all accounts and associated data accessible by the api user. Each account can have many payment targets.
 * A targetId will be required for most API calls.
 * @param {Object} ctx - Request context.
 * @param {string} ctx.tenantId - Tenant id.
 * @param {string} ctx.tenantName - Tenant name.
 * @param {Object} [ctx.filter = {}] - This is to filter data by Client. By default, we are getting the data using apiKey as token.
 * @return {Object[]} Output is the collection of accounts.
 * */
export const getAccounts = async ctx => {
  logger.trace({ ctx }, 'getAccounts');

  const paymentProvider = await getPaymentProvider(ctx);
  return paymentProvider.getAccounts(ctx);
};

// Given ctx, return the tenantId, personApplicationId, and invoiceId, asking provider to parse
// if they are not provided
export const parsePaymentNotification = async ctx => {// eslint-disable-line
  logger.debug({ ctx }, 'parsePaymentNotification');
  const { tenantId } = ctx;
  if (!tenantId) throw new Error('tenantId is required');

  const paymentProvider = await getPaymentProvider(ctx);
  ctx.tenantName = (await getTenant(ctx)).name;
  ctx.host = config.payment.applicationDomain;
  const { personApplicationId, invoiceId, tenantName, host } = ctx;
  // if we have all required keys already, we do not need to parse...
  if (!hasUndefinedValues({ personApplicationId, invoiceId, tenantName, host })) {
    return ctx;
  }
  logger.debug({ ctx, personApplicationId, invoiceId }, 'parsePaymentNotification - not already parsed!');
  const parsedNotification = await paymentProvider.parsePaymentNotification(ctx);

  return { ...ctx, ...parsedNotification };
};
