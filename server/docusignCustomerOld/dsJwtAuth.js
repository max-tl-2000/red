/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { now } from '../../common/helpers/moment-utils';
import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'dsJwtAuth' });

/**
 * @file
 * This file handles the JWT authentication with DocuSign.
 * It also looks up the user's account and base_url
 * via the OAuth::userInfo method.
 * See https://developers.docusign.com/esign-rest-api/guides/authentication/user-info-endpoints userInfo method.
 * @author DocuSign
 */

const DsJwtAuth = {};
module.exports = DsJwtAuth; // SET EXPORTS for the module.

const docusign = require('docusign-esign');
const dsConfig = require('./dsConfig').config;

// private constants and globals
const tokenReplaceMin = 10; // The accessToken must expire at least this number of
// minutes later or it will be replaced

let tokenExpirationTimestamp = null; // when does the accessToken expire?

// Exported variables
DsJwtAuth.accessToken = null; // The bearer accessToken
DsJwtAuth.accountId = null; // current account
DsJwtAuth.accountName = null; // current account name
DsJwtAuth.basePath = null; // eg https://na2.docusign.net/restapi
DsJwtAuth.userName = null;
DsJwtAuth.userEmail = null;

/**
 * This is the key method for the object.
 * It should be called before any API call to DocuSign.
 * It checks that the existing access accessToken can be used.
 * If the existing accessToken is expired or doesn't exist, then
 * a new accessToken will be obtained from DocuSign by using
 * the JWT flow.
 *
 * This is an async function so call it with await.
 *
 * SIDE EFFECT: Sets the access accessToken that the SDK will use.
 * SIDE EFFECT: If the accountId et al is not set, then this method will
 *              also get the user's information
 * @function
 * @returns {promise} a promise with null result.
 */
DsJwtAuth.checkToken = async function _checkToken() {
  const noToken = !DsJwtAuth.accessToken || !tokenExpirationTimestamp;
  const needToken = noToken || tokenExpirationTimestamp.isBefore(now());
  if (noToken) {
    logger.trace('checkToken: Starting up--need an accessToken');
  }
  if (needToken && !noToken) {
    logger.trace('checkToken: Replacing old accessToken');
  }

  if (needToken) {
    const results = await DsJwtAuth.getToken();
    DsJwtAuth.accessToken = results.accessToken;
    tokenExpirationTimestamp = results.tokenExpirationTimestamp;
    logger.trace('Obtained an access token. Continuing...');

    if (!DsJwtAuth.accountId) {
      await DsJwtAuth.getUserInfo();
    }
  }
};

/**
 * Async function to obtain a accessToken via JWT grant
 *
 * RETURNS {accessToken, tokenExpirationTimestamp}
 *
 * We need a new accessToken. We will use the DocuSign SDK's function.
 */
DsJwtAuth.getToken = async function _getToken() {
  // Data used
  // dsConfig.clientId
  // dsConfig.impersonatedUserGuid
  // dsConfig.privateKey
  // dsConfig.authServer
  const jwtLifeSec = 10 * 60; // requested lifetime for the JWT is 10 min
  const scopes = 'signature'; // impersonation scope is implied due to use of JWT grant
  const dsApi = new docusign.ApiClient();

  dsApi.setOAuthBasePath(dsConfig.authServer);
  const results = await dsApi.requestJWTUserToken(dsConfig.clientId, dsConfig.impersonatedUserGuid, scopes, dsConfig.privateKey, jwtLifeSec);
  const expiresAt = now().add(results.body.expires_in, 's').subtract(tokenReplaceMin, 'm');
  return { accessToken: results.body.access_token, tokenExpirationTimestamp: expiresAt };
};

/**
 * Sets the following variables:
 * DsJwtAuth.accountId
 * DsJwtAuth.accountName
 * DsJwtAuth.basePath
 * DsJwtAuth.userName
 * DsJwtAuth.userEmail
 * @function _getAccount
 * @returns {promise}
 * @promise
 */
DsJwtAuth.getUserInfo = async function _getUserInfo() {
  // Data used:
  // dsConfig.targetAccountId
  // dsConfig.authServer
  // DsJwtAuth.accessToken

  const dsApi = new docusign.ApiClient();
  const targetAccountId = dsConfig.targetAccountId;
  const baseUriSuffix = '/restapi';

  dsApi.setOAuthBasePath(dsConfig.authServer);
  const results = await dsApi.getUserInfo(DsJwtAuth.accessToken);

  let accountInfo;
  if (targetAccountId === 'false' || targetAccountId === 'FALSE' || targetAccountId === false) {
    // find the default account
    accountInfo = results.accounts.find(account => account.isDefault === 'true');
  } else {
    // find the matching account
    accountInfo = results.accounts.find(account => account.accountId === targetAccountId);
  }
  if (typeof accountInfo === 'undefined') {
    const err = new Error(`Target account ${targetAccountId} not found!`);
    throw err;
  }

  ({ accountId: DsJwtAuth.accountId, accountName: DsJwtAuth.accountName, baseUri: DsJwtAuth.basePath } = accountInfo);
  DsJwtAuth.basePath += baseUriSuffix;
};

/**
 * Clears the accessToken. Same as logging out
 * @function
 */
DsJwtAuth.clearToken = () => {
  // "logout" function
  tokenExpirationTimestamp = false;
  DsJwtAuth.accessToken = false;
};
