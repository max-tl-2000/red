/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../common/server/jwt-helpers';
import { tenant, chan, createResolverMatcher } from './setupTestGlobalContext';
import { setupConsumers } from '../workers/consumer';
import { now } from '../../common/helpers/moment-utils';

// alreadyExpired is to simulate cases in which tenant was refreshed after login
export const getToken = (tenantId, userId, userTeams, alreadyExpired = false, isCommonUser = false, extraTokenData) => {
  const userIdProperty = !isCommonUser ? 'id' : 'commonUserId';
  let tokenData = {
    name: 'test',
    fullName: 'test',
    tenantId: tenantId || tenant.id,
    tenantName: tenant.name,
    quoteId: extraTokenData?.quoteId,
    tenantRefreshedAt: alreadyExpired ? now().subtract(1000, 'seconds').toDate().toUTCString() : tenant.refreshed_at.toUTCString(),
    [userIdProperty]: userId,
    teams: userTeams,
    protocol: 'http',
    domain: 'dev.reva.tech',
  };
  if (extraTokenData) {
    tokenData = { ...tokenData, ...extraTokenData };
  }
  return createJWTToken(tokenData);
};

export function getAuthHeader(tenantId, userId, userTeams, isCommonUser, extraData) {
  const token = getToken(tenantId, userId, userTeams, false, isCommonUser, extraData);
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getExpiredAuthHeader(tenantId, userId, userTeams) {
  const token = getToken(tenantId, userId, userTeams, true /* alreadyExpired */);
  return {
    Authorization: `Bearer ${token}`,
  };
}

function resolverFactory(resolve, reject, condition) {
  return (...args) => {
    let res;
    try {
      res = condition(...args);
    } catch (err) {
      reject(err);
    }
    if (res) {
      resolve(res);
    }
    return res;
  };
}

export function waitFor(conditions) {
  const resolvers = [];
  const promises = [];

  conditions.forEach(condition => {
    let resolver;
    let rejector;
    const promise = new Promise((resolve, reject) => {
      resolver = resolve;
      rejector = reject;
    });

    promises.push(promise);
    resolvers.push(resolverFactory(resolver, rejector, condition));
  });

  return { resolvers, promises };
}

export function waitForOne(condition) {
  const {
    resolvers: [resolver],
    promises: [promise],
  } = waitFor([condition]);
  return { resolver, promise };
}

export const setupQueueToWaitFor = async (conditions, topics = ['telephony'], handlerMustSucceed = true, noOfRetries = 0) => {
  const enhancedConditions = handlerMustSucceed
    ? conditions.map(c => (msg, handlerSucceeded, queueMessage) => c(msg, handlerMustSucceed, queueMessage) && handlerSucceeded)
    : conditions;

  const { resolvers, promises } = waitFor(enhancedConditions);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, topics, true, noOfRetries);
  return { task: Promise.all(promises), matcher, tasks: promises };
};

export const setupQueue = async topic => {
  await setupConsumers(chan(), createResolverMatcher(), [topic]);
};
