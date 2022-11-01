/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import OauthClient from 'client-oauth2';
import config from '../../../config';
import { saveLeaseOauthToken, getLeaseSettings } from '../../../dal/propertyRepo';

import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'bluemoonTokenMgr' });

/* returns a currently valid JWT access token, regardless of previous state */
export const getAccessToken = async (ctx, propertyId) => {
  const storeToken = async (leaseSettings, tokenObj) => {
    const newToken = {
      tokenType: tokenObj.tokenType,
      accessToken: tokenObj.accessToken,
      refreshToken: tokenObj.refreshToken,
      expires: tokenObj.expires,
    };
    logger.debug({ ctx, propertyId, fetchedToken: newToken }, 'Fetched oauth token');
    await saveLeaseOauthToken(ctx, propertyId, { ...newToken, username: leaseSettings.username, password: leaseSettings.password });
    return newToken.accessToken;
  };

  try {
    const { clientId, clientSecret, oauthTokenPath, productionHostname } = config.bluemoon.contract;

    if (!clientSecret) throw new Error('Must set clientSecret in source code for now!');
    logger.debug({ ctx, clientId, propertyId }, 'getting access token');

    // Right now, only the prod domain seems to be working, but eventually, the correct one should be used
    // from the config object based on the leasingProviderMode
    const bmOauthClient = new OauthClient({
      clientId,
      clientSecret,
      accessTokenUri: `https://${productionHostname}${oauthTokenPath}`,
      scopes: ['full'],
    });
    const leaseSettings = await getLeaseSettings(ctx, propertyId);

    if (!leaseSettings.username || !leaseSettings.password) {
      throw new Error('Username or password not set to access bluemoon APIs');
    }
    if (!leaseSettings.oauth || leaseSettings.username !== leaseSettings.oauth.username || leaseSettings.password !== leaseSettings.oauth.password) {
      logger.debug({ ctx, propertyId, leaseSettings }, 'Fetching new oauth token');
      const newTokenObj = await bmOauthClient.owner.getToken(leaseSettings.username, leaseSettings.password);
      return await storeToken(leaseSettings, newTokenObj);
    }
    const oauth = leaseSettings.oauth;
    const token = bmOauthClient.createToken(oauth.accessToken, oauth.refreshToken, oauth.tokenType);
    token.expiresIn(new Date(oauth.expires));

    if (token.expired()) {
      logger.debug({ ctx, propertyId, expiredToken: token }, 'Refreshing oauth token');
      let newTokenObj;
      try {
        newTokenObj = await token.refresh();
      } catch (refreshError) {
        logger.debug({ ctx, propertyId, expiredToken: token }, 'Refreshing oauth token with refresh token failed - defaulting to creds');
        newTokenObj = await bmOauthClient.owner.getToken(leaseSettings.username, leaseSettings.password);
      }
      return await storeToken(leaseSettings, newTokenObj);
    }

    logger.debug({ ctx, propertyId }, 'Using existing oauth token');
    return leaseSettings.oauth.accessToken;
  } catch (error) {
    logger.error({ ctx, propertyId, error }, 'unable to fetch oauth token');
    throw error;
  }
};
