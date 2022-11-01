/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import v4 from 'uuid/v4';
import config from '../config';
import { X_REQUEST_ID, X_ORIGINAL_REQUEST_IDS, X_DOCUMENT_VERSION, formatArrayHeaderValues } from '../../../common/enums/requestHeaders';
import { commonConfig } from '../../../common/server-config';
import * as repo from '../../dal/partyDocumentRepo';
import { getMatchingSubscriptions, getSubscriptionByName } from '../../dal/subscriptionsRepo';
import { getTenantData } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { PARTY_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';

const logger = loggerModule.child({ subType: 'documentHistoryHandler' });

const formatCallbackDomain = tenantName => {
  const { domain, apiPort } = commonConfig;
  if (!domain || !apiPort) return '';

  return `https://${tenantName}.${domain}/api/public`;
};

const getServiceUrlFromSubscriptionUrl = url => {
  if (!url?.includes('localhost')) {
    return url;
  }

  const { decisionApiUrl, exportApiUrl, exportPort, decisionApiPort } = commonConfig;

  const subscriptionUrl = new URL(url);
  const { port: subscriptionUrlPort, pathname: subscriptionUrlPathname } = subscriptionUrl;

  let subscriptionApiUrl;
  if (parseInt(subscriptionUrlPort, 10) === decisionApiPort) {
    subscriptionApiUrl = decisionApiUrl;
  } else if (parseInt(subscriptionUrlPort, 10) === exportPort) {
    subscriptionApiUrl = exportApiUrl;
  }

  if (!subscriptionApiUrl) return url;

  return `${subscriptionApiUrl}${subscriptionUrlPathname}`;
};

let _domainFormatter = formatCallbackDomain;

let _subscriptionRequest = request;
const subscriptionRequest = () => _subscriptionRequest;
export const setSubscriptionRequest = requestor => {
  _subscriptionRequest = requestor;
  _domainFormatter = _name => 'http://fakedomain/public';
  logger.info('subscriptionRequest set for testing');
};

const domainFormatter = name => _domainFormatter(name);

let callBackUrls = {};
const getCallBackUrl = async ctx => {
  const { tenantId } = ctx;
  if (!callBackUrls[tenantId]) {
    const { name: tenantName } = await getTenantData(ctx);
    callBackUrls[tenantId] = domainFormatter(tenantName);
  }

  return callBackUrls[tenantId];
};

export const resetCallBackUrls = () => (callBackUrls = {});

const getTenantSubscriptions = async (ctx, eventNames) => {
  const subscriptions = await getMatchingSubscriptions(ctx, eventNames);
  const callBackUrl = await getCallBackUrl(ctx);

  return subscriptions.map(subscription => ({ ...subscription, callBackUrl }));
};

const handleResponses = ({ ctx, id }) => async responses => {
  if (responses.find(({ error }) => error)) {
    logger.info({ ctx, id, responses }, 'Sending PARTY_UPDATED event failed');
    await repo.markAsFailed(ctx, id, responses);
    return;
  }

  if (responses.find(({ noMatchingSubscriptions }) => noMatchingSubscriptions)) {
    logger.info({ ctx, id, responses }, 'Sending PARTY_UPDATED event completed, no subscriptions matched');
    await repo.markAsNoMatchingSubscriptions(ctx, id, responses);
    return;
  }

  logger.trace({ ctx, id, responses }, 'Sent PARTY_UPDATED event');
  await repo.markAsCompleted(ctx, id, responses);
};

const getOriginalRequestIds = events => events.reduce((acc, event) => [...acc, event.requestIds.filter(reqId => reqId)], []);

const deliverToSubscription = async (ctx, { decision_name: name, url, auth_token: token, callBackUrl }, document) => {
  logger.trace({ ctx, name, url, documentId: document.id }, 'deliverToSubscription');
  const newRequestId = v4();
  const events = document?.document?.events || [];
  const originalRequestIds = getOriginalRequestIds(events);
  const subscriptionUrl = getServiceUrlFromSubscriptionUrl(url);

  try {
    const response = await subscriptionRequest()
      .post(subscriptionUrl)
      .send({ ...document.document, version: document.id, originalRequestIds, events, callBackUrl })
      .set('accept', 'json')
      .set(X_REQUEST_ID, newRequestId)
      .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues(originalRequestIds))
      .set(X_DOCUMENT_VERSION, document.id)
      .set('Authorization', `Bearer ${token}`);
    const { status, error } = response;

    logger.trace({ ctx, hasError: error, name, url, status, callBackUrl, documentId: document.id, originalRequestIds, newRequestId }, 'deliverToSubscription');

    return { name, status, error };
  } catch (error) {
    logger.error({ ctx, error, name, url, callBackUrl, documentId: document.id, originalRequestIds, newRequestId }, 'Failed to deliver event to subscription');
    return { name, error };
  }
};

