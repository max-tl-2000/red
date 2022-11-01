/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as paymentService from '../../services/payment';
import { checkFields } from '../../common/check-fields';
import { sendMessage } from '../../../../server/services/pubsub';
import { APP_EXCHANGE, PAYMENT_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';

import loggerInstance from '../../../../common/helpers/logger';
const logger = loggerInstance.child({ subType: 'Resident - PaymentAction' });

export const getPaymentInfo = async req => {
  const { propertyId } = req.params;
  const { testDataUnits = true } = req.query; // TODO: this needs to default to false once that branch works
  const { consumerToken, personId } = req.middlewareCtx;

  const { commonUserId } = consumerToken || {};
  checkFields(req, { propertyId, personId, commonUserId }, ['propertyId', 'personId', 'commonUserId']);

  return {
    type: 'json',
    content: await paymentService.getPaymentInfo(req, { propertyId, personId, commonUserId, testDataUnits }),
  };
};

export const getScheduledTransactions = async req => {
  const { propertyId } = req.params;
  const { consumerToken, personId } = req.middlewareCtx;

  const { commonUserId } = consumerToken || {};
  checkFields(req, { propertyId, personId, commonUserId }, ['propertyId', 'personId', 'commonUserId']);

  return {
    type: 'json',
    content: await paymentService.getScheduledTransactions(req, { propertyId, personId, commonUserId }),
  };
};

export const markScheduledTransactionAsSeen = async req => {
  const { providerTransactionId } = req.params;
  logger.trace({ ctx: req, providerTransactionId }, 'markScheduledTransactionAsSeen');
  checkFields(req, { providerTransactionId }, ['providerTransactionId']);

  return {
    type: 'json',
    content: await paymentService.markScheduledTransactionAsSeen(req, { providerTransactionId }),
  };
};

export const createPayment = async req => {
  const { propertyId } = req.params;
  const { personId } = req.middlewareCtx;
  const { paymentAmount, paymentMethodId, inventoryId } = req.body;

  checkFields(req, { propertyId, paymentMethodId, paymentAmount, personId, inventoryId }, [
    'propertyId',
    'paymentMethodId',
    'paymentAmount',
    'personId',
    'inventoryId',
  ]);

  return {
    type: 'json',
    content: await paymentService.makeOneTimePayment(req, { propertyId, personId, paymentMethodId, paymentAmount, inventoryId }),
  };
};

export const initiatePaymentMethod = async req => {
  const { successUrl, cancelUrl, propertyId, inventoryId, tenantName } = req.body;
  const { personId, consumerToken } = req.middlewareCtx || {};
  const { commonUserId } = consumerToken || {};

  checkFields(req, { personId, successUrl, cancelUrl, commonUserId, propertyId, inventoryId, tenantName }, [
    'propertyId',
    'personId',
    'commonUserId',
    'successUrl',
    'cancelUrl',
    'inventoryId',
    'tenantName',
  ]);
  return {
    type: 'json',
    content: await paymentService.initiatePaymentMethod(req, {
      propertyId,
      personId,
      commonUserId,
      successUrl,
      cancelUrl,
      inventoryId,
      tenantName,
    }),
  };
};

export const initiateScheduledPayment = async req => {
  const { isFromMobileApp } = req;
  const { successUrl, cancelUrl, inventoryId } = req.body;
  const { propertyId } = req.params;
  const { personId, consumerToken } = req.middlewareCtx || {};
  const { commonUserId } = consumerToken || {};

  checkFields(req, { personId, successUrl, cancelUrl, commonUserId, propertyId, inventoryId }, [
    'propertyId',
    'personId',
    'commonUserId',
    'successUrl',
    'cancelUrl',
    'inventoryId',
  ]);

  return {
    type: 'json',
    content: await paymentService.initiateScheduledPayment(req, { propertyId, personId, commonUserId, inventoryId, successUrl, cancelUrl, isFromMobileApp }),
  };
};

export const deleteScheduledPayment = async req => {
  const { propertyId } = req.params;
  const { externalId } = req.query;
  const { personId, consumerToken } = req.middlewareCtx || {};
  const { commonUserId } = consumerToken || {};

  checkFields(req, { personId, externalId, commonUserId, propertyId }, ['personId', 'externalId', 'commonUserId', 'propertyId']);

  return {
    type: 'json',
    content: await paymentService.deleteScheduledPayment(req, { personId, scheduleId: externalId, commonUserId, propertyId }),
  };
};

export const handlePaymentMethodNotification = async req => {
  const { middlewareCtx, body } = req;
  const { integrationId, paymentMethodId } = req?.query;
  const { queryToken } = middlewareCtx;
  logger.trace({ ctx: req, body, queryToken, integrationId }, 'handlePaymentMethodNotification');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: PAYMENT_MESSAGE_TYPE.PAYMENT_METHOD_NOTIFICATION,
    message: { ...req.body, ...queryToken, tenantId: req.tenantId, integrationId, paymentMethodId },
    ctx: req,
  });

  return {
    type: 'json',
    content: { status: 1 },
  };
};

