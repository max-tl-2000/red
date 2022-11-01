/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../config';
import { admin } from '../common/schemaConstants';
import { getTenantData } from '../dal/tenantsRepo';
import { getAssetIdByEntityIdAndAssetType } from '../dal/assetsRepo';
import { formatAssetUrl } from '../workers/upload/uploadUtil';

const { cloudEnv, telephonyApiToken, externalCalendarsApiToken, telephony, isPublicEnv, reverseProxy, domainSuffix, externalCalendars } = config;

// eslint-disable-next-line camelcase
const getUrlParams = ({ name, authorization_token }, apiToken) => {
  const commonParameters = `env=${cloudEnv}&tenant=${name}&api-token=${apiToken}`;
  // eslint-disable-next-line camelcase
  return authorization_token ? `${commonParameters}&token=${authorization_token}` : commonParameters;
};

const getTelephonyUrlParams = tenant => getUrlParams(tenant, telephonyApiToken);
const getExternalCalendarsUrlParams = tenant => getUrlParams(tenant, externalCalendarsApiToken);

// TODO: Need to be checked I guess that can be removed
const getTenantFromContext = async ctx => ctx.tenant || (await getTenantData(ctx));

const getBaseUrlForNonPublicEnv = tenantName => (isPublicEnv ? `https://${tenantName}.${domainSuffix}` : reverseProxy.url);

export const getTenantHostnameFromContext = (ctx, tenantName) => {
  const hostname = ctx.hostname;
  return hostname && tenantName ? hostname.replace(/^[^.]*/, tenantName) : '';
};

export const getTelephonyConfigs = async ctx => {
  const tenant = await getTenantFromContext(ctx);
  const params = getTelephonyUrlParams(tenant);
  const telephonyCallbackBaseUrl = getBaseUrlForNonPublicEnv(tenant.name);

  return {
    answerUrl: `${telephonyCallbackBaseUrl}${telephony.answerUrl}?${params}`,
    messageUrl: `${telephonyCallbackBaseUrl}${telephony.messageUrl}?${params}`,
    hangupUrl: `${telephonyCallbackBaseUrl}${telephony.hangupUrl}?${params}`,
    postCallUrl: `${telephonyCallbackBaseUrl}${telephony.postCallUrl}?${params}`,
    callRecordingUrl: `${telephonyCallbackBaseUrl}${telephony.callRecordingUrl}?${params}`,
    guestMessageUrl: `${telephonyCallbackBaseUrl}${telephony.guestMessageUrl}?${params}`,
    digitsPressedUrl: `${telephonyCallbackBaseUrl}${telephony.digitsPressedUrl}?${params}`,
    callReadyForDequeueUrl: `${telephonyCallbackBaseUrl}${telephony.callReadyForDequeueUrl}?${params}`,
    conferenceCallbackUrl: `${telephonyCallbackBaseUrl}${telephony.conferenceCallbackUrl}?${params}`,
    auth: {
      authId: tenant.metadata.plivoSubaccountAuthId,
      authToken: tenant.metadata.plivoSubaccountAuthToken,
    },
    dialCallbackUrl: `${telephonyCallbackBaseUrl}${telephony.dialCallbackUrl}?${params}`,
    transferFromQueueUrl: `${telephonyCallbackBaseUrl}${telephony.transferFromQueueUrl}?${params}`,
    transferToVoicemailUrl: `${telephonyCallbackBaseUrl}${telephony.transferToVoicemailUrl}?${params}`,
    agentCallForQueueUrl: `${telephonyCallbackBaseUrl}${telephony.agentCallForQueueUrl}?${params}`,
    statusUrl: `${telephonyCallbackBaseUrl}${telephony.statusUrl}?${params}`,
  };
};

