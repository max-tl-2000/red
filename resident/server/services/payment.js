/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { join } from 'path';
import isEmpty from 'lodash/isEmpty';
import values from 'lodash/values';
import mapValues from 'lodash/mapValues';
import mergeWith from 'lodash/mergeWith';
import { getLeaseInfoForPerson, getInventoryIdByIntegrationId } from '../dal/lease-repo';

import * as paymentMethodRepo from '../dal/payment-method-repo';
import loggerInstance from '../../../common/helpers/logger';
import { notify, RESIDENTS } from '../../../common/server/notificationClient';
import EventTypes from '../../../common/enums/eventTypes';
import { PaymentMethodCallbackResult } from '../../../common/enums/enums';
import { enhancePaymentMethod } from '../payment-providers/payment-provider';
import { getPaymentProvider } from '../helpers/paymentHelpers';
import { read } from '../../../common/helpers/xfs';
import { withCachedPromise } from '../../../common/helpers/with-cached-promise';
import { ServiceError } from '../../../server/common/errors';
import { getSeenTransactions, insertScheduledTransactionsInfo } from '../dal/scheduled-transactions-info-repo';
import { HTML_REPLACE_MATCHER } from '../../../common/regex';
import { PaymentChannel } from '../payment-providers/paymentTypes';
import { genericExpirationMonth } from '../payment-providers/constants';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerInstance.child({ subType: 'Resident - PaymentService' });

const getPaymentMethodById = async (ctx, paymentMethodId) => await paymentMethodRepo.getPaymentMethodById(ctx, paymentMethodId);

export const getPaymentMethodsByUserIdAndIntegrationId = async (ctx, commonUserId, integrationId) =>
  await paymentMethodRepo.getPaymentMethodsByUserIdAndIntegrationId(ctx, commonUserId, integrationId);

const createPaymentMethod = async (ctx, paymentMethod) => await paymentMethodRepo.upsertPaymentMethod(ctx, paymentMethod);

const setPaymentMethodExpired = async (ctx, paymentMethodId) =>
  await paymentMethodRepo.updatePaymentMethodExpirationMonth(ctx, paymentMethodId, genericExpirationMonth);

let getGetLeaseInfoForPersonFunc = getLeaseInfoForPerson;
const getGetLeaseInfoForPersonFunction = () => getGetLeaseInfoForPersonFunc;
export const setGetLeaseInfoForPersonFunction = func => (getGetLeaseInfoForPersonFunc = func);
export const resetGetLeaseInfoForPersonFunction = () => (getGetLeaseInfoForPersonFunc = getLeaseInfoForPerson);

const denyPastResidentOnInventoryId = async (ctx, personId, propertyId, inventoryId) => {
  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);
  const workflowStateForInventoryId = leaseInfoList.find(l => l.inventoryId === inventoryId)?.partyWorkflowState;
  if (workflowStateForInventoryId === DALTypes.WorkflowState.ARCHIVED) {
    logger.trace({ ctx, personId, propertyId, inventoryId }, 'action not allowed for past resident on unit');
    throw new ServiceError({ token: 'PAST_RESIDENT_NOT_AUTHORIZED', status: 403 });
  }
};

export const getPaymentInfo = async (ctx, { propertyId, personId, commonUserId, testDataUnits }) => {
  logger.trace({ ctx, personId, commonUserId, propertyId }, 'getPaymentInfo started!');

  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);

  logger.trace({ ctx, leaseInfoList }, 'getPaymentInfo using leaseInfo');
  const paymentProvider = await getPaymentProvider(ctx, testDataUnits);

  return ((await Promise.all(leaseInfoList.map(async leaseInfo => await paymentProvider.getPaymentInfo(ctx, leaseInfo, commonUserId)))) || []).flat(2);
};

const hasOverduePayments = async (ctx, propertyId, personId) => {
  logger.trace({ ctx, personId, propertyId }, 'hasOverduePayments');

  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);

  logger.trace({ ctx, leaseInfoList }, 'getting hasOverduePayments using leaseInfo');
  const paymentProvider = await getPaymentProvider(ctx);

  const paymentProviderRequestTimeout = 4000;

  const overdueInfo = await Promise.all(
    leaseInfoList.map(leaseInfo => {
      let resolve;
      const promise = new Promise(r => (resolve = r));

      paymentProvider.hasOverduePayments(ctx, leaseInfo).then(result => resolve(result));
      setTimeout(() => resolve(false), paymentProviderRequestTimeout);

      return promise;
    }),
  );

  return overdueInfo.some(isOverdue => isOverdue);
};

