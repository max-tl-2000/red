/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveTenantMetadata } from '../../../dal/tenantsRepo';
import loggerModule from '../../../../common/helpers/logger';
import { request } from '../../../../common/helpers/httpUtils';
import { getRingCentralConfigs } from '../../../helpers/tenantContextConfigs';
const logger = loggerModule.child({ subType: 'ringCentralAdapter' });

const refreshHandicapMs = 60 * 1000;
const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json',
};

export const isTokenValid = authData => authData.expire_time - refreshHandicapMs > Date.now();

export const refreshToken = async ({ ctx, tenant }) => {
  logger.debug(`[Ring Central] - Refreshing RC token for tenant ${tenant.id}`);
  const config = await getRingCentralConfigs(ctx);
  const url = `${config.server}/restapi/oauth/token`;
  const data = {
    grant_type: 'refresh_token',
    refresh_token: tenant.metadata.ringCentral.refresh_token,
  };
  const res = await request(url, {
    method: 'post',
    type: 'application/x-www-form-urlencoded',
    timeout: 3000,
    data,
    headers,
    auth: {
      user: config.appKey,
      pass: config.secret,
    },
  });
  if (res) logger.debug('[Ring Central] Token refresh done');
  await saveTenantMetadata(ctx, tenant.id, {
    ringCentral: res,
  });
  return res;
};

export const requestToken = async ({ ctx, code }) => {
  const config = await getRingCentralConfigs(ctx);
  const url = `${config.server}/restapi/oauth/token`;
  const data = {
    grant_type: 'authorization_code',
    client_id: config.appKey,
    code,
    redirect_uri: config.authUrl,
  };
  const res = await request(url, {
    method: 'post',
    timeout: 3000,
    data,
    headers,
    type: 'application/x-www-form-urlencoded',
    auth: {
      user: config.appKey,
      pass: config.secret,
    },
  });
  await saveTenantMetadata(ctx, ctx.tenantId, {
    ringCentral: res,
  });
  return res;
};

export const getAuthUrl = async ({ ctx }) => {
  const config = await getRingCentralConfigs(ctx);
  const ringCentralAuthorizeUrl = `${config.server}/restapi/oauth/authorize`;
  return `${ringCentralAuthorizeUrl}?response_type=code&client_id=${config.appKey}&redirect_uri=${config.authUrl}`;
};

const getAuthHeader = ({ tenant }) => {
  const token = `Bearer ${tenant.metadata.ringCentral.access_token}`;
  return {
    Authorization: token,
  };
};

const callRC = async (url, { ctx, tenant, data = {}, method = 'get' }) => {
  const config = await getRingCentralConfigs(ctx);
  const path = `${config.server}/restapi/v1.0${url}`;
  let res;
  try {
    res = await request(path, {
      data,
      method,
      timeout: 3000,
      headers: getAuthHeader({ tenant }),
    });
    logger.debug(`[Ring Central] call result: ${JSON.stringify(res)}`);
  } catch (e) {
    if (e.status === 401) {
      logger.warn({ e }, 'Token needs to be refreshed');
      await refreshToken({ ctx, tenant });
      // TODO: add better retry mechanism
      res = await request(path, {
        data,
        method,
        timeout: 3000,
        headers: getAuthHeader({ tenant }),
      });
    }
    logger.error({ e });
  }
  return res;
};

export const renewSubscription = async ({ ctx, tenant }) => {
  const res = await callRC('/subscription', { ctx, tenant });
  if (!res.records.length) {
    const config = await getRingCentralConfigs(ctx);
    const webhook = config.notificationUrl;
    await callRC('/subscription', {
      ctx,
      tenant,
      method: 'post',
      data: {
        eventFilters: [
          '/restapi/v1.0/account/~/extension/~/message-store',
          '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS',
          '/restapi/v1.0/account/~/presence',
          '/restapi/v1.0/account/~/extension/~/presence',
          '/restapi/v1.0/account/~/extension/~/presence/line/presence',
          '/restapi/v1.0/account/~/extension/~/presence?detailedTelephonyState=true',
          '/restapi/v1.0/account/~/extension/~/presence/line/presence?detailedTelephonyState=true',
          '/restapi/v1.0/account/~/extension/~/presence/line',
        ],
        deliveryMode: {
          transportType: 'WebHook',
          address: webhook,
        },
      },
    });
    logger.debug('[Ring Central] - subscription created');
  } else {
    const sub = res.records[0].id;
    await callRC(`/subscription/${sub}/renew`, { ctx, tenant, method: 'post' });
    logger.debug('[Ring Central] - subscription renewed');
  }
};