export const getRingCentralConfigs = async ctx => {
  const tenant = await getTenantFromContext(ctx);
  const params = getTelephonyUrlParams(tenant);
  const telephonyCallbackBaseUrl = getBaseUrlForNonPublicEnv(tenant.name);

  return {
    notificationUrl: `${telephonyCallbackBaseUrl}${telephony.ringCentral.notificationUrl}?${params}`,
    authUrl: `https://${ctx.hostname}${telephony.ringCentral.authUrl}`,
    server: telephony.ringCentral.server,
    appKey: telephony.ringCentral.appKey,
    secret: telephony.ringCentral.secret,
  };
};

export const getCronofyConfigs = async ctx => {
  const {
    clientId,
    clientSecret,
    authorizationUrl,
    authorizationUrlForEC,
    delegatedAccessUrl,
    userRevaEventUpdatedUrl,
    userPersonalEventUpdatedUrl,
    teamEventUpdatedUrl,
    externalCalendarRsvpNotificationUrl,
  } = externalCalendars.cronofy;

  const tenant = await getTenantFromContext(ctx);
  const params = getExternalCalendarsUrlParams(tenant);
  const callbackBaseUrl = getBaseUrlForNonPublicEnv(tenant.name);

  return {
    clientId,
    clientSecret,
    authorizationUrl,
    authorizationUrlForEC,
    delegatedAccessUrl: `${callbackBaseUrl}${delegatedAccessUrl}?${params}`,
    userRevaEventUpdatedUrl: `${callbackBaseUrl}${userRevaEventUpdatedUrl}?${params}`,
    userPersonalEventUpdatedUrl: `${callbackBaseUrl}${userPersonalEventUpdatedUrl}?${params}`,
    teamEventUpdatedUrl: `${callbackBaseUrl}${teamEventUpdatedUrl}?${params}`,
    externalCalendarRsvpNotificationUrl: `${callbackBaseUrl}${externalCalendarRsvpNotificationUrl}?${params}`,
  };
};

const formatPermaEntityAssetUrl = ({ tenantName }, entityId, assetType, from) => {
  const assetCallbackBaseUrl = getBaseUrlForNonPublicEnv(tenantName);
  const assetUrl = `${assetCallbackBaseUrl}/api/images/${assetType.toLowerCase()}/${entityId}`;
  const fromParam = `from=${from}`;

  return isPublicEnv
    ? `${assetUrl}${from ? `?${fromParam}` : ''}`
    : `${assetUrl}?${getUrlParams({ name: tenantName }, config.rpImageToken)}${from ? `&${fromParam}` : ''}`;
};

const formatNonPermaEntityAssetUrl = async (ctx, entityId, assetType, multipleAssets = false) => {
  const assets = (await getAssetIdByEntityIdAndAssetType(ctx, { entityId, assetType, ...(multipleAssets ? {} : { limit: 1 }) })) || [];
  const assetsWithFormatedUrl = assets.map(asset => ({ entityId: asset.entityId, assetUrl: formatAssetUrl(ctx.tenantId, asset.assetId) }));
  return multipleAssets ? assetsWithFormatedUrl : assetsWithFormatedUrl?.[0]?.assetUrl || '';
};

export const formatEntityAssetUrl = async (ctx, entityId, assetType, { permaLink, from } = {}) => {
  const multipleAssets = entityId && Array.isArray(entityId);
  const defaultValue = multipleAssets ? [] : '';
  if (!entityId || !assetType) return defaultValue;
  if ((permaLink && !ctx.tenantName) || !ctx.tenantId) return defaultValue;
  if (ctx.tenantId === admin.id || ctx.tenantName === admin.name) return defaultValue;

  if (permaLink) {
    return multipleAssets
      ? entityId.map(id => ({ entityId: id, assetUrl: formatPermaEntityAssetUrl(ctx, id, assetType, from) }))
      : formatPermaEntityAssetUrl(ctx, entityId, assetType, from);
  }

  return await formatNonPermaEntityAssetUrl(ctx, entityId, assetType, multipleAssets);
};