export const hasOverduePaymentsByProperty = async (ctx, propertyIds, personId) => {
  logger.trace({ ctx, personId, propertyIds }, 'hasOverduePaymentsByProperty');

  const overdueByProperty = await Promise.all(propertyIds.map(async propertyId => [propertyId, await hasOverduePayments(ctx, propertyId, personId)]));

  return overdueByProperty.reduce((acc, [propertyId, hasOverdue]) => ({ ...acc, [propertyId]: { hasOverduePayments: hasOverdue } }), {});
};

export const getScheduledTransactions = async (ctx, { propertyId, personId, commonUserId }) => {
  logger.debug({ ctx, personId, commonUserId, propertyId }, 'getScheduledTransactions started!');

  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);

  logger.debug({ ctx, leaseInfoList }, 'getScheduledTransactions using leaseInfo.');
  const paymentProvider = await getPaymentProvider(ctx);

  const transactionsByLease = (
    (await Promise.all(leaseInfoList.map(async leaseInfo => await paymentProvider.getScheduledTransactions(ctx, leaseInfo)))) || []
  ).flat(2);

  const transactions = mergeWith(...transactionsByLease, (dest, src) => (Array.isArray(dest) ? dest.concat(src) : src));

  const seenTransactions = await getSeenTransactions(
    ctx,
    values(transactions).flatMap(ts => ts.map(t => t.providerTransactionId)),
  );
  const seenTransactionsSet = new Set(seenTransactions.map(t => t.transactionId));

  return mapValues(transactions, ts => ts.filter(t => !seenTransactionsSet.has(t.providerTransactionId.toString())));
};

export const markScheduledTransactionAsSeen = async (ctx, { providerTransactionId }) =>
  await insertScheduledTransactionsInfo(ctx, { transactionId: providerTransactionId, wasSeen: true });

export const initiatePaymentMethod = async (ctx, { propertyId, inventoryId, tenantName, personId, commonUserId, successUrl, cancelUrl }) => {
  logger.trace({ ctx, propertyId, inventoryId, personId, commonUserId, successUrl, cancelUrl, tenantName }, 'initiatePaymentMethod started!');
  await denyPastResidentOnInventoryId(ctx, personId, propertyId, inventoryId);

  const paymentProvider = await getPaymentProvider(ctx);

  return await paymentProvider.getPaymentMethodFormUrl(ctx, {
    personId,
    inventoryId,
    propertyId,
    tenantName,
    commonUserId,
    successUrl,
    cancelUrl,
  });
};

export const initiateScheduledPayment = async (ctx, { propertyId, personId, inventoryId, commonUserId, successUrl, cancelUrl }) => {
  logger.trace({ ctx, propertyId, inventoryId, personId, commonUserId, successUrl, cancelUrl }, 'initiateScheduledPayment started!');

  await denyPastResidentOnInventoryId(ctx, personId, propertyId, inventoryId);

  const paymentProvider = await getPaymentProvider(ctx);

  return await paymentProvider.getScheduledPaymentFormUrl(ctx, { personId, propertyId, commonUserId, inventoryId, successUrl, cancelUrl });
};

export const handlePaymentMethodNotification = async amqMsg => {
  logger.info(amqMsg, 'handlePaymentMethodNotification started!');
  const { method, paymentMethodId, commonUserId, tenantId, integrationId } = amqMsg;

  const { methodId, channelType, brandType = '', lastFour, expirationDate: expirationMonth = '' } = method || {};

  if (channelType !== PaymentChannel.Ach && isEmpty(brandType)) {
    logger.error(amqMsg, 'handlePaymentMethodNotification - invalid brandType');
    return { processed: true };
  }

  if (!methodId) {
    logger.error(amqMsg, 'handlePaymentMethodNotification - invalid payload');
    return { processed: true };
  }

  const paymentMethod = await createPaymentMethod(
    {},
    { id: paymentMethodId, tenantId, userId: commonUserId, lastFour, brand: brandType, channelType, externalId: methodId, expirationMonth, integrationId },
  );
  const { inventoryId } = (await getInventoryIdByIntegrationId({ tenantId }, integrationId)) || {};

  notify({
    ctx: { tenantId: RESIDENTS },
    event: EventTypes.NEW_PAYMENT_METHOD,
    data: { payload: enhancePaymentMethod({ ...paymentMethod, inventoryId }) },
    routing: { users: [commonUserId], shouldFallbackToBroadcast: false },
  });

  return { processed: true };
};