export const changeDefaultPaymentMethod = async req => {
  const { paymentMethodId } = req.params;
  const { consumerToken } = req.middlewareCtx || {};
  const { commonUserId } = consumerToken || {};

  checkFields(req, { paymentMethodId, commonUserId }, ['paymentMethodId', 'commonUserId']);
  logger.trace({ ctx: req, paymentMethodId, commonUserId }, 'changeDefaultPaymentMethod');

  return {
    type: 'json',
    content: await paymentService.changeDefaultPaymentMethod(req, paymentMethodId, commonUserId),
  };
};

export const deletePaymentMethodById = async req => {
  const { paymentMethodId } = req.params;
  const { propertyId, externalPaymentMethodId } = req.body;
  checkFields(req, { paymentMethodId, externalPaymentMethodId, propertyId }, ['paymentMethodId', 'externalPaymentMethodId', 'propertyId']);

  return {
    type: 'json',
    content: await paymentService.deletePaymentMethodById(req, { paymentMethodId, externalPaymentMethodId, propertyId }),
  };
};

export const handlePaymentMethodCallbackSuccess = async req => {
  logger.trace({ ctx: req, ...req.query }, 'handlePaymentMethodCallbackSuccess');
  const { paymentMethodId, commonUserId } = req.query;
  checkFields(req, { paymentMethodId, commonUserId }, ['paymentMethodId', 'commonUserId']);

  const { html } = await paymentService.handlePaymentMethodCallback(req, { paymentMethodId, callbackResult: 'success', commonUserId });

  return {
    type: 'html',
    content: html,
  };
};

export const handlePaymentMethodCallbackCancel = async req => {
  const { paymentMethodId, commonUserId } = req.query;
  checkFields(req, { paymentMethodId, commonUserId }, ['paymentMethodId', 'commonUserId']);

  logger.trace({ ctx: req, paymentMethodId, commonUserId }, 'handlePaymentMethodCallbackCancel');

  const { html } = await paymentService.handlePaymentMethodCallback(req, { paymentMethodId, callbackResult: 'cancel', commonUserId });

  return {
    type: 'html',
    content: html,
  };
};

export const handleSchedulePaymentCallbackSuccess = async req => {
  const { middlewareCtx } = req;
  const { commonUserId } = middlewareCtx.queryToken;
  logger.trace({ ctx: req, commonUserId }, 'handleSchedulePaymentCallbackSuccess');
  checkFields(req, { commonUserId }, ['commonUserId']);

  const html = await paymentService.handleSchedulePaymentCallback(req, { callbackResult: 'success', commonUserId });

  return { type: 'html', content: html };
};

export const handleSchedulePaymentCallbackCancel = async req => {
  logger.trace({ ctx: req, ...req.query }, 'handleSchedulePaymentCallbackCancel');

  const html = await paymentService.handleSchedulePaymentCallback(req, { callbackResult: 'cancel' });

  return { type: 'html', content: html };
};