const defaultEventDelivery = async ({ ctx, document, responseHandler }) => {
  const events = document.document.events || [];
  const eventNames = events.map(event => event.event);
  const originalRequestIds = getOriginalRequestIds(events);
  const subscriptions = await getTenantSubscriptions(ctx, eventNames);

  if (!subscriptions || subscriptions.length === 0) {
    logger.trace(
      { ctx, documentId: document.id, subscriptions, eventNames, originalRequestIds },
      'Skipping PARTY_UPDATED event, no matching subscription found',
    );
    await responseHandler([{ noMatchingSubscriptions: true }]);
    return [];
  }

  const res = await Promise.all(subscriptions.map(subs => deliverToSubscription(ctx, subs, document)));
  await responseHandler(res);
  return res;
};

let deliverEvent = defaultEventDelivery;
export const setEventDeliveryMechanism = delivery => {
  deliverEvent = delivery;
};

export const resetEventDeliveryMechanism = () => {
  deliverEvent = defaultEventDelivery;
};

const pushEvent = async channelPayload => {
  const { msgCtx: ctx, table, type, id } = channelPayload;
  try {
    logger.trace({ ctx, table, type, id }, 'Pushing event');
    const document = await repo.acquireDocument(ctx, id);
    if (!document) {
      logger.trace({ ctx, table, type, id }, 'Skipping party document version, documents acquired by a different server!');
      return [];
    }

    const responseHandler = handleResponses({ ctx, id: document.id });
    const res = await deliverEvent({ ctx, document, responseHandler });
    logger.trace({ ctx, eventResponse: res }, 'Pushed events!');
    return res;
  } catch (error) {
    logger.error({ ctx, error }, 'Pushing event failed.');
    return [{ error, name: 'no matching subscriptions' }];
  }
};

export const sendPartyDocumentHistory = async payload => {
  const { msgCtx: ctx, id } = payload;

  logger.info({ ctx, msgPayload: payload }, 'Send party document history.');
  const deliveryResponses = await pushEvent(payload);
  logger.info({ ctx, msgPayload: payload, deliveryResponses }, 'Sent party document history.');

  await Promise.all(
    deliveryResponses
      .filter(({ error }) => error)
      .map(({ name }) => ({ id, tenantId: ctx.tenantId, subscriptionName: name }))
      .map(
        async delivery =>
          await sendMessage({
            ctx,
            exchange: config.DEAD_LETTER_EXCHANGE,
            key: PARTY_MESSAGE_TYPE.RESEND_DOCUMENT_HISTORY,
            message: delivery,
          }),
      ),
  );
  return { processed: true };
};

export const resendPartyDocumentHistory = async payload => {
  const { id, subscriptionName, msgCtx: ctx } = payload;
  logger.info({ ctx, msgPayload: payload }, 'Resending party document history.');

  try {
    const document = await repo.getPartyDocumentById(ctx, id);
    if (!document) {
      logger.trace({ ctx, id }, 'Could not resend the party document as it is unavailable.');
      return { processed: true };
    }
    const subscription = await getSubscriptionByName(ctx, subscriptionName);

    if (!subscription) {
      logger.trace({ ctx, id, subscriptionName }, 'Could not resend the party document as the specified subscription does not exist.');
      return { processed: true };
    }

    const callBackUrl = await getCallBackUrl(ctx);
    const status = await deliverToSubscription(ctx, { ...subscription, callBackUrl }, document);

    logger.trace({ ctx, id, status }, 'Resending event completed!');
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'Resending event failed.');
  }
  return { processed: true };
};