export const makeOneTimePayment = async (ctx, { personId, inventoryId, propertyId, paymentMethodId, paymentAmount }) => {
  logger.trace({ ctx, propertyId, inventoryId, personId, paymentMethodId, paymentAmount }, 'makeOneTimePayment started!');
  await denyPastResidentOnInventoryId(ctx, personId, propertyId, inventoryId);

  const paymentProvider = await getPaymentProvider(ctx);
  const { externalId: methodId } = (await getPaymentMethodById(ctx, paymentMethodId)) || {};
  const result = await paymentProvider.makeOneTimePayment(ctx, { personId, inventoryId, propertyId, methodId, paymentAmount });
  result.error === 'PAYMENT_EXPIRED' && (await setPaymentMethodExpired(ctx, paymentMethodId));
  return result;
};

export const changeDefaultPaymentMethod = async (ctx, paymentMethodId, userId) => {
  logger.trace({ ctx, paymentMethodId, userId }, 'changeDefaultPaymentMethod');

  return await paymentMethodRepo.changeDefaultPaymentMethodById(ctx, paymentMethodId, userId);
};

export const deleteScheduledPayment = async (ctx, { personId, scheduleId, commonUserId, propertyId }) => {
  logger.trace({ ctx, propertyId, personId, commonUserId, scheduleId }, 'deleteScheduledPayment started!');

  const paymentProvider = await getPaymentProvider(ctx);

  return await paymentProvider.deleteScheduledPayment(ctx, { personId, scheduleId, commonUserId, propertyId });
};

export const deletePaymentMethodById = async (ctx, { paymentMethodId, externalPaymentMethodId, propertyId }) => {
  logger.trace({ ctx, paymentMethodId, externalPaymentMethodId, propertyId }, 'deletePaymentMethod started!');

  const paymentProvider = await getPaymentProvider(ctx);

  const { success } = await paymentProvider.updatePaymentMethodStatus(ctx, { paymentMethodId, externalPaymentMethodId, propertyId });
  if (!success) {
    throw new ServiceError({ token: 'UPDATE_PAYMENT_METHOD_STATUS_ERROR' });
  }
  return await paymentMethodRepo.deletePaymentMethodById(ctx, paymentMethodId);
};

const readHTML = withCachedPromise(async () => await read(join(__dirname, './resources/payment-method-redirect-callback.html')));

const renderHTML = async args => {
  const text = await readHTML();

  const getValueFromArgs = token => {
    const isEmptyString = value => value === '';

    const val = args[token];
    if (!val && !isEmptyString(val)) return `MISSING_TOKEN_${token}`;
    return val;
  };

  return text.replace(HTML_REPLACE_MATCHER, (_, token) => getValueFromArgs(token));
};

export const handlePaymentMethodCallback = async (ctx, { paymentMethodId, callbackResult, commonUserId }) => {
  logger.trace({ ctx, paymentMethodId, callbackResult, commonUserId }, 'handlePaymentMethodCallback');

  const payload = { paymentMethodId, userId: commonUserId };

  if (callbackResult === PaymentMethodCallbackResult.SUCCESS) {
    const html = await renderHTML({
      action: 'transactionRedirected',
      payload,
      icon: 'done',
      iconColor: '',
      displayedMessage: '',
    });
    return { html };
  }
  if (callbackResult === PaymentMethodCallbackResult.CANCEL) {
    const html = await renderHTML({
      action: 'transactionCanceled',
      payload,
      icon: 'cancel',
      iconColor: 'red',
      displayedMessage: '',
    });
    return { html };
  }
  throw new ServiceError({ token: 'PAYMENT_CALLBACK_METHOD_ERROR' });
};

export const handleSchedulePaymentCallback = async (ctx, { callbackResult, commonUserId }) => {
  logger.trace({ ctx, callbackResult }, 'handlePaymentMethodCallback');

  if (callbackResult === PaymentMethodCallbackResult.SUCCESS) {
    notify({
      ctx: { tenantId: RESIDENTS },
      event: EventTypes.NEW_SCHEDULED_PAYMENT,
      routing: { users: [commonUserId], shouldFallbackToBroadcast: false },
    });

    return await renderHTML({
      action: 'transactionRedirected',
      icon: 'done',
      iconColor: '',
      displayedMessage: 'Your payment was scheduled successfully. You may now close this window.',
    });
  }

  if (callbackResult === PaymentMethodCallbackResult.CANCEL) {
    return await renderHTML({
      action: 'transactionCanceled',
      icon: 'cancel',
      iconColor: 'red',
      displayedMessage: 'Your payment was not scheduled. Please contact your leasing agent for further guidance.',
    });
  }

  throw new ServiceError({ token: 'SCHEDULE_PAYMENT_CALLBACK_ERROR' });
};
