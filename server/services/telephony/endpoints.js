/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries, filter as promiseFilter } from 'bluebird';
import { CallReceiverType } from '../routing/targetUtils';
import { getTelephonyOps } from './providerApiOperations';
import parseBoolean from '../../../common/helpers/booleanParser';
import loggerModule from '../../../common/helpers/logger';
import { userHasWSConnection, loadUsersByIds } from '../users';

const logger = loggerModule.child({ subType: 'telephony-endpoints' });

export const getOnlineSipEndpoints = async (ctx, user) => {
  logger.trace({ ctx, user: user.fullName, sipEndpoints: user.sipEndpoints }, 'getOnlineSipEndpoints - params');
  const isEndpointOnline = async e => {
    try {
      const { sipRegistered: isOnlineString } = await getTelephonyOps().getEndpoint(e.endpointId);
      return parseBoolean(isOnlineString) && (!e.isUsedInApp || userHasWSConnection(ctx, user.id));
    } catch (err) {
      logger.error({ ctx, err, user: user.fullName, sipEndpoints: user.sipEndpoints }, 'getOnlineSipEndpoints - error');
      return false;
    }
  };

  const onlineEndpoints = await promiseFilter(user.sipEndpoints, isEndpointOnline);

  logger.trace({ ctx, onlineEndpoints, user: user.fullName }, 'getOnlineSipEndpoints - result');
  return onlineEndpoints;
};

export const getCallReceivingEndpointsByUser = async (ctx, receiverIds) => {
  logger.trace({ ctx, receiverIds }, 'getCallReceivingEndpointsByUser - params');

  const users = await loadUsersByIds(ctx, receiverIds);

  const result = await mapSeries(users, async user => ({
    userId: user.id,
    sipEndpoints: await getOnlineSipEndpoints(ctx, user),
    externalPhones: user.ringPhones,
  }));

  logger.trace({ ctx, ...result }, 'getCallReceivingEndpointsByUser - result');
  return result;
};

export const getCallReceivingEndpoints = async (ctx, team, receiverIds, type) => {
  logger.trace({ ctx, team: team.displayName, receiverIds, type }, 'getCallReceivingEndpoints - params');

  if (type === CallReceiverType.CALL_CENTER) {
    const result = { id: team.id, type, sipEndpoints: [], externalPhones: [team.callCenterPhoneNumber] };
    logger.trace({ ctx, ...result }, 'getCallReceivingEndpoints - result');
    return result;
  }

  const endpoints = (await getCallReceivingEndpointsByUser(ctx, receiverIds)).reduce(
    (acc, val) => ({
      ids: [...acc.ids, val.userId],
      sipEndpoints: [...acc.sipEndpoints, ...val.sipEndpoints],
      externalPhones: [...acc.externalPhones, ...val.externalPhones],
    }),
    { ids: [], sipEndpoints: [], externalPhones: [] },
  );

  const result = { type: CallReceiverType.REVA_USER, ...endpoints };
  logger.trace({ ctx, ...result }, 'getCallReceivingEndpoints - result');
  return result;
};
