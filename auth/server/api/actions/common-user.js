/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import * as service from '../../services/common-user';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { decodeJWTToken, createJWTToken } from '../../../../common/server/jwt-helpers';
import {
  sendRegistrationEmail,
  sendInviteRegisterEmail,
  sendGenericResetPasswordEmail,
  sendGenericYourPasswordChangedEmail,
  sendResidentResetPasswordEmail,
  sendNoCommonResidentResetPasswordEmail,
} from '../../../../server/services/mails';
import logger from '../../../../common/helpers/logger';
import { ServiceError } from '../../../../server/common/errors';
import { getToken } from '../../dal/common-tokens-repo';
import { DALTypes } from '../../../common/enums/dal-types';
import { isUuid } from '../../../../server/common/utils';
import config from '../../../../server/config';

const passHoneypotTrap = ({ _name_ }) => _name_ === '';

export const createCommonUser = async req => {
  const { personId, tenantId, emailAddress, applicationId } = req.body;
  const commonUser = {
    tenantId,
    personId,
    emailAddress,
    applicationId,
  };
  const ctx = { ...req, tenantId };
  logger.debug({ ctx }, 'createCommonUser');
  const commonUserResult = await service.createCommonUser(ctx, commonUser);
  if (commonUserResult.personMapping) {
    const emailContext = {
      ...ctx,
      tenantId,
      tenantName: req.tenantName,
      // Using get function since it returns the hostname with the port number
      host: req.get('host'),
      protocol: req.protocol,
      body: {
        partyId: req.body.partyId,
        quoteId: req.body.quoteId,
        applicationId: req.body.applicationId,
      },
    };
    await sendRegistrationEmail(emailContext, commonUserResult);
  }

  return commonUserResult;
};

export const inviteCommonUser = async (req, res) => {
  const { emailAddress, token } = req.body;
  badRequestErrorIfNotAvailable([
    { property: emailAddress, message: 'MISSING_EMAIL_ADDRESS' },
    { property: token, message: 'MISSING_TOKEN' },
  ]);
  const ctx = { ...req };

  const propertyConfig = await decodeJWTToken(token);
  const commonUserResult = await service.getOrCreateCommonUserByEmail(propertyConfig, emailAddress);
  const isProfileCompleted = service.isProfileCompletedInRoommatesApp(commonUserResult.commonUser, propertyConfig.roommateProfileRequiredFields);

  // User already registered and associated to roommates app
  if (isProfileCompleted) {
    return res.json({
      err: {
        token: 'USER_ALREADY_REGISTERED',
      },
    });
  }

  if (commonUserResult.personMapping) {
    const appConfig = {
      tenant: { id: propertyConfig.tenantId, name: propertyConfig.tenantName },
      property: { id: propertyConfig.propertyId, name: propertyConfig.propertyName },
    };
    let { emailContext } = await service.getParametersToSendEmail(
      ctx,
      commonUserResult.commonUser,
      req.get('host'),
      req.protocol,
      propertyConfig.applicationId,
      appConfig,
    );
    emailContext.confirmUrl = propertyConfig.confirmUrl;
    emailContext = { ...req, emailContext };
    await sendInviteRegisterEmail(emailContext, commonUserResult);
  }
  return res.json(commonUserResult);
};

export const login = async (req, res) => {
  const { residentMobileTokenExpiration } = config.resident;
  const { email, password, _name_ } = req.body;
  const { appId } = req.query || {};
  const commonUser = await service.authenticateCommonUser(req, email, password);

  const isFromResidentMobile = appId?.split('.').length > 1;

  const options = isFromResidentMobile ? { expiresIn: residentMobileTokenExpiration } : {};

  if (!passHoneypotTrap({ _name_ })) {
    logger.warn({ ctx: req }, 'Honeypot trap error');
    return res.status(401);
  }

  const token = createJWTToken({ ...commonUser, commonUserId: commonUser.id }, options);
  return res.json({ user: commonUser, token });
};

export const requestTemporalResetPassword = async (req, res) => {
  const { appId, confirmUrl } = req.body;
  return res.json(createJWTToken({ appId, confirmUrl }, { expiresIn: 60 }));
};

export const requestResetPasswordCommonUser = async (req, res) => {
  const { emailAddress, appId, confirmUrl, token, appName } = req.body;

  const ctx = { ...req };
  badRequestErrorIfNotAvailable([
    { property: emailAddress, message: 'MISSING_EMAIL_ADDRESS' },
    { property: appId, message: 'MISSING_APPID' },
  ]);

  const commonUser = await service.getCommonUserByEmailAddress(ctx, emailAddress);

  if (!commonUser) {
    return res.json({}); // do nothing, do not let the UI know that the email was not found
  }

  badRequestErrorIfNotAvailable([{ property: confirmUrl, message: 'MISSING_CONFIRM_URL' }]);

  if (appId === DALTypes.ApplicationAppId) {
    const emailCtx = { confirmUrl, isRentappReset: true, appName, appId };
    await sendGenericResetPasswordEmail(emailCtx, { commonUser });
    return res.json({}); // Do not return anything the common user is not needed by the UI
  }

  const appConfig = await (token ? decodeJWTToken(token) : {});

  const emailParams = await service.getParametersToSendEmail(ctx, commonUser, req.get('host'), req.protocol, appId, appConfig);
  const emailContext = { ...req, ...emailParams.emailContext };
  const { personMapping } = emailParams;
  emailContext.confirmUrl = service.formatConfirmUrlForResetPassword(confirmUrl, appId, emailContext.tenantName, emailContext.propertyName);

  // Account exist but it wasn't activated then send email to complete registration
  if (!commonUser.inactive && isEmpty(commonUser.password)) {
    await sendInviteRegisterEmail(emailContext, { commonUser, personMapping });
    return res.json({});
  }

  await sendGenericResetPasswordEmail(emailContext, { commonUser, personMapping });
  return res.json({});
};

