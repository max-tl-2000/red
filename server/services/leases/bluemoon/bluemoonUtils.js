/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import OauthClient from 'client-oauth2';
import config from '../../../config';
import { setCtxCache } from '../../../../common/server/ctx-cache';

export const createBluemoonAuth = async (ctx, propertyName, propId, username, password) => {
  const leaseSettingsCachePath = propertyId => `dal.properties[${propertyId}].leaseSettings`;

  const { clientId, clientSecret, oauthTokenPath, productionHostname } = config.bluemoon.contract;
  const testOauthClient = new OauthClient({
    clientId,
    clientSecret,
    accessTokenUri: `https://${productionHostname}${oauthTokenPath}`,
    scopes: ['full'],
  });
  const token = await testOauthClient.owner.getToken(username, password);
  const leaseSettings = {
    propertyName,
    username,
    password,
    oauth: { ...token, username, password },
  };
  setCtxCache(ctx, leaseSettingsCachePath(propId), leaseSettings);
};