export const sendResetPasswordEmail = async (req, res) => {
  const { _name_, emailAddress, propertyId, tenantName, appId, appName, isConfirmation } = req.body;

  badRequestErrorIfNotAvailable([{ property: emailAddress, message: 'MISSING_EMAIL_ADDRESS' }]);

  const commonUser = await service.getCommonUserByEmailAddress(req, emailAddress);

  if (!passHoneypotTrap({ _name_ })) {
    logger.warn({ ctx: req }, 'Honeypot trap error');
    return res.json({});
  }

  if (!commonUser) {
    const emailCtx = { tenantId: 'common' };
    await sendNoCommonResidentResetPasswordEmail(emailCtx, appName, emailAddress);
    return res.json({});
  }
  const { tenantId, appName: applicationName } = await service.getTenantResidentSettings(req, {
    appId: appId !== 'resident' ? appId : '',
    commonUserId: commonUser?.id,
    tenantName,
    propertyId,
  });

  const emailCtx = { tenantId, tenantName };
  await sendResidentResetPasswordEmail(emailCtx, { commonUser, propertyId, appId, appName: applicationName || appName, isConfirmation });
  return res.json({});
};

export const checkCommonUserIsRegistered = async (req, res) => {
  // TODO: this check should not be done from the UI, this has to be done in the same request that serves the
  // register HTML page, that way we don't have to expose this endpoint from auth at all
  const ctx = req;
  const commonUserId = req.params.userId;

  if (!isUuid(commonUserId)) throw new ServiceError({ token: 'INVALID_COMMON_USER_ID' });

  badRequestErrorIfNotAvailable([{ property: commonUserId, message: 'MISSING_COMMON_USER_ID' }]);

  const commonUser = await service.getCommonUser(ctx, commonUserId);

  if (!commonUser) {
    // Do not inform the UI that the user doesn't exist
    // just let it be redirected to login in that case
    return res.json({ registered: true });
  }

  logger.debug({ ctx, commonUserId: commonUser.id }, 'Common User');

  return res.json({ registered: !!commonUser.password });
};

const verifyTokenInfo = (tokenInfo, userInput) => {
  if (tokenInfo.userId !== userInput.userId || tokenInfo.emailAddress !== userInput.emailAddress) {
    throw new ServiceError({
      token: 'INVALID_TOKEN',
      status: 498,
    });
  }
};

export const commonUserChangePassword = async (req, res) => {
  const { userId, emailAddress, password, token } = req.body;

  const changePasswordTokenData = await decodeJWTToken(token);

  badRequestErrorIfNotAvailable([
    { property: userId, message: 'MISSING_USER_ID' },
    { property: password, message: 'MISSING_PASSWORD' },
    { property: token, message: 'MISSING_TOKEN' },
  ]);

  verifyTokenInfo(changePasswordTokenData, { userId, emailAddress });

  await service.commonUserChangePassword(req, userId, password);
  return res.json({});
};

export const changeCommonUserPassword = async (req, res) => {
  const { email, password: newPassword, emailToken, _name_ } = req.body;
  badRequestErrorIfNotAvailable([{ property: email, message: 'EMAIL_REQUIRED' }]);
  badRequestErrorIfNotAvailable([{ property: newPassword, message: 'PASSWORD_REQUIRED' }]);
  badRequestErrorIfNotAvailable([{ property: emailToken, message: 'EMAIL_TOKEN_REQUIRED' }]);

  if (!passHoneypotTrap({ _name_ })) {
    logger.warn({ ctx: req }, 'Honeypot trap error');
    return res.json({});
  }

  const commonUser = (await service.changeCommonUserPassword(req, { email, password: newPassword, emailToken })) || {};

  const token = createJWTToken({ ...commonUser, commonUserId: commonUser.id });

  return res.json({
    token,
    user: commonUser,
  });
};

export const registerCommonUser = async (req, res) => {
  const { userId, password, emailAddress, isResetPassword, appId, token } = req.body;
  const ctx = { ...req };

  const dbToken = await getToken(ctx, token);
  if (!dbToken || !dbToken.valid) {
    throw new ServiceError({
      token: 'INVALID_TOKEN',
      status: 498,
    });
  }

  badRequestErrorIfNotAvailable([
    { property: userId, message: 'MISSING_USER_ID' },
    { property: password, message: 'MISSING_PASSWORD' },
    { property: emailAddress, message: 'MISSING_EMAIL_ADDRESS' },
    { property: appId, message: 'MISSING_APPID' },
  ]);

  const tokenInfo = decodeJWTToken(dbToken.token);

  verifyTokenInfo(tokenInfo, { userId, emailAddress });

  await service.commonUserChangePassword(ctx, userId, password);
  const commonUser = await service.authenticateCommonUser(ctx, emailAddress, password);

  const appConfig = await (token ? decodeJWTToken(token) : {});
  let userConfig = {};
  if (isResetPassword && commonUser && appId !== DALTypes.ApplicationAppId) {
    const currentUser = await service.getCommonUserByEmailAddress(ctx, emailAddress);
    const { emailContext, personMapping } = await service.getParametersToSendEmail(ctx, currentUser, req.get('host'), req.protocol, appId, appConfig);
    userConfig = emailContext.appConfig;
    sendGenericYourPasswordChangedEmail(emailContext, {
      commonUser: currentUser,
      personMapping,
    });
  }

  const appToken = createJWTToken({ ...commonUser, ...userConfig, commonUserId: commonUser.id });
  return res.json({ user: commonUser, token: appToken });
};
